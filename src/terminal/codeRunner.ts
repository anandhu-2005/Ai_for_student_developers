import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ExecutionTracker } from './executionTracker';

export class CodeRunner {
  private static outputChannel: vscode.OutputChannel;

  public static initialize(): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('AI Error Checklister: Run Output');
    }
  }

  public static async runActiveFile(): Promise<void> {
    this.initialize();
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file open to run.');
      return;
    }

    const document = editor.document;
    if (document.isDirty) {
      await document.save();
    }

    const filePath = document.uri.fsPath;
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const cwd = path.dirname(filePath);

    let command: string;
    let args: string[] = [];

    switch (fileExt) {
      case '.py':
        command = 'python';
        args = [filePath];
        break;
      case '.js':
        command = 'node';
        args = [filePath];
        break;
      case '.ts':
        command = 'npx';
        args = ['ts-node', filePath];
        break;
      case '.c':
        // For C, compile and execute if gcc is available
        const outBin = path.join(cwd, `${path.basename(filePath, '.c')}_bin.exe`);
        command = 'gcc';
        args = [filePath, '-o', outBin];
        break;
      default:
        vscode.window.showInformationMessage(
          `AI Error Checklister: Direct execution runner not configured for "${fileExt}". Please execute in VS Code terminal. Terminal output is tracked automatically when shell integration is available.`
        );
        return;
    }

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine(`[AI Error Checklister] Running ${fileName}...`);
    this.outputChannel.appendLine(`Command: ${command} ${args.join(' ')}\n`);

    let accumulatedOutput = '';
    const proc = cp.spawn(command, args, { cwd, shell: false });

    proc.stdout.on('data', data => {
      const text = data.toString();
      accumulatedOutput += text;
      this.outputChannel.append(text);
    });

    proc.stderr.on('data', data => {
      const text = data.toString();
      accumulatedOutput += text;
      this.outputChannel.append(text);
    });

    proc.on('close', code => {
      this.outputChannel.appendLine(`\n[AI Error Checklister] Process exited with code ${code}`);

      // Record to ExecutionTracker
      ExecutionTracker.recordExecution({
        command: `${command} ${args.join(' ')}`,
        output: accumulatedOutput,
        exitCode: code ?? undefined,
        filePath
      });

      // Check auto-analyze on error
      const config = vscode.workspace.getConfiguration('aiErrorChecklister');
      const autoAnalyze = config.get<boolean>('autoAnalyzeOnError', false);

      if (code !== 0 && autoAnalyze) {
        vscode.commands.executeCommand('ai-error-checklister.analyzeLastRun');
      } else if (code !== 0) {
        vscode.window.showErrorMessage(
          `Process exited with code ${code}. Analyze error with AI?`,
          'Analyze with AI',
          'Dismiss'
        ).then(choice => {
          if (choice === 'Analyze with AI') {
            vscode.commands.executeCommand('ai-error-checklister.analyzeLastRun');
          }
        });
      }
    });

    proc.on('error', err => {
      this.outputChannel.appendLine(`[AI Error Checklister Error] Failed to launch runner: ${err.message}`);
      ExecutionTracker.recordExecution({
        command: `${command} ${args.join(' ')}`,
        output: `Error launching ${command}: ${err.message}`,
        exitCode: -1,
        filePath
      });
    });
  }
}
