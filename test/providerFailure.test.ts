import * as assert from 'assert';
import { MockProvider } from '../src/providers/MockProvider';
import { OllamaProvider } from '../src/providers/OllamaProvider';
import { GeminiProvider } from '../src/providers/GeminiProvider';
import { ContextCollector } from '../src/analysis/contextCollector';

describe('AI Providers & Failure Handling', () => {
  it('MockProvider should return deterministic report for fcfs.c with purpose and bugs', async () => {
    const mock = new MockProvider();
    const conn = await mock.testConnection();
    assert.strictEqual(conn.success, true);

    const fcfsSource = `
#include<stdio.h>
int main() {
     i, n, bt[20], wt[20], tat[20];
    float wtavg, tatavg;
    for(i=1; i<n; i++) {
        wt[i] = wt[i-1] + bt[i-1];
        tat[i] = wt[i] + bt[i];
    }
    return 0;
}
    `;

    const ctx = ContextCollector.collectFromSource(fcfsSource, 'fcfs.c', 'c');
    const report = await mock.analyze({ context: ctx, mode: 'file' });

    assert.ok(report.programPurpose.purpose.includes('FCFS'));
    assert.strictEqual(report.overallVerdict, 'bugs_detected');
    assert.ok(report.findings.length >= 2);
    assert.ok(report.loopTrace !== undefined);
    assert.ok(report.suggestedFixes.length > 0);
    assert.ok(report.learningPoints.length > 0);
  });

  it('OllamaProvider should return helpful error message when Ollama is unreachable', async () => {
    // Port 59999 is intentionally unreachable
    const ollama = new OllamaProvider({ baseUrl: 'http://localhost:59999', timeoutMs: 1000 });
    const conn = await ollama.testConnection();

    assert.strictEqual(conn.success, false);
    assert.ok(conn.message.includes('Could not connect to Ollama') || conn.message.includes('timed out'));
  });

  it('GeminiProvider should fail gracefully when no API key is provided', async () => {
    const gemini = new GeminiProvider({ apiKey: '' });
    const conn = await gemini.testConnection();

    assert.strictEqual(conn.success, false);
    assert.ok(conn.message.includes('No Gemini API key configured'));

    // analyze() should throw descriptive error
    const ctx = ContextCollector.collectFromSource('int main(){}', 'main.c', 'c');
    await assert.rejects(
      async () => {
        await gemini.analyze({ context: ctx, mode: 'file' });
      },
      /Gemini API key is missing/
    );
  });
});

