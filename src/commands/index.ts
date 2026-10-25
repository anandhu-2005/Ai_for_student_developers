import * as vscode from 'vscode';
import { ProviderManager } from '../providers/providerManager';
import { ContextCollector } from '../analysis/contextCollector';
import { ChecklisterWebviewPanel } from '../ui/webviewPanel';
import { HistoryManager } from '../storage/historyManager';
import { ExecutionTracker } from '../terminal/executionTracker';
import { CodeRunner } from '../terminal/codeRunner';
import { TerminalTutor } from '../terminal/terminalTutor';
import { LiveMonitor } from '../terminal/liveMonitor';
import { ChecklisterStatusBar } from '../ui/statusBar';

export function registerCommands(
  context: vscode.ExtensionContext,
  providerManager: ProviderManager
): void {
  // Command: Toggle Provider (Gemini vs Ollama)
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.toggleProvider', async () => {
      const current = providerManager.getActiveProvider();
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '$(zap) Google Gemini API (Cloud - Fast)',
            description: current.id === 'gemini' ? 'Currently Active' : '',
            detail: 'Runs via Google Gemini API with your user-configured key',
            id: 'gemini'
          },
          {
            label: '$(hub) Ollama (Local - Private)',
            description: current.id === 'ollama' ? 'Currently Active' : '',
            detail: 'Runs via local Ollama (qwen2.5-coder:7b) on http://localhost:11434',
            id: 'ollama'
          },
          {
            label: '$(check) Mock Deterministic AI (Offline)',
            description: current.id === 'mock' ? 'Currently Active' : '',
            detail: 'Instant offline responses for testing without network or GPU',
            id: 'mock'
          }
        ],
        { placeHolder: 'Select AI Engine (Gemini Cloud vs. Ollama Local)' }
      );

      if (choice) {
        const config = vscode.workspace.getConfiguration('aiErrorChecklister');
        await config.update('provider', choice.id, vscode.ConfigurationTarget.Global);
        await providerManager.syncConfiguration();
        ChecklisterStatusBar.update(providerManager);
        vscode.window.showInformationMessage(`AI Engine switched to: ${choice.label}`);
      }
    })
  );

  // Command 1: Analyze Current File
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.analyzeCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('AI Error Checklister: Open a code file in the editor to analyze.');
        return;
      }

      const panel = ChecklisterWebviewPanel.createOrShow(context.extensionUri);
      const activeProvider = providerManager.getActiveProvider();
      panel.showLoading(`Analyzing ${editor.document.fileName.split(/[/\\]/).pop()} with ${activeProvider.displayName}...`, activeProvider.displayName);

      try {
        const config = vscode.workspace.getConfiguration('aiErrorChecklister');
        const maxLines = config.get<number>('maxSourceLines', 500);

        const codeCtx = ContextCollector.collectFromEditor(editor, { maxLines });
        const report = await activeProvider.analyze({
          context: codeCtx,
          mode: 'file'
        });

        await HistoryManager.addReport(report);
        panel.showReport(report, activeProvider.displayName);
      } catch (err: any) {
        vscode.window.showErrorMessage(`AI Analysis failed: ${err.message}`);
        panel.showReport({
          id: 'err_' + Date.now(),
          timestamp: Date.now(),
          fileName: editor.document.fileName.split(/[/\\]/).pop() || 'file',
          languageId: editor.document.languageId,
          programPurpose: {
            purpose: 'Analysis Error',
            source: 'unclear',
            explanation: 'Analysis could not be completed.',
            isMismatch: false
          },
          overallVerdict: 'cannot_determine',
          verdictSummary: `Provider error: ${err.message}`,
          findings: [{
            issueNumber: 1,
            category: 'runtime',
            severity: 'error',
            expectedBehavior: 'Connection to AI model succeeds',
            actualBehavior: 'Request failed',
            explanation: err.message
          }],
          logicExplanation: 'Check your AI provider connection via "AI Error Checklister: Test AI Connection".',
          suggestedFixes: [],
          verificationChecklist: [],
          learningPoints: [],
          assumptions: [],
          limitations: [],
          confidence: 'low'
        }, activeProvider.displayName);
      }
    })
  );

  // Command 2: Analyze Selected Code
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.analyzeSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('AI Error Checklister: Open a code file to analyze selected code.');
        return;
      }

      if (editor.selection.isEmpty) {
        vscode.window.showInformationMessage('Please highlight a snippet of code in the editor, or use "Analyze Current File".');
        return;
      }

      const panel = ChecklisterWebviewPanel.createOrShow(context.extensionUri);
      const activeProvider = providerManager.getActiveProvider();
      panel.showLoading(`Analyzing selected lines with ${activeProvider.displayName}...`, activeProvider.displayName);

      try {
        const codeCtx = ContextCollector.collectFromEditor(editor, { useSelectionOnly: true });
        const report = await activeProvider.analyze({
          context: codeCtx,
          mode: 'selection'
        });

        await HistoryManager.addReport(report);
        panel.showReport(report, activeProvider.displayName);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Selection analysis failed: ${err.message}`);
      }
    })
  );

  // Command 3: Analyze Last Run
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.analyzeLastRun', async () => {
      const lastRun = ExecutionTracker.getLastExecution();
      const editor = vscode.window.activeTextEditor;

      if (!lastRun && !editor) {
        vscode.window.showInformationMessage(
          'No recent execution captured. Run your code using "AI Error Checklister: Run Active File & Capture Output" or run it in the terminal.'
        );
        return;
      }

      const panel = ChecklisterWebviewPanel.createOrShow(context.extensionUri);
      const activeProvider = providerManager.getActiveProvider();
      panel.showLoading(`Analyzing last run error output with ${activeProvider.displayName}...`, activeProvider.displayName);

      try {
        let codeCtx;
        if (editor) {
          codeCtx = ContextCollector.collectFromEditor(editor, {
            terminalOutput: lastRun?.output,
            exitCode: lastRun?.exitCode
          });
        } else if (lastRun?.filePath) {
          const doc = await vscode.workspace.openTextDocument(lastRun.filePath);
          codeCtx = ContextCollector.collectFromSource(
            doc.getText(),
            doc.fileName.split(/[/\\]/).pop() || 'file',
            doc.languageId,
            lastRun.output,
            lastRun.exitCode
          );
        } else {
          codeCtx = ContextCollector.collectFromSource(
            '// No active file open',
            'terminal-output.log',
            'plaintext',
            lastRun?.output,
            lastRun?.exitCode
          );
        }

        const report = await activeProvider.analyze({
          context: codeCtx,
          mode: 'last_run'
        });

        await HistoryManager.addReport(report);
        panel.showReport(report, activeProvider.displayName);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Last run analysis failed: ${err.message}`);
      }
    })
  );

  // Command 4: Run Active File & Capture Output (Terminal Tutor)
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.runAndCapture', async () => {
      await TerminalTutor.runActiveFileWithTutor(providerManager);
    })
  );

  // Command 5: Explain Loop or Algorithm
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.explainLoopOrAlgorithm', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('AI Error Checklister: Open a file containing a loop or algorithm to explain.');
        return;
      }

      const panel = ChecklisterWebviewPanel.createOrShow(context.extensionUri);
      const activeProvider = providerManager.getActiveProvider();
      panel.showLoading(`Generating step-by-step loop trace with ${activeProvider.displayName}...`, activeProvider.displayName);

      try {
        const codeCtx = ContextCollector.collectFromEditor(editor);
        const report = await activeProvider.analyze({
          context: codeCtx,
          mode: 'loop_trace'
        });

        await HistoryManager.addReport(report);
        panel.showReport(report, activeProvider.displayName);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Loop explanation failed: ${err.message}`);
      }
    })
  );

  // Command 6: Open Debugging Report
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.openReport', () => {
      const panel = ChecklisterWebviewPanel.createOrShow(context.extensionUri);
      const activeProvider = providerManager.getActiveProvider();
      const latest = HistoryManager.getLatestReport();
      if (latest) {
        panel.showReport(latest, activeProvider.displayName);
      } else {
        panel.showEmpty(activeProvider.displayName);
      }
    })
  );

  // Command 7: Configure AI Provider
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.configureProvider', async () => {
      const config = vscode.workspace.getConfiguration('aiErrorChecklister');
      const currentProvider = config.get<string>('provider', 'ollama');

      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '$(hub) Ollama (Local AI)',
            description: currentProvider === 'ollama' ? 'Currently Selected' : '',
            detail: 'Runs completely locally on your machine via http://localhost:11434',
            id: 'ollama'
          },
          {
            label: '$(cloud) Google Gemini API',
            description: currentProvider === 'gemini' ? 'Currently Selected' : '',
            detail: 'Cloud-based model using official Gemini API key in SecretStorage',
            id: 'gemini'
          },
          {
            label: '$(check) Mock Deterministic Provider (Offline / Testing)',
            description: currentProvider === 'mock' ? 'Currently Selected' : '',
            detail: 'Deterministic mock responses for offline tests and fast verification',
            id: 'mock'
          },
          {
            label: '$(key) Set / Update Gemini API Key',
            detail: 'Securely store Gemini API key in VS Code SecretStorage',
            id: 'set_gemini_key'
          },
          {
            label: '$(trash) Clear Stored Gemini API Key',
            detail: 'Remove Gemini API key from SecretStorage',
            id: 'clear_gemini_key'
          },
          {
            label: '$(settings) Configure Ollama Model / Base URL',
            detail: 'Change Ollama endpoint or model tag (e.g. llama3.2, codellama)',
            id: 'config_ollama'
          }
        ],
        { placeHolder: 'Select an AI provider or configuration action' }
      );

      if (!choice) {
        return;
      }

      if (choice.id === 'ollama' || choice.id === 'gemini' || choice.id === 'mock') {
        await config.update('provider', choice.id, vscode.ConfigurationTarget.Global);
        await providerManager.syncConfiguration();
        ChecklisterStatusBar.update(providerManager);
        vscode.window.showInformationMessage(`AI Error Checklister: Active provider set to ${choice.label}.`);
      } else if (choice.id === 'set_gemini_key') {
        const key = await vscode.window.showInputBox({
          prompt: 'Enter your Google Gemini API key (stored securely in VS Code SecretStorage)',
          password: true,
          ignoreFocusOut: true
        });
        if (key !== undefined) {
          await providerManager.setGeminiApiKey(key);
          vscode.window.showInformationMessage('Gemini API key saved securely in SecretStorage.');
        }
      } else if (choice.id === 'clear_gemini_key') {
        await providerManager.clearGeminiApiKey();
        vscode.window.showInformationMessage('Gemini API key removed.');
      } else if (choice.id === 'config_ollama') {
        const currentModel = config.get<string>('ollama.model', 'qwen2.5-coder:7b');
        const newModel = await vscode.window.showInputBox({
          prompt: 'Enter Ollama model tag (e.g., qwen2.5-coder:7b, llama3.2, codellama)',
          value: currentModel
        });
        if (newModel) {
          await config.update('ollama.model', newModel.trim(), vscode.ConfigurationTarget.Global);
          await providerManager.syncConfiguration();
          vscode.window.showInformationMessage(`Ollama model updated to "${newModel.trim()}".`);
        }
      }
    })
  );

  // Command 8: Test AI Connection
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.testConnection', async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'AI Error Checklister: Testing provider connection...',
          cancellable: false
        },
        async () => {
          const status = await providerManager.testCurrentConnection();
          if (status.success) {
            vscode.window.showInformationMessage(`[SUCCESS] ${status.message}`);
          } else {
            vscode.window.showErrorMessage(`[CONNECTION FAILED] ${status.message}`);
          }
        }
      );
    })
  );

  // Command 9: Enable or Disable Live Monitoring
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.toggleLiveMonitoring', () => {
      LiveMonitor.toggle();
    })
  );

  // Command 10: Clear Debugging History
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-error-checklister.clearHistory', async () => {
      await HistoryManager.clearHistory();
      vscode.window.showInformationMessage('AI Error Checklister: Debugging history cleared.');
      if (ChecklisterWebviewPanel.currentPanel) {
        const activeProvider = providerManager.getActiveProvider();
        ChecklisterWebviewPanel.currentPanel.showEmpty(activeProvider.displayName);
      }
    })
  );
}
