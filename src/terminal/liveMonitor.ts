import * as vscode from 'vscode';
import { RuntimeErrorParser } from '../analysis/runtimeErrorParser';

export class LiveMonitor {
  private static isEnabled: boolean = false;
  private static debounceTimer: NodeJS.Timeout | null = null;
  private static lastHandledErrorTimestamp: number = 0;
  private static statusBarItem: vscode.StatusBarItem;
  private static lastReportedMessage: string = '';

  public static initialize(context: vscode.ExtensionContext): void {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.statusBarItem.command = 'ai-error-checklister.toggleLiveMonitoring';
    context.subscriptions.push(this.statusBarItem);

    const config = vscode.workspace.getConfiguration('aiErrorChecklister');
    this.isEnabled = config.get<boolean>('liveMonitoring', false);
    this.updateStatus();

    // Listen for shell execution events if supported in active VS Code environment
    try {
      if ('onDidEndTerminalShellExecution' in (vscode.window as any)) {
        const disposable = (vscode.window as any).onDidEndTerminalShellExecution((event: any) => {
          if (!this.isEnabled) {
            return;
          }
          if (event.exitCode && event.exitCode !== 0) {
            this.handleDetectedError(`Process in terminal failed with exit code ${event.exitCode}`);
          }
        });
        context.subscriptions.push(disposable);
      }
    } catch (e) {
      // Graceful fallback if shell integration is not available
    }
  }

  public static toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    const config = vscode.workspace.getConfiguration('aiErrorChecklister');
    config.update('liveMonitoring', this.isEnabled, vscode.ConfigurationTarget.Global);
    this.updateStatus();

    if (this.isEnabled) {
      vscode.window.showInformationMessage('AI Error Checklister: Live Server Monitoring ENABLED. Server errors in supported terminals will be captured.');
    } else {
      vscode.window.showInformationMessage('AI Error Checklister: Live Server Monitoring DISABLED.');
    }

    return this.isEnabled;
  }

  public static getStatus(): boolean {
    return this.isEnabled;
  }

  /**
   * Process log chunk from a running server or terminal.
   * Debounces repeated messages to prevent flooding AI.
   */
  public static processLogChunk(chunk: string, sourceName?: string): void {
    if (!this.isEnabled || !chunk || !chunk.trim()) {
      return;
    }

    // Check for recognizable server errors
    const isServerError = 
      /Traceback \(most recent call last\):/i.test(chunk) ||
      /(?:Internal Server Error|HTTP\/\d\.\d\s+500|UnhandledPromiseRejection|FATAL ERROR|ReferenceError|TypeError):/i.test(chunk);

    if (!isServerError) {
      return;
    }

    const now = Date.now();
    // 3-second debounce window
    if (now - this.lastHandledErrorTimestamp < 3000 && chunk.includes(this.lastReportedMessage)) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.lastHandledErrorTimestamp = Date.now();
      this.lastReportedMessage = chunk.slice(0, 100);
      this.handleDetectedError(chunk, sourceName);
    }, 1500);
  }

  private static handleDetectedError(errorText: string, sourceName?: string): void {
    const parsedErrors = RuntimeErrorParser.parse(errorText);
    const summary = parsedErrors.length > 0 
      ? `${parsedErrors[0].type}: ${parsedErrors[0].message || 'Server error detected'}`
      : 'Server exception detected in terminal';

    vscode.window.showWarningMessage(
      `Live Server Alert: ${summary}. Analyze now?`,
      'Analyze in Report',
      'Dismiss'
    ).then(choice => {
      if (choice === 'Analyze in Report') {
        vscode.commands.executeCommand('ai-error-checklister.analyzeLastRun');
      }
    });
  }

  private static updateStatus(): void {
    if (this.isEnabled) {
      this.statusBarItem.text = '$(radio-tower) Monitor: ON';
      this.statusBarItem.tooltip = 'Live Server Error Monitoring is ACTIVE. Click to toggle.';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = '$(radio-tower) Monitor: OFF';
      this.statusBarItem.tooltip = 'Live Server Error Monitoring is INACTIVE. Click to toggle.';
      this.statusBarItem.show();
    }
  }
}

