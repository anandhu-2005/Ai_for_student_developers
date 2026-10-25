import * as assert from 'assert';
import { PurposeDetector } from '../src/analysis/purposeDetector';

describe('PurposeDetector', () => {
  it('should detect explicit purpose from header comment with priority', () => {
    const code = `
// Round Robin CPU Scheduling Algorithm
#include <stdio.h>
int main() {
    int quantum = 2;
    return 0;
}
    `;
    const res = PurposeDetector.detect(code, 'roundrobin.c');
    assert.strictEqual(res.purpose.source, 'explicit_comment');
    assert.ok(res.purpose.purpose.includes('Round Robin'));
    assert.strictEqual(res.purpose.isMismatch, false);
    assert.strictEqual(res.confidence, 'high');
  });

  it('should detect FCFS purpose from Python comment', () => {
    const code = `
# FCFS CPU Scheduling
processes = [1, 2, 3]
burst_time = [5, 4, 3]
    `;
    const res = PurposeDetector.detect(code, 'test.py');
    assert.strictEqual(res.purpose.source, 'explicit_comment');
    assert.ok(res.purpose.purpose.includes('FCFS'));
  });

  it('should infer purpose from code structure when no comment exists', () => {
    const code = `
#include <stdio.h>
int main() {
    int wt[20], bt[20], tat[20], n = 3, i;
    for(i=1; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
        tat[i] = wt[i] + bt[i];
    }
    return 0;
}
    `;
    const res = PurposeDetector.detect(code, 'scheduling.c');
    assert.strictEqual(res.purpose.source, 'inferred_code');
    assert.ok(res.purpose.purpose.includes('FCFS'));
    assert.strictEqual(res.purpose.isMismatch, false);
  });

  it('should detect mismatch when comment claims one algorithm but code is another', () => {
    const code = `
// Binary Search Algorithm
#include <stdio.h>
int main() {
    int wt[20], bt[20], tat[20], n = 3, i;
    for(i=1; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
        tat[i] = wt[i] + bt[i];
    }
    return 0;
}
    `;
    const res = PurposeDetector.detect(code, 'search.c');
    assert.strictEqual(res.purpose.source, 'mismatch_detected');
    assert.strictEqual(res.purpose.isMismatch, true);
    assert.ok(res.purpose.explanation.includes('mismatch') || res.purpose.explanation.includes('diverge'));
  });

  it('should handle general utility program with no textbook algorithm', () => {
    const code = `
const fs = require('fs');
console.log("Renaming files...");
    `;
    const res = PurposeDetector.detect(code, 'rename-tool.js');
    assert.strictEqual(res.purpose.source, 'inferred_code');
    assert.ok(res.purpose.purpose.includes('rename tool'));
  });
});

