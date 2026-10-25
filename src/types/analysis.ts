export type PurposeSource = 
  | 'explicit_comment' 
  | 'inferred_code' 
  | 'mismatch_detected' 
  | 'user_specified' 
  | 'unclear';

export interface ProgramPurpose {
  purpose: string;
  source: PurposeSource;
  explanation: string;
  isMismatch: boolean;
  algorithmName?: string;
}

export type VerdictStatus = 
  | 'likely_correct' 
  | 'bugs_detected' 
  | 'potential_issues' 
  | 'cannot_determine';

export type IssueCategory = 
  | 'syntax' 
  | 'compile-time' 
  | 'runtime' 
  | 'logic' 
  | 'algorithm' 
  | 'performance' 
  | 'code-quality';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface Finding {
  issueNumber: number;
  category: IssueCategory;
  severity: IssueSeverity;
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
  expectedBehavior: string;
  actualBehavior: string;
  explanation: string;
  suggestedCorrection?: string;
  isVerified?: boolean;
}

export interface LoopTraceRow {
  iteration: string | number;
  varsBefore: string;
  condition: string;
  operation: string;
  varsAfter: string;
  output: string;
}

export interface LoopTrace {
  title?: string;
  headers: string[];
  rows: LoopTraceRow[];
  notes?: string;
  isIllustrative?: boolean;
}

export interface SuggestedFix {
  id: string;
  description: string;
  originalSnippet?: string;
  replacementSnippet?: string;
  fullPatchedCode?: string;
  filePath?: string;
  explanation: string;
}

export interface VerificationItem {
  step: string;
  testInput?: string;
  expectedOutput?: string;
}

export interface LearningPoint {
  concept: string;
  explanation: string;
  takeaway: string;
}

export interface DebuggingReport {
  id: string;
  timestamp: number;
  fileName: string;
  filePath?: string;
  languageId: string;
  
  // 1. Program Purpose
  programPurpose: ProgramPurpose;
  
  // 2. Overall Verdict
  overallVerdict: VerdictStatus;
  verdictSummary: string;
  
  // 3. Problems Found
  findings: Finding[];
  
  // 4. Step-by-Step Logic Explanation & Loop Trace
  logicExplanation: string;
  loopTrace?: LoopTrace;
  
  // 5. Suggested Fixes
  suggestedFixes: SuggestedFix[];
  
  // 6. Verification Checklist
  verificationChecklist: VerificationItem[];
  
  // 7. What You Should Learn
  learningPoints: LearningPoint[];
  
  // 8. Limitations and Confidence
  assumptions: string[];
  limitations: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface RawAIReport {
  programPurpose?: {
    purpose?: string;
    source?: string;
    explanation?: string;
    isMismatch?: boolean;
    algorithmName?: string;
  };
  overallVerdict?: string;
  verdictSummary?: string;
  findings?: Array<{
    issueNumber?: number;
    category?: string;
    severity?: string;
    filePath?: string;
    lineNumber?: number;
    codeSnippet?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    explanation?: string;
    suggestedCorrection?: string;
  }>;
  logicExplanation?: string;
  loopTrace?: {
    title?: string;
    headers?: string[];
    rows?: Array<{
      iteration?: string | number;
      varsBefore?: string;
      condition?: string;
      operation?: string;
      varsAfter?: string;
      output?: string;
    }>;
    notes?: string;
    isIllustrative?: boolean;
  };
  suggestedFixes?: Array<{
    id?: string;
    description?: string;
    originalSnippet?: string;
    replacementSnippet?: string;
    fullPatchedCode?: string;
    filePath?: string;
    explanation?: string;
  }>;
  verificationChecklist?: Array<{
    step?: string;
    testInput?: string;
    expectedOutput?: string;
  }>;
  learningPoints?: Array<{
    concept?: string;
    explanation?: string;
    takeaway?: string;
  }>;
  assumptions?: string[];
  limitations?: string[];
  confidence?: string;
}

