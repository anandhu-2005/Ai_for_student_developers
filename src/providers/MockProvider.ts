import { BaseAIProvider } from './AIProvider';
import { AnalysisRequest, ConnectionStatus } from '../types/provider';
import { DebuggingReport } from '../types/analysis';
import { ReportValidator } from '../analysis/reportValidator';

export class MockProvider extends BaseAIProvider {
  public readonly id = 'mock';
  public readonly displayName = 'Mock Deterministic AI (Testing & Offline)';

  public async testConnection(): Promise<ConnectionStatus> {
    return {
      success: true,
      provider: this.displayName,
      availableModels: ['mock-student-tutor-v1'],
      latencyMs: 12,
      message: 'Mock AI provider is ready for deterministic offline tests.'
    };
  }

  public async analyze(request: AnalysisRequest): Promise<DebuggingReport> {
    const ctx = request.context;
    const source = ctx.fullSource;
    const lines = source.split(/\r?\n/);
    const purpose = ctx.detectedPurpose?.purpose || 'Sample Program Execution';

    // Tailored mock responses for test files
    if (source.includes('fcfs') || ctx.fileName.includes('fcfs')) {
      const mockJson = {
        programPurpose: {
          purpose: 'FCFS (First-Come, First-Served) CPU Scheduling Algorithm',
          source: ctx.detectedPurpose?.source || 'explicit_comment',
          explanation: 'Calculates Waiting Time (WT), Turnaround Time (TAT), and their averages under the FCFS non-preemptive discipline.',
          isMismatch: ctx.detectedPurpose?.isMismatch || false,
          algorithmName: 'FCFS CPU Scheduling'
        },
        overallVerdict: 'bugs_detected',
        verdictSummary: 'Syntax and logical bugs detected: variable declaration missing type specifier and uninitialized average accumulators.',
        findings: [
          {
            issueNumber: 1,
            category: 'compile-time',
            severity: 'error',
            lineNumber: 4,
            codeSnippet: '     i, n, bt[20], wt[20], tat[20];',
            expectedBehavior: 'int i, n, bt[20], wt[20], tat[20];',
            actualBehavior: 'Missing type keyword causes syntax/compiler error',
            explanation: 'In C, variables must be declared with a data type before their names.',
            suggestedCorrection: '    int i, n, bt[20], wt[20], tat[20];'
          },
          {
            issueNumber: 2,
            category: 'logic',
            severity: 'error',
            lineNumber: 5,
            codeSnippet: '    float wtavg, tatavg;',
            expectedBehavior: 'float wtavg = 0, tatavg = 0;',
            actualBehavior: 'Uninitialized variables contain random memory garbage, making average calculations wrong',
            explanation: 'Local variables in C are allocated on the stack and contain unpredictable garbage until explicitly assigned.',
            suggestedCorrection: '    float wtavg = 0, tatavg = 0;'
          }
        ],
        logicExplanation: '1. Reads process count n and individual burst times into bt[].\n2. First process waiting time is wt[0] = 0; turnaround time is tat[0] = bt[0].\n3. In the loop, wt[i] = wt[i-1] + bt[i-1], and tat[i] = wt[i] + bt[i].\n4. Finally, sums wt[i] and tat[i] into wtavg and tatavg, then divides by n.',
        loopTrace: {
          title: 'FCFS Scheduling Execution Trace (3 Processes, Burst = [4, 3, 2])',
          headers: ['Process', 'Burst Time', 'Waiting Time (WT)', 'Turnaround Time (TAT)', 'Formula Applied'],
          rows: [
            {
              iteration: 'P0',
              varsBefore: 'wt[0]=0',
              condition: 'Start',
              operation: 'tat[0] = bt[0]',
              varsAfter: 'wt[0]=0, tat[0]=4',
              output: 'P0: WT=0, TAT=4'
            },
            {
              iteration: 'P1',
              varsBefore: 'wt[0]=0, bt[0]=4',
              condition: 'i=1 < 3',
              operation: 'wt[1] = 0 + 4, tat[1] = 4 + 3',
              varsAfter: 'wt[1]=4, tat[1]=7',
              output: 'P1: WT=4, TAT=7'
            },
            {
              iteration: 'P2',
              varsBefore: 'wt[1]=4, bt[1]=3',
              condition: 'i=2 < 3',
              operation: 'wt[2] = 4 + 3, tat[2] = 7 + 2',
              varsAfter: 'wt[2]=7, tat[2]=9',
              output: 'P2: WT=7, TAT=9'
            }
          ],
          notes: 'Average Waiting Time = (0+4+7)/3 = 3.67, Average TAT = (4+7+9)/3 = 6.67',
          isIllustrative: true
        },
        suggestedFixes: [
          {
            id: 'fix_1',
            description: 'Fix declaration type and initialize accumulator variables to zero',
            originalSnippet: '     i, n, bt[20], wt[20], tat[20];\n    float wtavg, tatavg;',
            replacementSnippet: '    int i, n, bt[20], wt[20], tat[20];\n    float wtavg = 0, tatavg = 0;',
            explanation: 'Adds missing "int" keyword and initializes accumulators to 0.'
          }
        ],
        verificationChecklist: [
          {
            step: 'Compile with gcc and test with 3 processes (burst times 4, 3, 2)',
            testInput: '3\n4\n3\n2',
            expectedOutput: 'Average Waiting Time: 3.67\nAverage Turnaround Time: 6.67'
          }
        ],
        learningPoints: [
          {
            concept: 'Local Variable Initialization in C',
            explanation: 'Unlike some high-level languages, C does not automatically zero-initialize local stack variables.',
            takeaway: 'Always initialize variables used as accumulators (e.g. float sum = 0;) upon declaration.'
          }
        ],
        assumptions: ['Processes arrive at time 0 (non-preemptive).'],
        limitations: ['Array size fixed at 20 processes.'],
        confidence: 'high'
      };

      return ReportValidator.validate(JSON.stringify(mockJson), {
        fileName: ctx.fileName,
        filePath: ctx.filePath,
        languageId: ctx.languageId,
        totalLines: lines.length,
        detectedPurpose: ctx.detectedPurpose,
        staticIssues: ctx.staticIssues,
        diagnostics: ctx.diagnostics
      });
    }

    // Default clean program mock response
    const mockJson = {
      programPurpose: {
        purpose: purpose,
        source: ctx.detectedPurpose?.source || 'inferred_code',
        explanation: 'Identified purpose from source analysis.',
        isMismatch: ctx.detectedPurpose?.isMismatch || false
      },
      overallVerdict: 'likely_correct',
      verdictSummary: 'Program structure appears logically consistent with the identified purpose.',
      findings: [],
      logicExplanation: 'Program executes sequence of operations as expected based on source structure.',
      suggestedFixes: [],
      verificationChecklist: [
        {
          step: 'Run with typical edge cases (empty inputs, negative bounds)',
          testInput: 'Standard test input',
          expectedOutput: 'Expected valid result'
        }
      ],
      learningPoints: [
        {
          concept: 'Algorithm Verification',
          explanation: 'Testing corner cases ensures robustness against unexpected runtime errors.',
          takeaway: 'Always test boundary values before finalizing code.'
        }
      ],
      assumptions: ['Standard runtime environment available.'],
      limitations: ['Static evaluation without comprehensive execution fuzzing.'],
      confidence: 'medium'
    };

    return ReportValidator.validate(JSON.stringify(mockJson), {
      fileName: ctx.fileName,
      filePath: ctx.filePath,
      languageId: ctx.languageId,
      totalLines: lines.length,
      detectedPurpose: ctx.detectedPurpose,
      staticIssues: ctx.staticIssues,
      diagnostics: ctx.diagnostics
    });
  }
}
