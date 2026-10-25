import * as assert from 'assert';
import { RuntimeErrorParser } from '../src/analysis/runtimeErrorParser';

describe('RuntimeErrorParser', () => {
  it('should parse Python traceback and extract exact error type and line', () => {
    const output = `
Traceback (most recent call last):
  File "scheduler.py", line 18, in calculate_wait
    current_wt = wt[i - 1] + bt[i - 1]
IndexError: list index out of range
    `;

    const errors = RuntimeErrorParser.parse(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].type, 'IndexError');
    assert.strictEqual(errors[0].message, 'list index out of range');
    assert.strictEqual(errors[0].fileName, 'scheduler.py');
    assert.strictEqual(errors[0].lineNumber, 18);
  });

  it('should parse Node.js exception stack trace', () => {
    const output = `
TypeError: Cannot read properties of undefined (reading 'length')
    at computeAverage (D:\\dev\\calc.js:14:22)
    at Object.<anonymous> (D:\\dev\\calc.js:29:1)
    `;

    const errors = RuntimeErrorParser.parse(output);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].type, 'TypeError');
    assert.strictEqual(errors[0].message, "Cannot read properties of undefined (reading 'length')");
    assert.strictEqual(errors[0].fileName, 'calc.js');
    assert.strictEqual(errors[0].lineNumber, 14);
    assert.strictEqual(errors[0].columnNumber, 22);
  });

  it('should parse GCC / Clang compiler error and warning diagnostics', () => {
    const output = `
fcfs.c:4:6: error: expected identifier or '(' before numeric constant
fcfs.c:28:9: warning: 'wtavg' may be used uninitialized in this function [-Wmaybe-uninitialized]
    `;

    const errors = RuntimeErrorParser.parse(output);
    assert.strictEqual(errors.length, 2);
    assert.strictEqual(errors[0].type, 'Compiler ERROR');
    assert.strictEqual(errors[0].fileName, 'fcfs.c');
    assert.strictEqual(errors[0].lineNumber, 4);
    assert.strictEqual(errors[1].type, 'Compiler WARNING');
    assert.strictEqual(errors[1].lineNumber, 28);
  });
});

