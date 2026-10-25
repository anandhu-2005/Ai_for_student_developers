import { DebuggingReport } from './analysis';

export interface HistoryItem {
  id: string;
  timestamp: number;
  fileName: string;
  purpose: string;
  verdict: string;
  issuesCount: number;
  report: DebuggingReport;
}

