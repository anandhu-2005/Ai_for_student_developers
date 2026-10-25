import { 
  DebuggingReport, 
  RawAIReport, 
  Finding, 
  SuggestedFix, 
  VerificationItem, 
  LearningPoint, 
  VerdictStatus, 
  IssueCategory, 
  IssueSeverity, 
  LoopTrace,
  ProgramPurpose
} from '../types/analysis';
import { StaticCodeIssue } from './errorDetector';
import type { CodeDiagnostic } from './diagnostics';

export class ReportValidator {
  /**
   * Safely parses raw string from AI and validates it against the schema.
   * Resilient to partial JSON, markdown text, or truncated outputs.
   */
  public static validate(
    rawText: string,
    fallbackContext: {
      fileName: string;
      filePath?: string;
      languageId: string;
      totalLines: number;
      detectedPurpose?: ProgramPurpose;
      staticIssues?: StaticCodeIssue[];
      diagnostics?: CodeDiagnostic[];
    }
  ): DebuggingReport {
    const parsed: RawAIReport = this.extractAndParseJson(rawText, fallbackContext.detectedPurpose);

    // 1. Validate Program Purpose
    const purpose = this.validatePurpose(parsed.programPurpose, fallbackContext.detectedPurpose);

    // 2. Validate Overall Verdict
    const { verdict, summary } = this.validateVerdict(parsed.overallVerdict, parsed.verdictSummary);

    // 3. Validate Findings & clamp line numbers
    const aiFindings = this.validateFindings(parsed.findings, fallbackContext.totalLines, fallbackContext.fileName);
    const findings = this.mergeDirectFindings(
      aiFindings,
      fallbackContext.staticIssues || [],
      fallbackContext.diagnostics || [],
      fallbackContext.fileName,
      fallbackContext.totalLines
    );

    // 4. Validate Logic Explanation & Loop Trace
    const logicExplanation = parsed.logicExplanation?.trim() || 'No additional explanation needed.';
    const loopTrace = this.validateLoopTrace(parsed.loopTrace);

    // 5. Validate Suggested Fixes
    const suggestedFixes = this.validateSuggestedFixes(parsed.suggestedFixes, fallbackContext.fileName);

    // 6. Validate Verification Checklist
    const verificationChecklist = this.validateVerificationChecklist(parsed.verificationChecklist);

    // 7. Validate Learning Points
    const learningPoints = this.validateLearningPoints(parsed.learningPoints);

    // 8. Validate Limitations & Confidence
    const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [];
    const limitations = Array.isArray(parsed.limitations) ? parsed.limitations.map(String) : [];
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (parsed.confidence === 'medium' || parsed.confidence === 'low') {
      confidence = parsed.confidence;
    }

    return {
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      fileName: fallbackContext.fileName,
      filePath: fallbackContext.filePath,
      languageId: fallbackContext.languageId,
      programPurpose: purpose,
      overallVerdict: verdict === 'cannot_determine'
        ? 'cannot_determine'
        : findings.some(f => f.severity === 'error')
          ? 'bugs_detected'
          : findings.length > 0
            ? 'potential_issues'
            : verdict,
      verdictSummary: findings.length > aiFindings.length
        ? `${summary} Direct checks also found ${findings.length - aiFindings.length} issue(s) in the source.`
        : summary,
      findings,
      logicExplanation,
      loopTrace,
      suggestedFixes,
      verificationChecklist,
      learningPoints,
      assumptions,
      limitations,
      confidence
    };
  }

  private static mergeDirectFindings(
    aiFindings: Finding[],
    staticIssues: StaticCodeIssue[],
    diagnostics: CodeDiagnostic[],
    fileName: string,
    totalLines: number
  ): Finding[] {
    const directFindings: Finding[] = [
      ...staticIssues.map(issue => ({
        issueNumber: 0,
        category: issue.category as IssueCategory,
        severity: issue.severity as IssueSeverity,
        filePath: fileName,
        lineNumber: issue.line > 0 && issue.line <= totalLines ? issue.line : undefined,
        codeSnippet: issue.snippet.trim(),
        expectedBehavior: issue.expected,
        actualBehavior: issue.actual,
        explanation: issue.message,
        suggestedCorrection: issue.suggestedFix,
        isVerified: true
      })),
      ...diagnostics.map(diagnostic => ({
        issueNumber: 0,
        category: 'compile-time' as IssueCategory,
        severity: diagnostic.severity as IssueSeverity,
        filePath: fileName,
        lineNumber: diagnostic.line > 0 && diagnostic.line <= totalLines ? diagnostic.line : undefined,
        expectedBehavior: 'Code passes the language service check',
        actualBehavior: diagnostic.message,
        explanation: diagnostic.message,
        isVerified: true
      }))
    ];

    const merged = [...aiFindings];
    for (const direct of directFindings) {
      const duplicate = merged.some(existing =>
        existing.lineNumber === direct.lineNumber &&
        existing.category === direct.category &&
        (existing.explanation === direct.explanation || existing.actualBehavior === direct.actualBehavior)
      );
      if (!duplicate) {
        merged.push({ ...direct, issueNumber: merged.length + 1 });
      }
    }
    return merged.map((finding, index) => ({ ...finding, issueNumber: index + 1 }));
  }

  public static extractAndParseJson(rawText: string, fallbackPurpose?: ProgramPurpose): RawAIReport {
    let clean = rawText.trim();

    // If completely non-JSON text
    if (!clean.includes('{')) {
      return {
        programPurpose: fallbackPurpose || {
          purpose: 'Program Execution',
          source: 'unclear',
          explanation: 'Could not parse structured purpose from unformatted text.',
          isMismatch: false
        },
        overallVerdict: 'cannot_determine',
        verdictSummary: 'AI returned unformatted response.',
        findings: [
          {
            issueNumber: 1,
            category: 'logic',
            severity: 'warning',
            explanation: rawText.slice(0, 300)
          }
        ]
      };
    }

    // Remove markdown code fences if present
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      clean = fenceMatch[1].trim();
    } else {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
    }

    // 1. Try standard JSON parse
    try {
      return JSON.parse(clean);
    } catch (e) {
      // 2. Try simple JSON repair (close unclosed quotes & braces)
      try {
        let repaired = clean;
        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;
        const quotes = (repaired.match(/"/g) || []).length;

        if (quotes % 2 !== 0) {
          repaired += '"';
        }
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repaired += ']';
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          repaired += '}';
        }

        return JSON.parse(repaired);
      } catch (err2) {
        // 3. Robust Regex Extraction fallback - NEVER FAILS!
        return this.regexExtractReport(rawText, fallbackPurpose);
      }
    }
  }

  /**
   * Resilient regex extractor that pulls structured fields out of ANY AI output (truncated or plain text).
   */
  private static regexExtractReport(text: string, fallbackPurpose?: ProgramPurpose): RawAIReport {
    const purposeMatch = text.match(/"purpose":\s*"([^"]+)"/i) || text.match(/Purpose:\s*([^\r\n]+)/i);
    const lineMatch = text.match(/"lineNumber":\s*(\d+)/i) || text.match(/Line\s*(\d+)/i);
    const explanationMatch = text.match(/"explanation":\s*"([^"]+)"/i) || text.match(/Why:?\s*([^\r\n]+)/i);
    const fixMatch = text.match(/"suggestedCorrection":\s*"([^"]+)"/i) || text.match(/Fix:?\s*([^\r\n]+)/i);
    const expectedMatch = text.match(/"expectedBehavior":\s*"([^"]+)"/i) || text.match(/Expected:?\s*([^\r\n]+)/i);
    const actualMatch = text.match(/"actualBehavior":\s*"([^"]+)"/i) || text.match(/Actual:?\s*([^\r\n]+)/i);
    const conceptMatch = text.match(/"concept":\s*"([^"]+)"/i) || text.match(/Concept:?\s*([^\r\n]+)/i);
    const summaryMatch = text.match(/"verdictSummary":\s*"([^"]+)"/i) || text.match(/Summary:?\s*([^\r\n]+)/i);

    const findings: any[] = [];
    if (explanationMatch || lineMatch || fixMatch) {
      findings.push({
        issueNumber: 1,
        category: 'compile-time',
        severity: 'error',
        lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        explanation: explanationMatch ? explanationMatch[1].trim() : 'Error identified in source execution.',
        expectedBehavior: expectedMatch ? expectedMatch[1].trim() : 'Correct syntax and type declarations',
        actualBehavior: actualMatch ? actualMatch[1].trim() : 'Compiler error or runtime crash',
        suggestedCorrection: fixMatch ? fixMatch[1].trim() : undefined
      });
    }

    const suggestedFixes: any[] = [];
    if (fixMatch) {
      suggestedFixes.push({
        id: 'fix_1',
        description: 'Apply quick correction',
        replacementSnippet: fixMatch[1].trim(),
        explanation: explanationMatch ? explanationMatch[1].trim() : 'Applies recommended fix.'
      });
    }

    const learningPoints: any[] = [];
    if (conceptMatch) {
      learningPoints.push({
        concept: conceptMatch[1].trim(),
        explanation: explanationMatch ? explanationMatch[1].trim() : '',
        takeaway: fixMatch ? `Use: ${fixMatch[1].trim()}` : 'Verify syntax declarations.'
      });
    }

    return {
      programPurpose: {
        purpose: purposeMatch ? purposeMatch[1].trim() : (fallbackPurpose?.purpose || 'Program Execution'),
        source: fallbackPurpose?.source || 'explicit_comment',
        explanation: 'Identified intended purpose of the program.',
        isMismatch: Boolean(fallbackPurpose?.isMismatch)
      },
      overallVerdict: findings.length > 0 ? 'bugs_detected' : 'cannot_determine',
      verdictSummary: summaryMatch ? summaryMatch[1].trim() : (explanationMatch ? explanationMatch[1].trim() : 'AI returned unformatted response.'),
      findings,
      suggestedFixes,
      learningPoints
    };
  }

  private static validatePurpose(
    rawPurpose?: RawAIReport['programPurpose'],
    detectedPurpose?: ProgramPurpose
  ): ProgramPurpose {
    if (rawPurpose?.purpose && rawPurpose.purpose.trim()) {
      const validSources = ['explicit_comment', 'inferred_code', 'mismatch_detected', 'user_specified', 'unclear'];
      const source = validSources.includes(rawPurpose.source || '') 
        ? (rawPurpose.source as any) 
        : (detectedPurpose?.source || 'inferred_code');

      return {
        purpose: rawPurpose.purpose.trim().replace(/^\/+/, ''), // Clean any leading slash
        source,
        explanation: rawPurpose.explanation?.trim() || detectedPurpose?.explanation || 'Program purpose identified.',
        isMismatch: Boolean(rawPurpose.isMismatch || detectedPurpose?.isMismatch),
        algorithmName: rawPurpose.algorithmName || detectedPurpose?.algorithmName
      };
    }

    if (detectedPurpose) {
      return detectedPurpose;
    }

    return {
      purpose: 'General Program Logic',
      source: 'unclear',
      explanation: 'General script functionality.',
      isMismatch: false
    };
  }

  private static validateVerdict(rawVerdict?: string, rawSummary?: string): { verdict: VerdictStatus; summary: string } {
    let verdict: VerdictStatus = 'bugs_detected';
    if (rawVerdict === 'cannot_determine') {
      verdict = 'cannot_determine';
    } else if (rawVerdict?.includes('correct')) {
      verdict = 'likely_correct';
    } else if (rawVerdict?.includes('potential')) {
      verdict = 'potential_issues';
    }

    const summary = rawSummary?.trim() || (
      verdict === 'likely_correct' 
        ? 'Code appears correct.'
        : verdict === 'cannot_determine'
        ? 'AI returned unformatted response.'
        : 'Bug identified in execution.'
    );

    return { verdict, summary };
  }

  private static validateFindings(rawFindings: RawAIReport['findings'], totalLines: number, fileName: string): Finding[] {
    if (!Array.isArray(rawFindings)) {
      return [];
    }

    return rawFindings.map((f, idx) => {
      let lineNumber: number | undefined;
      if (typeof f.lineNumber === 'number' && !isNaN(f.lineNumber)) {
        lineNumber = (f.lineNumber > 0 && f.lineNumber <= totalLines) 
          ? f.lineNumber 
          : (totalLines > 0 ? totalLines : undefined);
      }

      return {
        issueNumber: f.issueNumber || idx + 1,
        category: (f.category as any) || 'compile-time',
        severity: (f.severity as any) || 'error',
        filePath: f.filePath || fileName,
        lineNumber,
        codeSnippet: f.codeSnippet?.trim(),
        expectedBehavior: f.expectedBehavior?.trim() || 'Correct statement',
        actualBehavior: f.actualBehavior?.trim() || 'Syntax error or runtime exception',
        explanation: f.explanation?.trim() || 'Issue detected.',
        suggestedCorrection: f.suggestedCorrection?.trim(),
        isVerified: lineNumber !== undefined
      };
    });
  }

  private static validateLoopTrace(rawTrace?: RawAIReport['loopTrace']): LoopTrace | undefined {
    if (!rawTrace || !Array.isArray(rawTrace.rows) || rawTrace.rows.length === 0) {
      return undefined;
    }

    const headers = Array.isArray(rawTrace.headers) && rawTrace.headers.length > 0
      ? rawTrace.headers
      : ['Iteration', 'Vars Before', 'Condition', 'Operation', 'Vars After', 'Output'];

    return {
      title: rawTrace.title || 'Step-by-Step Loop Execution Trace',
      headers,
      rows: rawTrace.rows.map((r, idx) => ({
        iteration: r.iteration !== undefined ? r.iteration : idx + 1,
        varsBefore: r.varsBefore || '-',
        condition: r.condition || '-',
        operation: r.operation || '-',
        varsAfter: r.varsAfter || '-',
        output: r.output || '-'
      })),
      notes: rawTrace.notes,
      isIllustrative: true
    };
  }

  private static validateSuggestedFixes(rawFixes: RawAIReport['suggestedFixes'], fileName: string): SuggestedFix[] {
    if (!Array.isArray(rawFixes)) {
      return [];
    }

    return rawFixes.map((fix, idx) => ({
      id: fix.id || `fix_${idx + 1}`,
      description: fix.description?.trim() || `Correction #${idx + 1}`,
      originalSnippet: fix.originalSnippet?.trim(),
      replacementSnippet: fix.replacementSnippet?.trim(),
      fullPatchedCode: fix.fullPatchedCode?.trim(),
      filePath: fix.filePath || fileName,
      explanation: fix.explanation?.trim() || 'Recommended fix.'
    }));
  }

  private static validateVerificationChecklist(rawList: RawAIReport['verificationChecklist']): VerificationItem[] {
    if (!Array.isArray(rawList)) {
      return [];
    }

    return rawList.map((item, idx) => ({
      step: item.step?.trim() || `Step ${idx + 1}`,
      testInput: item.testInput?.trim(),
      expectedOutput: item.expectedOutput?.trim()
    }));
  }

  private static validateLearningPoints(rawPoints: RawAIReport['learningPoints']): LearningPoint[] {
    if (!Array.isArray(rawPoints)) {
      return [];
    }

    return rawPoints.map(p => ({
      concept: p.concept?.trim() || 'Programming Principle',
      explanation: p.explanation?.trim() || '',
      takeaway: p.takeaway?.trim() || 'Check syntax and variables.'
    }));
  }
}
