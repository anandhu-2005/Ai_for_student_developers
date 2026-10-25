import * as assert from 'assert';
import { ErrorDetector } from '../src/analysis/errorDetector';

describe('ErrorDetector', () => {
  it('should detect missing type specifier in C variable declaration (fcfs.c line 4)', () => {
    const code = `
#include<stdio.h>
int main() {
     i, n, bt[20], wt[20], tat[20];
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const typeIssue = issues.find(i => i.category === 'compile-time');
    assert.ok(typeIssue, 'Expected compile-time issue for missing type');
    assert.strictEqual(typeIssue!.line, 4);
    assert.ok(typeIssue!.message.includes('Missing type specifier'));
  });

  it('should detect uninitialized variable accumulation (wtavg += wt[i])', () => {
    const code = `
#include<stdio.h>
int main() {
    int i, n;
    float wtavg, tatavg;
    wtavg += 5;
    return 0;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const initIssue = issues.find(i => i.message.includes('wtavg') && i.message.includes('uninitialized'));
    assert.ok(initIssue, 'Expected uninitialized accumulation warning');
    assert.strictEqual(initIssue!.category, 'logic');
    assert.strictEqual(initIssue!.severity, 'error');
  });

  it('should detect assignment inside if condition (if (x = 5))', () => {
    const code = `
int x = 10;
if (x = 5) {
    printf("Oops");
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const assignIssue = issues.find(i => i.message.includes('Single \'=\''));
    assert.ok(assignIssue);
    assert.strictEqual(assignIssue!.category, 'logic');
  });

  it('should detect potential off-by-one loop index for <= bound', () => {
    const code = `
for (i = 0; i <= n; i++) {
    arr[i] = i;
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const loopIssue = issues.find(i => i.message.includes('off-by-one'));
    assert.ok(loopIssue);
    assert.strictEqual(loopIssue!.severity, 'warning');
  });

  it('should detect a loop that skips the first elements', () => {
    const source = `
      int i, n, bt[20], wt[20], tat[20];
      for(i=8; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
      }
    `;
    const issues = ErrorDetector.scan(source, 'c');
    const issue = issues.find(i => i.message.includes('skips the first 8'));
    assert.ok(issue);
    assert.strictEqual(issue?.category, 'logic');
    assert.strictEqual(issue?.severity, 'error');
  });

  it('should detect infinite loop with no break statement', () => {
    const code = `
while (1) {
    printf("Running forever\\n");
}
    `;
    const issues = ErrorDetector.scan(code, 'c');
    const infIssue = issues.find(i => i.message.includes('Infinite loop'));
    assert.ok(infIssue);
    assert.strictEqual(infIssue!.category, 'logic');
  });
});
