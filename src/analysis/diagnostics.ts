import * as vscode from 'vscode';

export interface CodeDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  source?: string;
}

export class DiagnosticsCollector {
  public static getDiagnosticsForUri(uri: vscode.Uri): CodeDiagnostic[] {
    const rawDiagnostics = vscode.languages.getDiagnostics(uri);
    return rawDiagnostics.map(diag => {
      let severity: 'error' | 'warning' | 'info' = 'info';
      if (diag.severity === vscode.DiagnosticSeverity.Error) {
        severity = 'error';
      } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
        severity = 'warning';
      }

      return {
        severity,
        message: diag.message,
        line: diag.range.start.line + 1, // 1-based line number for users
        source: diag.source
      };
    });
  }
}
