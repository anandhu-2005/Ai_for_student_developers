import * as assert from 'assert';
import { ReportValidator } from '../src/analysis/reportValidator';

describe('ReportValidator', () => {
  it('should parse valid JSON report with all 8 sections', () => {
    const raw = JSON.stringify({
      programPurpose: {
        purpose: 'Binary Search Algorithm',
        source: 'explicit_comment',
        explanation: 'Searches for target in sorted array.'
      },
      overallVerdict: 'bugs_detected',
      verdictSummary: 'Off-by-one error found in loop condition.',
      findings: [
        {
          issueNumber: 1,
          category: 'logic',
          severity: 'error',
          lineNumber: 12,
          codeSnippet: 'while (low < high)',
          expectedBehavior: 'while (low <= high)',
          actualBehavior: 'Excludes high element',
          explanation: 'When low equals high, the single remaining element is not checked.'
        }
      ],
      logicExplanation: 'Splits search space in half repeatedly.',
      loopTrace: {
        title: 'Binary Search Trace',
        headers: ['Iter', 'Low', 'High', 'Mid', 'Target', 'Action'],
        rows: [
          { iteration: 1, varsBefore: 'low=0, high=4', condition: '0 <= 4', operation: 'mid=2', varsAfter: 'low=3', output: '-' }
        ]
      },
      suggestedFixes: [
        {
          id: 'fix_1',
          description: 'Fix while condition to check boundary',
          originalSnippet: 'while (low < high)',
          replacementSnippet: 'while (low <= high)',
          explanation: 'Ensures target at high index is evaluated.'
        }
      ],
      verificationChecklist: [
        { step: 'Test when target is last element in array', testInput: '[1,3,5,7,9], target=9', expectedOutput: 'Index 4' }
      ],
      learningPoints: [
        { concept: 'Boundary Invariants', explanation: 'Loop invariants define valid search bounds.', takeaway: 'Double-check <= vs < in binary searches.' }
      ],
      assumptions: ['Array is pre-sorted in ascending order.'],
      limitations: ['Does not handle duplicate elements uniquely.'],
      confidence: 'high'
    });

    const report = ReportValidator.validate(raw, {
      fileName: 'binary_search.py',
      languageId: 'python',
      totalLines: 30
    });

    assert.strictEqual(report.programPurpose.purpose, 'Binary Search Algorithm');
    assert.strictEqual(report.overallVerdict, 'bugs_detected');
    assert.strictEqual(report.findings.length, 1);
    assert.strictEqual(report.findings[0].lineNumber, 12);
    assert.strictEqual(report.suggestedFixes.length, 1);
    assert.strictEqual(report.verificationChecklist.length, 1);
    assert.strictEqual(report.learningPoints.length, 1);
    assert.strictEqual(report.confidence, 'high');
  });

  it('should clamp line numbers exceeding total line count', () => {
    const raw = JSON.stringify({
      programPurpose: { purpose: 'Test' },
      overallVerdict: 'bugs_detected',
      findings: [
        {
          issueNumber: 1,
          category: 'logic',
          severity: 'error',
          lineNumber: 999, // Exceeds 25 lines
          explanation: 'Out of bounds line test'
        }
      ]
    });

    const report = ReportValidator.validate(raw, {
      fileName: 'test.c',
      languageId: 'c',
      totalLines: 25
    });

    assert.strictEqual(report.findings[0].lineNumber, 25);
  });

  it('should handle markdown code fences around JSON safely', () => {
    const raw = "Here is your report:\n```json\n" + JSON.stringify({
      programPurpose: { purpose: 'Quick Sort' },
      overallVerdict: 'likely_correct',
      findings: []
    }) + "\n```\nHope this helps!";

    const report = ReportValidator.validate(raw, {
      fileName: 'quicksort.py',
      languageId: 'python',
      totalLines: 50
    });

    assert.strictEqual(report.programPurpose.purpose, 'Quick Sort');
    assert.strictEqual(report.overallVerdict, 'likely_correct');
  });

  it('should produce graceful fallback report when AI outputs non-JSON garbage', () => {
    const raw = "I am an AI and I cannot generate JSON today, but your code has an error on line 5.";

    const report = ReportValidator.validate(raw, {
      fileName: 'sample.js',
      languageId: 'javascript',
      totalLines: 10
    });

    assert.strictEqual(report.overallVerdict, 'cannot_determine');
    assert.ok(report.findings.length > 0);
    assert.ok(report.verdictSummary.includes('AI returned unformatted response'));
  });

  it('should preserve direct static issues even when AI reports no findings', () => {
    const report = ReportValidator.validate(JSON.stringify({
      programPurpose: { purpose: 'C program' },
      overallVerdict: 'likely_correct',
      findings: []
    }), {
      fileName: 'sample.c',
      languageId: 'c',
      totalLines: 5,
      staticIssues: [{
        line: 3,
        snippet: 'x += 1;',
        category: 'logic',
        severity: 'error',
        message: 'Variable x is uninitialized.',
        expected: 'x initialized to 0',
        actual: 'Accumulating into uninitialized x'
      }]
    });

    assert.strictEqual(report.overallVerdict, 'bugs_detected');
    assert.strictEqual(report.findings.length, 1);
    assert.strictEqual(report.findings[0].lineNumber, 3);
    assert.strictEqual(report.findings[0].isVerified, true);
  });
});
