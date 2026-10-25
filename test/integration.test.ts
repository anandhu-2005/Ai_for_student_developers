import * as assert from 'assert';
import { ContextCollector } from '../src/analysis/contextCollector';
import { MockProvider } from '../src/providers/MockProvider';
import { PurposeDetector } from '../src/analysis/purposeDetector';
import { ErrorDetector } from '../src/analysis/errorDetector';
import { RuntimeErrorParser } from '../src/analysis/runtimeErrorParser';
import { LiveMonitor } from '../src/terminal/liveMonitor';

describe('Integration Scenarios & Acceptance Criteria', () => {
  const provider = new MockProvider();

  it('Scenario 1: Syntax error program analysis (fcfs.c with missing int)', async () => {
    const code = `
#include <stdio.h>
int main() {
     i, n; // missing int type
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    assert.ok(issues.some(i => i.category === 'compile-time' && i.line === 4));
  });

  it('Scenario 2: Runtime exception detection from Python traceback', async () => {
    const trace = `
Traceback (most recent call last):
  File "calculator.py", line 42, in divide
    return a / b
ZeroDivisionError: division by zero
    `;
    const parsed = RuntimeErrorParser.parse(trace);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, 'ZeroDivisionError');
    assert.strictEqual(parsed[0].lineNumber, 42);
  });

  it('Scenario 3: Off-by-one loop boundary diagnosis', async () => {
    const code = `
void printArray(int arr[], int n) {
    for (i = 0; i <= n; i++) {
        printf("%d\\n", arr[i]);
    }
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    assert.ok(issues.some(i => i.message.includes('off-by-one')));
  });

  it('Scenario 4: Incorrect algorithm / Purpose mismatch detection', async () => {
    const code = `
// Binary Search Algorithm
#include <stdio.h>
int main() {
    // Bubble sort logic instead of binary search
    for (int i=0; i<n; i++) {
        for (int j=0; j<n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                int temp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = temp;
            }
        }
    }
    return 0;
}
    `;
    const result = PurposeDetector.detect(code, 'search.c');
    assert.strictEqual(result.purpose.isMismatch, true);
    assert.strictEqual(result.purpose.source, 'mismatch_detected');
  });

  it('Scenario 5: Correct program with no identified issues', async () => {
    const cleanCode = `
// Linear Search Algorithm
int linearSearch(int arr[], int n, int key) {
    for (int i = 0; i < n; i++) {
        if (arr[i] == key) {
            return i;
        }
    }
    return -1;
}
    `;
    const issues = ErrorDetector.scan(cleanCode, 'c');
    assert.strictEqual(issues.length, 0);

    const ctx = ContextCollector.collectFromSource(cleanCode, 'linear_search.c', 'c');
    const report = await provider.analyze({ context: ctx, mode: 'file' });
    assert.strictEqual(report.overallVerdict, 'likely_correct');
    assert.strictEqual(report.findings.length, 0);
  });

  it('Scenario 6: Ambiguous program purpose handling', () => {
    const mysteriousCode = `
x = 10
y = 20
z = x + y
print(z)
    `;
    const result = PurposeDetector.detect(mysteriousCode, 'untitled');
    assert.strictEqual(result.purpose.source, 'unclear');
    assert.strictEqual(result.confidence, 'low');
    assert.ok(result.purpose.explanation.includes('Could not determine an explicit algorithm'));
  });

  it('Scenario 7: Suggested fix diff verification data check', async () => {
    const code = `
#include <stdio.h>
int main() {
     i, n, bt[20], wt[20], tat[20];
    float wtavg, tatavg;
    return 0;
}
    `;
    const ctx = ContextCollector.collectFromSource(code, 'fcfs.c', 'c');
    const report = await provider.analyze({ context: ctx, mode: 'file' });
    assert.ok(report.suggestedFixes.length > 0);
    const fix = report.suggestedFixes[0];
    assert.ok(fix.originalSnippet);
    assert.ok(fix.replacementSnippet);
    assert.ok(fix.explanation);
  });

  it('Scenario 8: Terminal tutor minimal card output formatting', async () => {
    const { TerminalTutor } = require('../src/terminal/terminalTutor');
    assert.strictEqual(typeof TerminalTutor.printMinimalCard, 'function');
  });
});

