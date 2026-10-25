export interface StaticCodeIssue {
  line: number;
  snippet: string;
  category: 'logic' | 'syntax' | 'compile-time' | 'runtime' | 'code-quality';
  severity: 'error' | 'warning' | 'info';
  message: string;
  expected: string;
  actual: string;
  suggestedFix?: string;
}

export class ErrorDetector {
  /**
   * Scans source code with static heuristic rules to pinpoint student bugs.
   * Rules are ordered from highest confidence to lowest to minimise false positives.
   */
  public static scan(source: string, languageId: string): StaticCodeIssue[] {
    const issues: StaticCodeIssue[] = [];
    const lines = source.split(/\r?\n/);
    const isC = ['c', 'cpp'].includes(languageId);
    const isPython = languageId === 'python';

    // Collect declared variable and array names for C (to detect undeclared-use and out-of-bounds)
    const declaredVars = new Set<string>();
    const declaredArrays = new Map<string, number>();
    if (isC) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) { continue; }
        // Match typed declarations: int x, y; float a = 0; char buf[20];
        const declMatch = trimmed.match(/^(?:int|float|double|char|long|short|unsigned|bool|auto|const|static|void)\b.*?([a-zA-Z_][a-zA-Z0-9_,\s\[\].*=]*);/);
        if (declMatch) {
          // Extract all variable names from the declaration
          const rest = declMatch[0];
          const varNames = rest.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\[(\d*)\])?\s*(?:=\s*[^,;]+)?(?=[,;])/g);
          for (const v of varNames) {
            const varName = v[1];
            // Skip type keywords
            if (!/^(int|float|double|char|long|short|unsigned|bool|auto|const|static|void|return|for|if|while|else)$/.test(varName)) {
              declaredVars.add(varName);
              if (v[2]) {
                const arrSize = parseInt(v[2], 10);
                if (!isNaN(arrSize) && arrSize > 0) {
                  declaredArrays.set(varName, arrSize);
                }
              }
            }
          }
        }
        // Also capture loop variable declarations: for (int i = 0; ...)
        const forDeclMatch = trimmed.matchAll(/for\s*\(\s*(?:int|float|double)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        for (const fd of forDeclMatch) {
          declaredVars.add(fd[1]);
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // ── Rule 1: C/C++ missing type in declaration ─────────────────────────
      // e.g. "     i, n, bt[20], wt[20], tat[20];"
      if (isC) {
        if (/^\s*([a-zA-Z_][a-zA-Z0-9_]*(\[\d*\])?\s*,\s*)+[a-zA-Z_][a-zA-Z0-9_]*(\[\d*\])?\s*;/.test(line)) {
          if (!/^(int|float|double|char|long|short|unsigned|void|auto|bool|const|static)\b/.test(trimmed)) {
            issues.push({
              line: lineNum,
              snippet: line,
              category: 'compile-time',
              severity: 'error',
              message: 'Missing type specifier in variable declaration. In C, variables must be preceded by a type (e.g., "int").',
              expected: 'int ' + trimmed,
              actual: trimmed,
              suggestedFix: '    int ' + trimmed
            });
          }
        }
      }

      // ── Rule 2: Uninitialized variable accumulation ───────────────────────
      // e.g. wtavg += wt[i] or sum += arr[i]
      const accMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+=\s*(.*);/);
      if (accMatch) {
        const varName = accMatch[1];
        let initialized = false;
        const declRegex = new RegExp(`\\b${varName}\\s*=\\s*0`);
        for (let j = 0; j < i; j++) {
          if (declRegex.test(lines[j])) { initialized = true; break; }
        }
        if (!initialized) {
          let declared = false;
          const simpleDecl = new RegExp(`\\b(int|float|double)\\b.*\\b${varName}\\b`);
          for (let j = 0; j < i; j++) {
            if (simpleDecl.test(lines[j]) && !lines[j].includes(`${varName} =`)) {
              declared = true; break;
            }
          }
          if (declared) {
            issues.push({
              line: lineNum,
              snippet: line,
              category: 'logic',
              severity: 'error',
              message: `Variable '${varName}' is accumulated with '+=' but was never initialized to 0. In C/C++, uninitialized local variables contain garbage values, producing incorrect output.`,
              expected: `'${varName}' initialized to 0 (e.g., float ${varName} = 0;) before accumulation`,
              actual: `Accumulating into uninitialized variable '${varName}'`,
              suggestedFix: `Initialize '${varName} = 0;' at its declaration.`
            });
          }
        }
      }

      // ── Rule 3: Assignment within condition (= instead of ==) ────────────
      const assignmentInCond = trimmed.match(/^if\s*\(([^)=!<>&|]+=)([^=][^)]*)\)/);
      if (assignmentInCond) {
        issues.push({
          line: lineNum,
          snippet: line,
          category: 'logic',
          severity: 'error',
          message: `Single '=' used in condition. This performs an assignment rather than an equality comparison ('==').`,
          expected: trimmed.replace(/=([^=])/, '==$1'),
          actual: trimmed,
          suggestedFix: line.replace(/=([^=])/, '==$1')
        });
      }

      // ── Rule 4: Off-by-one: <= with zero-based loop ───────────────────────
      const offByOneFor = trimmed.match(/for\s*\(\s*([a-zA-Z0-9_]+)\s*=\s*0\s*;\s*\1\s*<=\s*([a-zA-Z0-9_]+)\s*;\s*\1\+\+\s*\)/);
      if (offByOneFor) {
        const loopVar = offByOneFor[1];
        const boundVar = offByOneFor[2];
        issues.push({
          line: lineNum,
          snippet: line,
          category: 'logic',
          severity: 'warning',
          message: `Potential off-by-one loop error with '<='. Zero-indexed arrays of size '${boundVar}' have indices from 0 to ${boundVar}-1. Using '<=' will execute ${boundVar}+1 times and access out-of-bounds index '${boundVar}'.`,
          expected: `for(${loopVar}=0; ${loopVar}<${boundVar}; ${loopVar}++)`,
          actual: trimmed,
          suggestedFix: line.replace(`${loopVar}<=${boundVar}`, `${loopVar}<${boundVar}`)
        });
      }

      // ── Rule 5: Non-zero loop start index ────────────────────────────────
      // e.g. "for (i=8; i<n; i++)" — skips first N elements
      const nonZeroStartFor = trimmed.match(
        /for\s*\(\s*([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*;\s*\1\s*<\s*([a-zA-Z0-9_]+)\s*;\s*\1\+\+\s*\)/
      );
      if (nonZeroStartFor && Number(nonZeroStartFor[2]) > 0) {
        const loopVar = nonZeroStartFor[1];
        const startValue = Number(nonZeroStartFor[2]);
        const boundVar = nonZeroStartFor[3];
        // Only flag if start ≥ 2 (start=1 can be intentional for second-element-onward loops)
        if (startValue >= 2) {
          issues.push({
            line: lineNum,
            snippet: line,
            category: 'logic',
            severity: 'error',
            message: `Loop starts at ${startValue} instead of 0, so it skips the first ${startValue} ${boundVar === 'n' ? 'processes/elements' : 'iterations'}.`,
            expected: `for(${loopVar}=0; ${loopVar}<${boundVar}; ${loopVar}++)`,
            actual: trimmed,
            suggestedFix: line.replace(`${loopVar}=${startValue}`, `${loopVar}=0`)
          });
        }
      }

      // ── Rule 6: Infinite loop without break ───────────────────────────────
      if (/while\s*\(\s*(1|true)\s*\)/.test(trimmed)) {
        let hasExit = false;
        for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
          if (/\b(break|return|exit)\b/.test(lines[j])) { hasExit = true; break; }
          if (lines[j].trim() === '}') { break; }
        }
        if (!hasExit) {
          issues.push({
            line: lineNum,
            snippet: line,
            category: 'logic',
            severity: 'error',
            message: 'Infinite loop detected with "while (1)" or "while (true)" without any "break" or "return" statement in the loop body.',
            expected: 'A terminating condition or loop exit mechanism (break / return)',
            actual: 'Infinite loop will freeze the program execution',
            suggestedFix: 'Ensure loop condition checks a terminating state or contains a break.'
          });
        }
      }

      // ── Rule 7: Undeclared variable use in C ──────────────────────────────
      // Detects: e = 0.9;  where 'e' was never declared
      if (isC && declaredVars.size > 0) {
        // Look for bare assignment: identifier = value; (not part of a typed decl)
        const bareAssign = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^=][^;]*);/);
        if (bareAssign) {
          const varName = bareAssign[1];
          const value = bareAssign[2].trim();
          // Skip keywords and well-known identifiers
          const skipKeywords = new Set(['return', 'if', 'else', 'for', 'while', 'break', 'continue']);
          if (!skipKeywords.has(varName) && !declaredVars.has(varName)) {
            // Infer suggested type from the assigned value
            let suggestedType = 'int';
            if (/\d+\.\d+f?/.test(value)) { suggestedType = 'float'; }
            else if (/\d+\.\d+/.test(value)) { suggestedType = 'double'; }
            else if (/".*"/.test(value)) { suggestedType = 'char*'; }
            else if (/'.'/.test(value)) { suggestedType = 'char'; }

            issues.push({
              line: lineNum,
              snippet: line,
              category: 'compile-time',
              severity: 'error',
              message: `Variable '${varName}' is undeclared. C requires all variables to be declared with a type before use.`,
              expected: `${suggestedType} ${varName} = ${value};`,
              actual: trimmed,
              suggestedFix: `Add '${suggestedType} ${varName} = ${value};' before this line, or change to '${suggestedType} ${varName} = ${value};' on a declaration line.`
            });
          }
        }
      }

      // ── Rule 8: printf format specifier mismatch (C only) ─────────────────
      // e.g. printf("%d", someFloat)  or printf("%f", someInt)
      if (isC) {
        const printfMatch = trimmed.match(/printf\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/);
        if (printfMatch) {
          const fmt = printfMatch[1];
          const argStr = printfMatch[2].trim();
          // Count format specifiers
          const specifiers = fmt.match(/%[dfscixXou%]/g) || [];
          const args = argStr.split(',').map(a => a.trim()).filter(Boolean);

          // Check for %d with a float/double variable name that was declared as float/double
          for (let si = 0; si < specifiers.length; si++) {
            const spec = specifiers[si];
            const arg = args[si];
            if (!arg) { break; }
            // If %d but variable is known to be float/double
            const isFloatVar = (() => {
              for (let j = 0; j < i; j++) {
                if (/\b(float|double)\b/.test(lines[j]) && new RegExp(`\\b${arg}\\b`).test(lines[j])) { return true; }
              }
              return false;
            })();
            if (spec === '%d' && isFloatVar) {
              issues.push({
                line: lineNum,
                snippet: line,
                category: 'logic',
                severity: 'warning',
                message: `Format specifier '%d' used for '${arg}' which appears to be declared as float/double. Use '%f' for floats or '%lf' for doubles.`,
                expected: trimmed.replace('%d', '%f'),
                actual: trimmed,
                suggestedFix: line.replace('%d', '%f')
              });
            }
          }
        }
      }

      // ── Rule 9: Python indentation mixing (tabs + spaces) ─────────────────
      if (isPython) {
        if (/^\t/.test(line) && source.includes('    ')) {
          issues.push({
            line: lineNum,
            snippet: line,
            category: 'syntax',
            severity: 'warning',
            message: 'Possible tab/space indentation mix. Python requires consistent indentation — use either tabs or 4 spaces throughout the file, not both.',
            expected: 'Consistent indentation (spaces recommended)',
            actual: 'Tab character at start of line mixed with space-indented file'
          });
        }
      }
      // ── Rule 10: Array index out of bounds (C only) ──────────────────────
      if (isC && declaredArrays.size > 0) {
        const isDeclLine = /^\s*(?:int|float|double|char|long|short|unsigned|bool|auto|const|static|void)\b/.test(trimmed);
        if (!isDeclLine) {
          const indexMatches = line.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*(\d+)\s*\]/g);
          for (const im of indexMatches) {
            const arrName = im[1];
            const idx = parseInt(im[2], 10);
            if (declaredArrays.has(arrName)) {
              const size = declaredArrays.get(arrName)!;
              if (idx >= size) {
                issues.push({
                  line: lineNum,
                  snippet: line,
                  category: 'logic',
                  severity: 'error',
                  message: `Array index out of bounds: accessing '${arrName}[${idx}]' on an array of size ${size}. Valid indices in C are 0 to ${size - 1}.`,
                  expected: `Index between 0 and ${size - 1}`,
                  actual: `${arrName}[${idx}]`,
                  suggestedFix: `Check index '${arrName}[${idx}]' — must be less than array size ${size}.`
                });
              }
            }
          }
        }
      }

      // ── Rule 11: Missing semicolon in C/C++ ───────────────────────────────
      if (isC) {
        if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
            !trimmed.endsWith(':') && !trimmed.endsWith(',') && !trimmed.endsWith('\\') &&
            !trimmed.startsWith('#')) {
          if (/^(?:return\s+[^;{}]+|printf\s*\(.*?\)|scanf\s*\(.*?\)|(?:int|float|double|char)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^;{}]+|[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^;{}]+)$/.test(trimmed)) {
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
            if (!nextLine.startsWith('+') && !nextLine.startsWith('-') && !nextLine.startsWith('*') && !nextLine.startsWith('/')) {
              issues.push({
                line: lineNum,
                snippet: line,
                category: 'compile-time',
                severity: 'error',
                message: `Missing semicolon ';' at the end of statement.`,
                expected: trimmed + ';',
                actual: trimmed,
                suggestedFix: trimmed + ';'
              });
            }
          }
        }
      }

      // ── Rule 12: Python missing colon on compound statements ──────────────
      if (isPython) {
        if (/^\s*(?:if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(line)) {
          if (!trimmed.endsWith(':') && !trimmed.endsWith('\\') && !trimmed.includes('#')) {
            issues.push({
              line: lineNum,
              snippet: line,
              category: 'syntax',
              severity: 'error',
              message: `Missing colon ':' at the end of '${trimmed.split(/\s+/)[0]}' statement. In Python, header statements must end with ':'.`,
              expected: trimmed + ':',
              actual: trimmed,
              suggestedFix: trimmed + ':'
            });
          }
        }
      }
    }

    return issues;
  }
}
