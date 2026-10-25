export interface ExecutionRecord {
  id: string;
  timestamp: number;
  command: string;
  output: string;
  exitCode?: number;
  filePath?: string;
}

export class ExecutionTracker {
  private static lastExecution?: ExecutionRecord;
  private static listeners: Array<(record: ExecutionRecord) => void> = [];

  public static recordExecution(record: Omit<ExecutionRecord, 'id' | 'timestamp'>): ExecutionRecord {
    const fullRecord: ExecutionRecord = {
      ...record,
      id: 'exec_' + Date.now(),
      timestamp: Date.now()
    };
    this.lastExecution = fullRecord;

    for (const listener of this.listeners) {
      try {
        listener(fullRecord);
      } catch (err) {
        console.error('Error in execution listener:', err);
      }
    }

    return fullRecord;
  }

  public static getLastExecution(): ExecutionRecord | undefined {
    return this.lastExecution;
  }

  public static onExecution(callback: (record: ExecutionRecord) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public static clear(): void {
    this.lastExecution = undefined;
  }
}

