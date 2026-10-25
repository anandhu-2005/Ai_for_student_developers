import * as vscode from 'vscode';
import { ProviderManager } from './providers/providerManager';
import { HistoryManager } from './storage/historyManager';
import { LiveMonitor } from './terminal/liveMonitor';
import { CodeRunner } from './terminal/codeRunner';
import { ChecklisterStatusBar } from './ui/statusBar';
import { registerCommands } from './commands';

let providerManager: ProviderManager;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('AI Error Checklister is now active!');

  // Initialize Core Services
  providerManager = new ProviderManager(context.secrets);
  await providerManager.initialize();

  HistoryManager.initialize(context);
  CodeRunner.initialize();
  LiveMonitor.initialize(context);
  ChecklisterStatusBar.initialize(context, providerManager);

  // Register all commands
  registerCommands(context, providerManager);

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('aiErrorChecklister')) {
        await providerManager.syncConfiguration();
        ChecklisterStatusBar.update(providerManager);
      }
    })
  );
}

export function deactivate(): void {
  console.log('AI Error Checklister is deactivated.');
}

