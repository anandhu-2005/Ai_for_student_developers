import * as assert from 'assert';
import { ErrorDetector } from '../src/analysis/errorDetector';
import { RuntimeErrorParser } from '../src/analysis/runtimeErrorParser';
import { ReportValidator } from '../src/analysis/reportValidator';
import { MockProvider } from '../src/providers/MockProvider';
import { ContextCollector } from '../src/analysis/contextCollector';
import { OutputValidator } from '../src/analysis/outputValidator';

describe('Regression Tests: 13 Required Error Detection Scenarios', () => {

  // 1. Undeclared variable in C
  it('1. should detect undeclared variable in C (static & compiler diagnostic)', () => {
    const code = `
#include <stdio.h>
int main() {
    int a, b;
    e = 0.9;
    printf("%f", e);
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const undeclared = issues.find(i => i.message.includes("'e'") && i.message.includes('undeclared'));
    assert.ok(undeclared, 'Expected static detection for undeclared variable e');
    assert.strictEqual(undeclared!.line, 5);
    assert.ok(undeclared!.suggestedFix?.includes('float'));

    // Also test compiler error parsing
    const gccOutput = `main.c:5:5: error: 'e' undeclared (first use in this function)`;
    const parsed = RuntimeErrorParser.parse(gccOutput);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].lineNumber, 5);
    assert.ok(parsed[0].message.includes('undeclared'));
  });

  // 2. Missing type declaration
  it('2. should detect missing type declaration in C', () => {
    const code = `
int main() {
     i, n, bt[20], wt[20];
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const typeIssue = issues.find(i => i.message.includes('Missing type specifier'));
    assert.ok(typeIssue, 'Expected missing type specifier issue');
    assert.strictEqual(typeIssue!.line, 3);
    assert.strictEqual(typeIssue!.category, 'compile-time');
  });

  // 3. Missing semicolon
  it('3. should detect missing semicolon in C (static & compiler diagnostic)', () => {
    const code = `
int main() {
    int a = 5
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const semiIssue = issues.find(i => i.message.includes("Missing semicolon ';'"));
    assert.ok(semiIssue, 'Expected missing semicolon issue');
    assert.strictEqual(semiIssue!.line, 3);

    // Also test compiler error parsing
    const gccOutput = `main.c:3:5: error: expected ';' before 'return'`;
    const parsed = RuntimeErrorParser.parse(gccOutput);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].lineNumber, 3);
    assert.ok(parsed[0].message.includes("expected ';'"));
  });

  // 4. Array index out of bounds
  it('4. should detect array index out of bounds in C statically', () => {
    const code = `
int main() {
    int bt[10];
    bt[15] = 42;
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const oobIssue = issues.find(i => i.message.includes('out of bounds'));
    assert.ok(oobIssue, 'Expected array index out of bounds issue');
    assert.strictEqual(oobIssue!.line, 4);
    assert.ok(oobIssue!.message.includes('size 10'));
  });

  // 5. Assignment instead of comparison
  it('5. should detect assignment instead of comparison in if condition', () => {
    const code = `
int main() {
    int x = 10;
    if (x = 5) {
        printf("hello");
    }
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const assignIssue = issues.find(i => i.message.includes("Single '='"));
    assert.ok(assignIssue, "Expected assignment inside if condition issue");
    assert.strictEqual(assignIssue!.line, 4);
    assert.ok(assignIssue!.suggestedFix?.includes('=='));
  });

  // 6. Potentially uninitialized accumulator
  it('6. should detect potentially uninitialized accumulator', () => {
    const code = `
int main() {
    int i, n;
    float wtavg, tatavg;
    wtavg += 5;
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const uninitIssue = issues.find(i => i.message.includes('uninitialized') && i.message.includes('wtavg'));
    assert.ok(uninitIssue, 'Expected uninitialized accumulator issue');
    assert.strictEqual(uninitIssue!.line, 5);
    assert.strictEqual(uninitIssue!.category, 'logic');
  });

  // 7. Python syntax error
  it('7. should detect Python syntax error (missing colon and syntax parser)', () => {
    const code = `for i in range(8)\n    print("Hello")`;
    const issues = ErrorDetector.scan(code, 'python');
    const colonIssue = issues.find(i => i.message.includes("Missing colon ':'"));
    assert.ok(colonIssue, 'Expected missing colon on for statement');
    assert.strictEqual(colonIssue!.line, 1);

    // Python stderr format without traceback
    const pyOutput = `  File "simple.py", line 1\n    for i in range(8)\n                     ^\nSyntaxError: expected ':'`;
    const parsed = RuntimeErrorParser.parse(pyOutput);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, 'SyntaxError');
    assert.strictEqual(parsed[0].fileName, 'simple.py');
    assert.strictEqual(parsed[0].lineNumber, 1);
    assert.strictEqual(parsed[0].message, "expected ':'");
  });

  // 8. Python runtime exception
  it('8. should parse Python runtime exception traceback', () => {
    const pyTrace = `Traceback (most recent call last):\n  File "math_ops.py", line 15, in divide\n    return num / denom\nZeroDivisionError: division by zero`;
    const parsed = RuntimeErrorParser.parse(pyTrace);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, 'ZeroDivisionError');
    assert.strictEqual(parsed[0].fileName, 'math_ops.py');
    assert.strictEqual(parsed[0].lineNumber, 15);
    assert.strictEqual(parsed[0].message, 'division by zero');
  });

  // 9. JavaScript runtime exception
  it('9. should parse JavaScript runtime exception stack trace', () => {
    const nodeStack = `ReferenceError: result is not defined\n    at computeTotal (D:\\project\\app.js:22:9)\n    at Object.<anonymous> (D:\\project\\app.js:35:1)`;
    const parsed = RuntimeErrorParser.parse(nodeStack);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, 'ReferenceError');
    assert.strictEqual(parsed[0].fileName, 'app.js');
    assert.strictEqual(parsed[0].lineNumber, 22);
    assert.strictEqual(parsed[0].columnNumber, 9);
    assert.strictEqual(parsed[0].message, 'result is not defined');
  });

  // 10. A program with a logical error that exits with code 0
  it('10. should flag logical error in program that compiles and exits with code 0', () => {
    const code = `
int main() {
    int i, n = 5, bt[20], wt[20], tat[20];
    float wtavg, tatavg;
    for(i=8; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
    }
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const loopIssue = issues.find(i => i.message.includes('skips the first 8'));
    assert.ok(loopIssue, 'Expected logic issue for loop starting at i=8');
    assert.strictEqual(loopIssue!.category, 'logic');
    assert.strictEqual(loopIssue!.severity, 'error');
  });

  // 11. Correct code that should not receive a false error report
  it('11. should not report false errors on clean, correct code', async () => {
    const cleanCode = `
#include <stdio.h>
int sum(int a, int b) {
    return a + b;
}
int main() {
    int x = 5;
    int y = 10;
    int total = sum(x, y);
    if (total == 15) {
        printf("%d\\n", total);
    }
    return 0;
}
    `;
    const issues = ErrorDetector.scan(cleanCode, 'c');
    assert.strictEqual(issues.length, 0, 'Clean code should have 0 static issues');

    const mock = new MockProvider();
    const ctx = ContextCollector.collectFromSource(cleanCode, 'clean.c', 'c');
    const report = await mock.analyze({ context: ctx, mode: 'file' });
    assert.strictEqual(report.overallVerdict, 'likely_correct');
    assert.strictEqual(report.findings.length, 0);
  });

  // 12. Compiler output that cannot be parsed
  it('12. should handle unparseable compiler output gracefully', () => {
    const unparseable = `*** INTERNAL COMPILER PANIC: signal 11 ***\nProcess killed.`;
    const parsed = RuntimeErrorParser.parse(unparseable);
    assert.strictEqual(parsed.length, 0);

    // Format for prompt handles empty array safely
    const formatted = RuntimeErrorParser.formatForPrompt(parsed);
    assert.strictEqual(formatted, '');
  });

  // 13. AI timeout or malformed AI response
  it('13. should handle malformed AI response without throwing', () => {
    const malformed = 'Plain text response without any JSON format or braces.';
    const report = ReportValidator.validate(malformed, {
      fileName: 'test.py',
      languageId: 'python',
      totalLines: 10
    });

    assert.strictEqual(report.overallVerdict, 'cannot_determine');
    assert.ok(report.findings.length > 0);
    assert.strictEqual(report.fileName, 'test.py');
    assert.strictEqual(report.languageId, 'python');
  });

  // 14. Output validation for corrupted scheduling outputs
  it('14. should detect corrupted output with uninitialized memory in FCFS', () => {
    const output = `
Process Burst Waiting Turnaround
P0      4     0       4
P1      3     8       -2
P2      3     12258408 4199136
P3      3     4199136 12258408
P4      2     -2      12258408

Average Waiting Time: 3291510.00
Average Turnaround Time: 5743190.80
    `;
    const source = `
///FCFS CPU Scheduling Algorithm
#include<stdio.h>
int main() {
    int i, n = 5, bt[20], wt[20], tat[20];
    float wtavg, tatavg;
    for(i=8; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
    }
    return 0;
}
    `;
    const issues = OutputValidator.validate(output, source, 'c');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].type, 'garbage_values');
    assert.ok(issues[0].summary.includes('3291510.00'));
    assert.ok(issues[0].rootCause.includes('i=8'));
    assert.ok(issues[0].suggestedFix.includes('for(i=1; i<n; i++)'));
  });

  // 15. Output validation for NaN or Infinity
  it('15. should detect NaN or Infinity in calculation output', () => {
    const output = `Result is NaN. Processing halted.`;
    const source = `int main() { printf("Result is NaN"); }`;
    const issues = OutputValidator.validate(output, source, 'c');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].type, 'nan_or_infinity');
  });

});
