import { DebuggingReport, ProgramPurpose } from './analysis';
import { StaticCodeIssue } from '../analysis/errorDetector';
import { ParsedRuntimeError } from '../analysis/runtimeErrorParser';

export interface CodeContext {
  fileName: string;
  filePath?: string;
  languageId: string;
  fullSource: string;
  selectedText?: string;
  selectionRange?: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  diagnostics: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    source?: string;
  }>;
  terminalOutput?: string;
  exitCode?: number;
  detectedPurpose?: ProgramPurpose;
  staticIssues?: StaticCodeIssue[];
  staticHeuristicErrors?: string[];
  parsedRuntimeErrors?: ParsedRuntimeError[];
}

export interface AnalysisRequest {
  context: CodeContext;
  mode: 'file' | 'selection' | 'last_run' | 'loop_trace' | 'live_event';
  userQuery?: string;
}

export interface ConnectionStatus {
  success: boolean;
  provider: string;
  message: string;
  availableModels?: string[];
  latencyMs?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  analyze(request: AnalysisRequest): Promise<DebuggingReport>;
  testConnection(): Promise<ConnectionStatus>;
}
