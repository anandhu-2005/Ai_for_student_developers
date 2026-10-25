import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DebuggingReport, SuggestedFix } from '../types/analysis';
import { generateReportHtml } from './htmlTemplate';

export class ChecklisterWebviewPanel {
  public static currentPanel: ChecklisterWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private currentReport: DebuggingReport | null = null;
  private activeProviderName: string = 'Ollama';
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async message => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): ChecklisterWebviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (ChecklisterWebviewPanel.currentPanel) {
      ChecklisterWebviewPanel.currentPanel.panel.reveal(column);
      return ChecklisterWebviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'aiErrorChecklisterReport',
      'AI Error Checklister',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ChecklisterWebviewPanel.currentPanel = new ChecklisterWebviewPanel(panel, extensionUri);
    return ChecklisterWebviewPanel.currentPanel;
  }

  public showLoading(message: string, providerName: string): void {
    this.activeProviderName = providerName;
    const nonce = this.getNonce();
    this.panel.webview.html = generateReportHtml(null, providerName, nonce, true, message);
  }

  public showReport(report: DebuggingReport, providerName: string): void {
    this.currentReport = report;
    this.activeProviderName = providerName;
    const nonce = this.getNonce();
    this.panel.webview.html = generateReportHtml(report, providerName, nonce, false);
  }

  public showEmpty(providerName: string): void {
    this.currentReport = null;
    this.activeProviderName = providerName;
    const nonce = this.getNonce();
    this.panel.webview.html = generateReportHtml(null, providerName, nonce, false);
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'jumpToLine': {
        const line = message.line;
        if (typeof line === 'number') {
          await this.jumpToLine(line);
        }
        break;
      }
      case 'previewDiff': {
        const fixId = message.fixId;
        const fix = this.currentReport?.suggestedFixes.find(f => f.id === fixId);
        if (fix) {
          await this.previewDiff(fix);
        }
        break;
      }
      case 'applyFix': {
        const fixId = message.fixId;
        const fix = this.currentReport?.suggestedFixes.find(f => f.id === fixId);
        if (fix) {
          await this.applyFix(fix);
        }
        break;
      }
      case 'configureProvider': {
        vscode.commands.executeCommand('ai-error-checklister.configureProvider');
        break;
      }
      case 'reanalyze':
      case 'analyzeActive': {
        vscode.commands.executeCommand('ai-error-checklister.analyzeCurrentFile');
        break;
      }
    }
  }

  private async jumpToLine(line: number): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      // Try to open document from report file path
      if (this.currentReport?.filePath) {
        const doc = await vscode.workspace.openTextDocument(this.currentReport.filePath);
        const ed = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        this.revealLineInEditor(ed, line);
      }
      return;
    }

    this.revealLineInEditor(editor, line);
  }

  private revealLineInEditor(editor: vscode.TextEditor, line: number): void {
    const targetLine = Math.max(0, line - 1);
    const pos = new vscode.Position(targetLine, 0);
    const range = new vscode.Range(pos, pos);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private async previewDiff(fix: SuggestedFix): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor && !this.currentReport?.filePath) {
      vscode.window.showWarningMessage('Source file not found to preview diff.');
      return;
    }

    const document = editor?.document || await vscode.workspace.openTextDocument(this.currentReport!.filePath!);
    const originalText = document.getText();

    // Create patched text
    let patchedText = originalText;
    if (fix.originalSnippet && fix.replacementSnippet) {
      if (originalText.includes(fix.originalSnippet)) {
        patchedText = originalText.replace(fix.originalSnippet, fix.replacementSnippet);
      } else {
        // Line-based replacement fallback
        patchedText = fix.fullPatchedCode || originalText;
      }
    } else if (fix.fullPatchedCode) {
      patchedText = fix.fullPatchedCode;
    }

    // Write to a temporary file for VS Code diff view
    const tempDir = os.tmpdir();
    const tempFileName = `suggested_fix_${path.basename(document.fileName)}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    fs.writeFileSync(tempFilePath, patchedText, 'utf-8');
    const tempUri = vscode.Uri.file(tempFilePath);

    await vscode.commands.executeCommand(
      'vscode.diff',
      document.uri,
      tempUri,
      `Current File ↔ Suggested Fix (${fix.description})`
    );
  }

  private async applyFix(fix: SuggestedFix): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const filePath = this.currentReport?.filePath || editor?.document.uri.fsPath;

    if (!filePath) {
      vscode.window.showErrorMessage('Cannot apply fix: Target file path is unavailable.');
      return;
    }

    const doc = editor?.document && editor.document.uri.fsPath === filePath
      ? editor.document
      : await vscode.workspace.openTextDocument(filePath);

    const docText = doc.getText();

    // Require explicit confirmation before modifying source code
    const answer = await vscode.window.showWarningMessage(
      `Apply Suggested Fix: "${fix.description}" to ${path.basename(filePath)}?`,
      { modal: true },
      'Apply Fix',
      'Cancel'
    );

    if (answer !== 'Apply Fix') {
      return;
    }

    if (fix.originalSnippet && fix.replacementSnippet) {
      const idx = docText.indexOf(fix.originalSnippet);
      if (idx !== -1) {
        const startPos = doc.positionAt(idx);
        const endPos = doc.positionAt(idx + fix.originalSnippet.length);

        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, new vscode.Range(startPos, endPos), fix.replacementSnippet);
        const applied = await vscode.workspace.applyEdit(edit);
        if (applied) {
          vscode.window.showInformationMessage(`Applied fix: ${fix.description}`);
          return;
        }
      }
    }

    if (fix.fullPatchedCode) {
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(docText.length)
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(doc.uri, fullRange, fix.fullPatchedCode);
      const applied = await vscode.workspace.applyEdit(edit);
      if (applied) {
        vscode.window.showInformationMessage(`Applied full file patch for: ${fix.description}`);
        return;
      }
    }

    vscode.window.showErrorMessage('Could not automatically match snippet in source. Please review via Diff Preview.');
  }

  private getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  public dispose(): void {
    ChecklisterWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

