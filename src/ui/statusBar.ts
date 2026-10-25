import * as vscode from 'vscode';
import { ProviderManager } from '../providers/providerManager';

export class ChecklisterStatusBar {
  private static item: vscode.StatusBarItem;

  public static initialize(context: vscode.ExtensionContext, providerManager: ProviderManager): void {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'ai-error-checklister.toggleProvider';
    context.subscriptions.push(this.item);

    this.update(providerManager);
  }

  public static update(providerManager: ProviderManager): void {
    const provider = providerManager.getActiveProvider();
    if (provider.id === 'gemini') {
      this.item.text = `$(zap) AI: Gemini (Cloud)`;
      this.item.tooltip = 'Running via Google Gemini API (Fast). Click to switch to Ollama Local.';
    } else if (provider.id === 'ollama') {
      this.item.text = `$(hub) AI: Ollama (Local)`;
      this.item.tooltip = 'Running via Ollama Local (qwen2.5-coder:7b). Click to switch to Gemini Cloud.';
    } else {
      this.item.text = `$(check) AI: Mock`;
      this.item.tooltip = 'Running via Mock AI. Click to switch.';
    }
    this.item.show();
  }
}
