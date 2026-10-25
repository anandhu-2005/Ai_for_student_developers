import * as vscode from 'vscode';
import { DebuggingReport } from '../types/analysis';
import { HistoryItem } from '../types/history';

const HISTORY_STORAGE_KEY = 'ai_error_checklister_report_history';

export class HistoryManager {
  private static memento: vscode.Memento;

  public static initialize(context: vscode.ExtensionContext): void {
    this.memento = context.globalState;
  }

  public static getHistory(): HistoryItem[] {
    if (!this.memento) {
      return [];
    }
    return this.memento.get<HistoryItem[]>(HISTORY_STORAGE_KEY, []);
  }

  public static async addReport(report: DebuggingReport): Promise<void> {
    if (!this.memento) {
      return;
    }

    const config = vscode.workspace.getConfiguration('aiErrorChecklister');
    const retentionLimit = config.get<number>('historyRetentionLimit', 10);

    const newItem: HistoryItem = {
      id: report.id,
      timestamp: report.timestamp,
      fileName: report.fileName,
      purpose: report.programPurpose.purpose,
      verdict: report.overallVerdict,
      issuesCount: report.findings.length,
      report
    };

    let existing = this.getHistory();
    // Prepend newest report
    existing = [newItem, ...existing.filter(h => h.id !== report.id)];

    // Enforce retention limit
    if (existing.length > retentionLimit) {
      existing = existing.slice(0, retentionLimit);
    }

    await this.memento.update(HISTORY_STORAGE_KEY, existing);
  }

  public static async clearHistory(): Promise<void> {
    if (this.memento) {
      await this.memento.update(HISTORY_STORAGE_KEY, []);
    }
  }

  public static getLatestReport(): DebuggingReport | undefined {
    const list = this.getHistory();
    return list.length > 0 ? list[0].report : undefined;
  }
}

