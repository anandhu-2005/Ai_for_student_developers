export interface ParsedRuntimeError {
  type: string;
  message: string;
  filePath?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  rawStack?: string;
  sourceContext?: string;
}

export class RuntimeErrorParser {
  /**
   * Parse terminal output or error logs to detect and extract structured errors.
   */
  public static parse(output: string): ParsedRuntimeError[] {
    const results: ParsedRuntimeError[] = [];
    if (!output || !output.trim()) {
      return results;
    }

    // 1. Python Traceback
    // Format: Traceback (most recent call last):\n  File "...", line X ...\nErrorType: message
    const pythonTracebackRegex = /Traceback \(most recent call last\):([\s\S]*?)\r?\n([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception):\s*([^\r\n]*)/g;
    let pyMatch: RegExpExecArray | null;
    while ((pyMatch = pythonTracebackRegex.exec(output)) !== null) {
      const traceBody = pyMatch[1];
      const errorType = pyMatch[2];
      const errorMessage = pyMatch[3]?.trim() || '';

      // Find the last File "...", line X in the trace body
      const fileMatches = Array.from(traceBody.matchAll(/File "([^"]+)", line (\d+)(?:, in (.+))?/g));
      const lastFileMatch = fileMatches.length > 0 ? fileMatches[fileMatches.length - 1] : undefined;

      const filePath = lastFileMatch ? lastFileMatch[1] : undefined;
      const lineNumber = lastFileMatch ? parseInt(lastFileMatch[2], 10) : undefined;
      const fileName = filePath ? filePath.split(/[/\\]/).pop() : undefined;

      results.push({
        type: errorType,
        message: errorMessage,
        filePath,
        fileName,
        lineNumber,
        rawStack: pyMatch[0]
      });
    }

    // 2. Python SyntaxError WITHOUT traceback header
    // Format produced by Python for syntax errors:
    //   File "simple.py", line 2
    //     for i in range(8)
    //                      ^
    //   SyntaxError: expected ':'
    if (results.length === 0) {
      const pySyntaxRegex = /File "([^"]+)", line (\d+)\r?\n([\s\S]*?)\r?\n\s*\^\r?\n\s*(SyntaxError|IndentationError|TabError):\s*([^\r\n]+)/g;
      let synMatch: RegExpExecArray | null;
      while ((synMatch = pySyntaxRegex.exec(output)) !== null) {
        const filePath = synMatch[1];
        const lineNumber = parseInt(synMatch[2], 10);
        const errorType = synMatch[4];
        const errorMessage = synMatch[5]?.trim();
        results.push({
          type: errorType,
          message: errorMessage,
          filePath,
          fileName: filePath.split(/[/\\]/).pop(),
          lineNumber,
          rawStack: synMatch[0]
        });
      }
    }

    // 3. Node.js / JavaScript Stack Trace (Must have 'at ...' callsite)
    const nodeErrorRegex = /(?:^|\r?\n)([A-Za-z0-9_]+(?:Error|Exception)):\s*(.*?)\r?\n\s+at\s+(?:.*?\s+\()?([A-Za-z0-9_.:/\\-]+):(\d+):(\d+)\)?/g;
    let nodeMatch: RegExpExecArray | null;
    while ((nodeMatch = nodeErrorRegex.exec(output)) !== null) {
      const errorType = nodeMatch[1];
      const errorMessage = nodeMatch[2]?.trim();
      const filePath = nodeMatch[3];
      const lineNumber = nodeMatch[4] ? parseInt(nodeMatch[4], 10) : undefined;
      const columnNumber = nodeMatch[5] ? parseInt(nodeMatch[5], 10) : undefined;

      results.push({
        type: errorType,
        message: errorMessage,
        filePath,
        fileName: filePath ? filePath.split(/[/\\]/).pop() : undefined,
        lineNumber,
        columnNumber
      });
    }

    // 4. GCC / Clang / C / C++ Compiler and Linker Errors
    // e.g. fcfs.c:4:6: error: expected identifier...
    const cCompilerRegex = /(?:^|\n)([^:\s\r\n]+\.[c|cpp|h|hpp|cc]):(\d+):(?:(\d+):)?\s*(error|warning|fatal error):\s*(.*)/gi;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = cCompilerRegex.exec(output)) !== null) {
      const filePath = cMatch[1];
      const lineNumber = parseInt(cMatch[2], 10);
      const columnNumber = cMatch[3] ? parseInt(cMatch[3], 10) : undefined;
      const severity = cMatch[4].toLowerCase();
      const message = cMatch[5]?.trim();

      results.push({
        type: `Compiler ${severity.toUpperCase()}`,
        message,
        filePath,
        fileName: filePath.split(/[/\\]/).pop(),
        lineNumber,
        columnNumber
      });
    }

    // 5. Java Stack Trace
    const javaRegex = /Exception in thread ".*?"\s+([a-zA-Z0-9_.$]+Exception):\s*(.*?)\r?\n\s+at\s+([a-zA-Z0-9_.$]+)\(([^:]+):(\d+)\)/g;
    let javaMatch: RegExpExecArray | null;
    while ((javaMatch = javaRegex.exec(output)) !== null) {
      results.push({
        type: javaMatch[1].split('.').pop() || javaMatch[1],
        message: javaMatch[2]?.trim(),
        fileName: javaMatch[4],
        lineNumber: parseInt(javaMatch[5], 10)
      });
    }

    return results;
  }

  /**
   * Format parsed errors as a concise string list for inclusion in AI prompts.
   */
  public static formatForPrompt(errors: ParsedRuntimeError[]): string {
    if (errors.length === 0) { return ''; }
    return errors.slice(0, 5).map(e => {
      const loc = e.lineNumber ? ` (line ${e.lineNumber}${e.columnNumber ? ':' + e.columnNumber : ''})` : '';
      return `[${e.type}]${loc}: ${e.message}`;
    }).join('\n');
  }
}
