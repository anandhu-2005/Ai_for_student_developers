import * as vscode from 'vscode';
import { CodeContext } from '../types/provider';
import { PurposeDetector } from './purposeDetector';
import { DiagnosticsCollector } from './diagnostics';
import { ErrorDetector } from './errorDetector';
import { RuntimeErrorParser } from './runtimeErrorParser';
import { OutputValidator } from './outputValidator';

export class ContextCollector {
  public static collectFromEditor(
    editor: vscode.TextEditor,
    options?: {
      useSelectionOnly?: boolean;
      terminalOutput?: string;
      exitCode?: number;
      maxLines?: number;
    }
  ): CodeContext {
    const document = editor.document;
    const fullSource = document.getText();
    const fileName = document.fileName.split(/[/\\]/).pop() || 'untitled';
    const filePath = document.uri.fsPath;
    const languageId = document.languageId;
    const selection = editor.selection;

    let selectedText: string | undefined;
    let selectionRange: CodeContext['selectionRange'];

    if (!selection.isEmpty) {
      selectedText = document.getText(selection);
      selectionRange = {
        startLine: selection.start.line + 1,
        startCharacter: selection.start.character,
        endLine: selection.end.line + 1,
        endCharacter: selection.end.character
      };
    }

    // Diagnostics from VS Code
    const diagnostics = DiagnosticsCollector.getDiagnosticsForUri(document.uri);

    // Purpose detection
    const purposeResult = PurposeDetector.detect(fullSource, fileName);

    // Static heuristics
    const staticIssues = ErrorDetector.scan(fullSource, languageId);
    const staticHeuristicErrors = staticIssues.map(issue => 
      `Line ${issue.line} [${issue.category.toUpperCase()}]: ${issue.message}`
    );

    // Validate terminal output for logical corruption / uninitialized memory
    const outputIssues = options?.terminalOutput
      ? OutputValidator.validate(options.terminalOutput, fullSource, languageId)
      : [];
    for (const oi of outputIssues) {
      const lineStr = oi.suspectedLine ? ` (Line ${oi.suspectedLine})` : '';
      staticHeuristicErrors.unshift(`Output Anomaly [LOGICAL ERROR]${lineStr}: ${oi.summary}. Root cause: ${oi.rootCause}`);
    }

    // Parse runtime or compiler errors if terminal output was captured
    const parsedRuntimeErrors = options?.terminalOutput
      ? RuntimeErrorParser.parse(options.terminalOutput)
      : [];

    // Limit source if necessary
    const maxLines = options?.maxLines || 500;
    const sourceLines = fullSource.split(/\r?\n/);
    let boundedSource = fullSource;
    if (sourceLines.length > maxLines) {
      boundedSource = sourceLines.slice(0, maxLines).join('\n') + `\n// ... [Truncated: Showing first ${maxLines} lines of ${sourceLines.length}]`;
    }

    return {
      fileName,
      filePath,
      languageId,
      fullSource: boundedSource,
      selectedText,
      selectionRange,
      diagnostics,
      terminalOutput: options?.terminalOutput,
      exitCode: options?.exitCode,
      detectedPurpose: purposeResult.purpose,
      staticIssues,
      staticHeuristicErrors,
      parsedRuntimeErrors
    };
  }

  public static collectFromSource(
    source: string,
    fileName: string,
    languageId: string,
    terminalOutput?: string,
    exitCode?: number
  ): CodeContext {
    const purposeResult = PurposeDetector.detect(source, fileName);
    const staticIssues = ErrorDetector.scan(source, languageId);
    const staticHeuristicErrors = staticIssues.map(issue => 
      `Line ${issue.line} [${issue.category.toUpperCase()}]: ${issue.message}`
    );

    const outputIssues = terminalOutput
      ? OutputValidator.validate(terminalOutput, source, languageId)
      : [];
    for (const oi of outputIssues) {
      const lineStr = oi.suspectedLine ? ` (Line ${oi.suspectedLine})` : '';
      staticHeuristicErrors.unshift(`Output Anomaly [LOGICAL ERROR]${lineStr}: ${oi.summary}. Root cause: ${oi.rootCause}`);
    }

    const parsedRuntimeErrors = terminalOutput
      ? RuntimeErrorParser.parse(terminalOutput)
      : [];

    return {
      fileName,
      languageId,
      fullSource: source,
      diagnostics: [],
      terminalOutput,
      exitCode,
      detectedPurpose: purposeResult.purpose,
      staticIssues,
      staticHeuristicErrors,
      parsedRuntimeErrors
    };
  }
}
