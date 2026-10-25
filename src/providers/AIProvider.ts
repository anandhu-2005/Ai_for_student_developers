import { AnalysisRequest, ConnectionStatus, AIProvider } from '../types/provider';
import { DebuggingReport } from '../types/analysis';

export abstract class BaseAIProvider implements AIProvider {
  public abstract readonly id: string;
  public abstract readonly displayName: string;

  public abstract analyze(request: AnalysisRequest): Promise<DebuggingReport>;
  public abstract testConnection(): Promise<ConnectionStatus>;

  /**
   * Fast, concise system prompt tailored for rapid terminal feedback.
   */
  protected buildSystemPrompt(): string {
    return `You are "AI Error Checklister", a direct, concise debugging tutor for students.
Your mission: Help the student instantly understand what broke, why, and how to fix it, so they can get back to coding immediately.

CRITICAL RULES:
1. Always identify the program's INTENDED PURPOSE first from comments/code structure.
2. Be extremely concise. Keep explanations to 1-2 direct sentences. NO long essays.
3. Provide the exact line number, root cause, and quick one-line fix whenever known.
4. Prefer one high-confidence diagnosis over several speculative suggestions. If the exact line or root cause is uncertain, state that honestly rather than inventing details.
5. Do NOT blindly accept heuristic or static analysis flags. Validate them against the code; reject them if they are false alarms.
6. When no runtime error occurred (exit code 0) and behavior is ambiguous, classify verdict as "potential_issues" rather than confirmed errors.
7. Explain one relevant programming concept in a single crisp sentence.
8. Output ONLY a valid JSON object matching this schema:

{
  "programPurpose": {
    "purpose": "Precise algorithm/task goal (e.g. FCFS CPU Scheduling)",
    "source": "explicit_comment | inferred_code | mismatch_detected | user_specified",
    "explanation": "Brief 1-sentence explanation of purpose",
    "isMismatch": false
  },
  "overallVerdict": "bugs_detected | likely_correct | potential_issues",
  "verdictSummary": "1-sentence summary of the main problem",
  "findings": [
    {
      "issueNumber": 1,
      "category": "compile-time | runtime | logic | syntax",
      "severity": "error",
      "lineNumber": 4,
      "codeSnippet": "Offending code line",
      "expectedBehavior": "What should have been written",
      "actualBehavior": "What was actually written / caused crash",
      "explanation": "1-sentence root cause explanation",
      "suggestedCorrection": "Exact one-line replacement fix"
    }
  ],
  "logicExplanation": "2-3 bullet points on how execution proceeded",
  "suggestedFixes": [
    {
      "id": "fix_1",
      "description": "Short fix title",
      "originalSnippet": "Broken snippet",
      "replacementSnippet": "Fixed snippet",
      "explanation": "Why this fixes the issue"
    }
  ],
  "verificationChecklist": [
    {
      "step": "Test with input X",
      "testInput": "Sample input",
      "expectedOutput": "Expected output"
    }
  ],
  "learningPoints": [
    {
      "concept": "Core Concept Name",
      "explanation": "1 sentence on why this rule exists",
      "takeaway": "Actionable rule of thumb"
    }
  ],
  "assumptions": [],
  "limitations": [],
  "confidence": "high"
}`;
  }

  protected buildUserPrompt(request: AnalysisRequest): string {
    const ctx = request.context;
    const lines = ctx.fullSource.split(/\r?\n/).length;

    let prompt = `File: ${ctx.fileName} (${ctx.languageId}, ${lines} lines)\n`;

    if (ctx.detectedPurpose) {
      prompt += `Preliminary detected purpose: "${ctx.detectedPurpose.purpose}" (Source: ${ctx.detectedPurpose.source})\n\n`;
    }

    // Parsed compiler or runtime diagnostics (highest priority, verified from compiler/interpreter)
    if (ctx.parsedRuntimeErrors && ctx.parsedRuntimeErrors.length > 0) {
      prompt += `PARSED COMPILER/RUNTIME ERRORS (verified from compiler/interpreter output):\n`;
      ctx.parsedRuntimeErrors.forEach((err, idx) => {
        const loc = err.lineNumber ? ` (Line ${err.lineNumber}${err.columnNumber ? ':' + err.columnNumber : ''})` : '';
        prompt += `  ${idx + 1}. [${err.type}]${loc}: ${err.message}\n`;
      });
      prompt += '\n';
    }

    // Static heuristic flags (for AI verification)
    if (ctx.staticHeuristicErrors && ctx.staticHeuristicErrors.length > 0) {
      prompt += `STATIC HEURISTIC FLAGS (verify these against the code; reject if false alarm):\n`;
      ctx.staticHeuristicErrors.forEach((err, idx) => {
        prompt += `  ${idx + 1}. ${err}\n`;
      });
      prompt += '\n';
    }

    if (ctx.terminalOutput) {
      prompt += `Raw Terminal Output / Error:\n\`\`\`\n${ctx.terminalOutput.trim().slice(-1000)}\n\`\`\`\n\n`;
    }

    if (request.mode === 'selection' && ctx.selectedText) {
      prompt += `Selected Code:\n\`\`\`${ctx.languageId}\n${ctx.selectedText}\n\`\`\`\n\n`;
    }

    prompt += `Source Code:\n\`\`\`${ctx.languageId}\n${ctx.fullSource.slice(0, 2500)}\n\`\`\`\n\n`;

    if (ctx.diagnostics.length > 0) {
      prompt += `VS Code Language Diagnostics: ${ctx.diagnostics.map(d => `Line ${d.line}: ${d.message}`).join('; ')}\n`;
    }

    prompt += `\nProvide a rapid, laser-focused diagnosis in JSON format. Explain the most likely root cause, provide a minimal correction, and teach one relevant concept.`;
    return prompt;
  }
}
