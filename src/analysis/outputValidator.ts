export interface LogicalOutputIssue {
  type: 'garbage_values' | 'negative_metrics' | 'unrealistic_calculation' | 'nan_or_infinity';
  summary: string;
  details: string;
  suspectedLine?: number;
  rootCause: string;
  suggestedFix: string;
}

export class OutputValidator {
  /**
   * Analyzes program output and source code to identify runtime logical anomalies,
   * uninitialized memory garbage, and invalid outputs even when exit code is 0.
   */
  public static validate(output: string, source: string, languageId: string): LogicalOutputIssue[] {
    const issues: LogicalOutputIssue[] = [];
    if (!output || !output.trim()) {
      return issues;
    }

    const isC = ['c', 'cpp'].includes(languageId);
    const lines = source.split(/\r?\n/);

    // 1. Check for huge numbers indicative of uninitialized memory in student code (e.g. 12258408, 4199136, 3291510)
    // Matches 6+ digit integers or large floats that are not timestamps
    const garbageMatches = output.match(/(?:^|\s)(?:-?\d{6,}(?:\.\d+)?)(?:\s|$)/g);
    // Filter out common false positives like memory addresses (0x...) or dates (20261025)
    const trueGarbage = (garbageMatches || []).map(m => m.trim()).filter(val => {
      const num = Math.abs(parseFloat(val));
      return num >= 100000 && !val.startsWith('0x') && num !== 20261025;
    });

    // 2. Check for negative waiting / turnaround times in scheduling outputs
    const negativeTimeMatch = output.match(/(?:Waiting|Turnaround|WT|TAT)[^\r\n]*?(-[1-9]\d*)/i) ||
                             output.match(/\b([A-Za-z0-9_]+)\s+\d+\s+(-[1-9]\d*)\s+/);

    // 3. Check for NaN or Infinity
    const nanMatch = output.match(/\b(NaN|Infinity|-Infinity)\b/);

    // ── FCFS / CPU Scheduling Specific Logical Output Checks ───────────────
    const hasFcfsHeader = /FCFS/i.test(source) || /Waiting\s+Turnaround/i.test(output) || /Average\s+Waiting\s+Time/i.test(output);

    if (hasFcfsHeader) {
      // Extract average waiting time and turnaround time if printed
      const avgWtMatch = output.match(/Average\s+Waiting\s+Time\s*:\s*([\d.-]+)/i);
      const avgTatMatch = output.match(/Average\s+Turnaround\s+Time\s*:\s*([\d.-]+)/i);

      let isUnrealistic = false;
      let badVal = '';
      if (avgWtMatch) {
        const wtVal = parseFloat(avgWtMatch[1]);
        if (wtVal > 10000 || wtVal < 0 || isNaN(wtVal)) {
          isUnrealistic = true;
          badVal = `Average Waiting Time: ${avgWtMatch[1]}`;
        }
      }
      if (avgTatMatch) {
        const tatVal = parseFloat(avgTatMatch[1]);
        if (tatVal > 10000 || tatVal < 0 || isNaN(tatVal)) {
          isUnrealistic = true;
          badVal = (badVal ? badVal + ', ' : '') + `Average Turnaround Time: ${avgTatMatch[1]}`;
        }
      }

      if (trueGarbage.length > 0 || negativeTimeMatch || isUnrealistic) {
        // Find root cause in source
        let suspectedLine: number | undefined;
        let rootCause = 'The program output contains corrupted or uninitialized stack memory values.';
        let fix = 'Check variable initialization and loop boundaries.';

        // Check if loop starts at wrong index (e.g. i=8 or i=0 accessing wt[i-1])
        for (let idx = 0; idx < lines.length; idx++) {
          const l = lines[idx];
          if (/for\s*\(\s*i\s*=\s*([2-9]|[1-9]\d+)\s*;/.test(l)) {
            suspectedLine = idx + 1;
            const startVal = l.match(/for\s*\(\s*i\s*=\s*(\d+)/)?.[1];
            rootCause = `Line ${idx + 1} for-loop starts at i=${startVal}, skipping processes 1 through ${Number(startVal) - 1}. Their waiting times are never computed and remain random stack garbage.`;
            fix = `Change 'for(i=${startVal}; ...)' to 'for(i=1; i<n; i++)' so all processes are calculated sequentially.`;
            break;
          }
          if (/for\s*\(\s*i\s*=\s*0\s*;[^;]*;\s*i\+\+\s*\)\s*\{?/.test(l) && lines.slice(idx, idx + 5).some(sub => /wt\[i\s*-\s*1\]/.test(sub))) {
            suspectedLine = idx + 1;
            rootCause = `Line ${idx + 1} loop starts at i=0, but inside the loop wt[i-1] accesses index -1 (out-of-bounds invalid memory) on the first iteration.`;
            fix = `Change loop to start from i=1 ('for(i=1; i<n; i++)') since process 0 is already initialized with wt[0] = 0.`;
            break;
          }
        }

        // Also check uninitialized accumulator (wtavg / tatavg)
        const uninitLine = lines.findIndex(l => /\b(float|double)\s+wtavg\s*,\s*tatavg\s*;/.test(l));
        if (uninitLine !== -1) {
          if (!suspectedLine) { suspectedLine = uninitLine + 1; }
          rootCause += ` Also, variables 'wtavg' and 'tatavg' at line ${uninitLine + 1} were declared without '= 0', so accumulating into them adds random garbage.`;
          fix += ` Initialize 'float wtavg = 0, tatavg = 0;' upon declaration.`;
        }

        issues.push({
          type: 'garbage_values',
          summary: `Logical Error: Output contains corrupted values (${badVal || (trueGarbage[0] ? `garbage: ${trueGarbage[0]}` : 'negative values')})`,
          details: `Output contains impossible values indicative of uninitialized memory access.`,
          suspectedLine,
          rootCause,
          suggestedFix: fix
        });
        return issues;
      }
    }

    // 4. General uninitialized garbage numbers in output
    if (trueGarbage.length > 0 && isC) {
      issues.push({
        type: 'garbage_values',
        summary: `Possible Uninitialized Memory: Found unusually large numbers in output (${trueGarbage.slice(0, 3).join(', ')})`,
        details: `Large values in output typically occur in C/C++ when variables or array elements are printed before being assigned.`,
        rootCause: 'Reading from local stack variables or array indices that were never assigned a value.',
        suggestedFix: 'Ensure all variables and array elements are assigned or initialized to 0 before reading.'
      });
    }

    // 5. NaN or Infinity check
    if (nanMatch) {
      issues.push({
        type: 'nan_or_infinity',
        summary: `Calculation Error: Output contains '${nanMatch[1]}'`,
        details: `A mathematical calculation produced an invalid result (such as dividing by zero or taking square root of negative number).`,
        rootCause: 'Division by zero or invalid floating-point operation.',
        suggestedFix: 'Check that denominators in division operations are non-zero before dividing.'
      });
    }

    return issues;
  }
}

