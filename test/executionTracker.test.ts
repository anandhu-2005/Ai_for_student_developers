import * as assert from 'assert';
import { ExecutionTracker } from '../src/terminal/executionTracker';

describe('ExecutionTracker', () => {
  beforeEach(() => {
    ExecutionTracker.clear();
  });

  it('should store last execution and retrieve it', () => {
    const record = ExecutionTracker.recordExecution({
      command: 'python app.py',
      output: 'Traceback: ZeroDivisionError',
      exitCode: 1,
      filePath: 'd:\\app.py'
    });

    assert.ok(record.id.startsWith('exec_'));
    const last = ExecutionTracker.getLastExecution();
    assert.ok(last);
    assert.strictEqual(last.command, 'python app.py');
    assert.strictEqual(last.exitCode, 1);
  });

  it('should notify execution listeners on new run', () => {
    let notified = false;
    const unsubscribe = ExecutionTracker.onExecution(rec => {
      if (rec.command === 'node server.js') {
        notified = true;
      }
    });

    ExecutionTracker.recordExecution({
      command: 'node server.js',
      output: 'Server started',
      exitCode: 0
    });

    assert.strictEqual(notified, true);
    unsubscribe();
  });
});

