import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ProviderManager } from '../providers/providerManager';
import { ContextCollector } from '../analysis/contextCollector';
import { RuntimeErrorParser } from '../analysis/runtimeErrorParser';
import { ErrorDetector } from '../analysis/errorDetector';
import { OutputValidator } from '../analysis/outputValidator';
import { PurposeDetector } from '../analysis/purposeDetector';
import { DebuggingReport } from '../types/analysis';

export class TerminalTutor {
  private static ptyTerminal?: vscode.Terminal;
  private static writeEmitter = new vscode.EventEmitter<string>();
  private static activeProcess?: cp.ChildProcess;

  public static initialize(): void {
    if (!this.ptyTerminal) {
      const pty: vscode.Pseudoterminal = {
        onDidWrite: this.writeEmitter.event,
        open: () => {},
        close: () => {
          this.activeProcess?.kill();
          this.activeProcess = undefined;
          this.ptyTerminal = undefined;
        },
        handleInput: (data: string) => {
          if (data === '\x03') {
            this.writeEmitter.fire('^C\r\n');
            this.activeProcess?.kill();
          } else if (this.activeProcess?.stdin && !this.activeProcess.killed) {
            // Handle backspace visual erasing and Enter display
            if (data === '\r') {
              this.writeEmitter.fire('\r\n');
            } else if (data === '\x7f' || data === '\b') {
              this.writeEmitter.fire('\b \b');
            } else {
              this.writeEmitter.fire(data);
            }
            // Send actual data to child process (CRLF on Windows for C runtime scanf)
            const toSend = data === '\r' ? (process.platform === 'win32' ? '\r\n' : '\n') : data;
            try {
              this.activeProcess.stdin.write(toSend);
            } catch (e) {}
          }
        }
      };

      this.ptyTerminal = vscode.window.createTerminal({
        name: 'AI Terminal Tutor',
        pty
      });
    }
  }

  public static async runActiveFileWithTutor(providerManager: ProviderManager): Promise<void> {
    this.initialize();
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No open code file to run.');
      return;
    }

    const document = editor.document;
    if (document.isDirty) {
      await document.save();
    }

    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    const cwd = path.dirname(filePath);

    // Determine execution command
    let command: string;
    let args: string[] = [];
    let outputBinary: string | undefined;

    switch (fileExt) {
      case '.py':
        command = 'python';
        args = [filePath];
        break;
      case '.js':
        command = 'node';
        args = [filePath];
        break;
      case '.c': {
        outputBinary = path.join(cwd, `${path.basename(fileName, '.c')}_bin.exe`);
        command = 'gcc';
        args = [filePath, '-o', outputBinary];
        break;
      }
      case '.cpp': {
        outputBinary = path.join(cwd, `${path.basename(fileName, '.cpp')}_bin.exe`);
        command = 'g++';
        args = [filePath, '-o', outputBinary];
        break;
      }
      default:
        vscode.window.showInformationMessage(`Runner not configured for "${fileExt}". Please execute in standard terminal.`);
        return;
    }

    this.ptyTerminal?.show(true);

    const emitter = this.writeEmitter;
    emitter.fire(`\r\n\x1b[1;34m▶ Running ${fileName}...\x1b[0m\r\n`);
    emitter.fire(`\x1b[90m$ ${command} ${args.map(arg => `"${arg}"`).join(' ')}\x1b[0m\r\n\r\n`);

    let stdoutOutput = '';
    let stderrOutput = '';

    const proc = cp.spawn(command, args, { cwd, shell: false });
    this.activeProcess = proc;

    proc.stdout.on('data', data => {
      const text = data.toString();
      stdoutOutput += text;
      emitter.fire(text.replace(/\r?\n/g, '\r\n'));
    });

    proc.stderr.on('data', data => {
      const text = data.toString();
      stderrOutput += text;
      emitter.fire(`\x1b[31m${text.replace(/\r?\n/g, '\r\n')}\x1b[0m`);
    });

    proc.on('close', async (code) => {
      // If C/C++ compilation succeeded, automatically execute the compiled binary!
      if (code === 0 && (fileExt === '.c' || fileExt === '.cpp')) {
        emitter.fire(`\x1b[1;32m✔ Build Succeeded. Running executable...\x1b[0m\r\n\r\n`);

        const runProc = cp.spawn(outputBinary!, [], { cwd, shell: false });
        this.activeProcess = runProc;

        runProc.stdout.on('data', d => {
          stdoutOutput += d.toString();
          emitter.fire(d.toString().replace(/\r?\n/g, '\r\n'));
        });

        runProc.stderr.on('data', d => {
          stderrOutput += d.toString();
          emitter.fire(`\x1b[31m${d.toString().replace(/\r?\n/g, '\r\n')}\x1b[0m`);
        });

        runProc.on('close', async (runCode) => {
          this.activeProcess = undefined;
          if (runCode !== 0) {
            await this.diagnoseAndPrintToTerminal(
              document,
              stderrOutput || stdoutOutput,
              runCode,
              providerManager
            );
          } else {
            // Check output for logical anomalies (garbage memory values, impossible scheduling metrics)
            const logicalIssues = OutputValidator.validate(stdoutOutput, document.getText(), document.languageId);
            const staticIssues = ErrorDetector.scan(document.getText(), document.languageId);
            if (logicalIssues.length > 0 || staticIssues.length > 0) {
              await this.diagnoseAndPrintToTerminal(
                document,
                stdoutOutput || '',
                runCode,
                providerManager
              );
            } else {
              // Always verify output with AI / checklister so the student gets explicit confirmation
              await this.diagnoseAndPrintToTerminal(
                document,
                stdoutOutput || '',
                0,
                providerManager
              );
            }
          }
        });

        return;
      }

      // Check if there was an error
      if (code !== 0 || stderrOutput.trim().length > 0) {
        await this.diagnoseAndPrintToTerminal(
          document,
          stderrOutput || stdoutOutput,
          code,
          providerManager
        );
      } else {
        await this.diagnoseAndPrintToTerminal(
          document,
          stdoutOutput || '',
          0,
          providerManager
        );
      }
      this.activeProcess = undefined;
    });

    proc.on('error', err => {
      this.activeProcess = undefined;
      emitter.fire(`\r\n\x1b[1;31mError launching process: ${err.message}\x1b[0m\r\n`);
    });
  }

  private static printStaticWarnings(document: vscode.TextDocument): void {
    const issues = ErrorDetector.scan(document.getText(), document.languageId);
    if (issues.length === 0) {
      return;
    }

    const emitter = this.writeEmitter;
    emitter.fire(`\r\n\x1b[1;33m⚠ Static checks found ${issues.length} possible logical issue(s):\x1b[0m\r\n`);
    for (const issue of issues.slice(0, 5)) {
      emitter.fire(
        `\x1b[1;33m│ Line ${issue.line} [${issue.category}]:\x1b[0m ${issue.message}\r\n`
      );
    }
    if (issues.length > 5) {
      emitter.fire(`\x1b[1;33m│ ... and ${issues.length - 5} more issue(s)\x1b[0m\r\n`);
    }
    emitter.fire('\x1b[1;33m│ Use "Analyze Current File" for the full AI explanation.\x1b[0m\r\n');
  }

  /**
   * Fast, minimal terminal diagnosis. Takes 1-3 seconds and prints a compact card directly in terminal.
   */
  private static async diagnoseAndPrintToTerminal(
    document: vscode.TextDocument,
    errorOutput: string,
    exitCode: number | null,
    providerManager: ProviderManager
  ): Promise<void> {
    const emitter = this.writeEmitter;
    emitter.fire(`\r\n\x1b[1;33m⚡ AI Checklister analyzing output & logic...\x1b[0m\r\n`);

    const activeProvider = providerManager.getActiveProvider();

    try {
      const codeCtx = ContextCollector.collectFromEditor(
        vscode.window.activeTextEditor!,
        { terminalOutput: errorOutput, exitCode: exitCode ?? undefined, maxLines: 150 }
      );

      // Fast analysis request
      const report: DebuggingReport = await activeProvider.analyze({
        context: codeCtx,
        mode: 'last_run'
      });

      this.printMinimalCard(report);
    } catch (err: any) {
      // Local fallback parser if AI call had any issue or when offline
      const logicalIssues = OutputValidator.validate(errorOutput, document.getText(), document.languageId);
      const parsed = RuntimeErrorParser.parse(errorOutput);
      const staticIssues = ErrorDetector.scan(document.getText(), document.languageId);

      if ((exitCode === 0 || exitCode === null) && logicalIssues.length === 0 && parsed.length === 0 && staticIssues.length === 0) {
        const purpose = PurposeDetector.detect(document.getText(), document.fileName);
        emitter.fire(`\r\n\x1b[1;32m┌── 🎯 AI Error Checklister ──────────────────────────────────────\x1b[0m\r\n`);
        emitter.fire(`\x1b[1;36m│ 📌 Intended Purpose:\x1b[0m ${purpose.purpose}\r\n`);
        emitter.fire(`\x1b[1;32m│ ✔️  Verdict: Logic & Output Verified Correct!\x1b[0m\r\n`);
        emitter.fire(`\x1b[1;32m│ 💡 Result:\x1b[0m Program executed successfully (exit code 0). Output values adhere to expected algorithm ranges.\r\n`);
        emitter.fire(`\x1b[1;32m└── Great job! Implementation is working as expected. ──────────\x1b[0m\r\n\r\n`);
        return;
      }

      emitter.fire(`\r\n\x1b[1;31m┌─ AI Error Checklister ─────────────────────────────────┐\x1b[0m\r\n`);
      if (logicalIssues.length > 0) {
        const issue = logicalIssues[0];
        const lineStr = issue.suspectedLine ? ` (Line ${issue.suspectedLine})` : '';
        emitter.fire(`\x1b[1;31m│ ❌ ${issue.summary}${lineStr}\x1b[0m\r\n`);
        emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${issue.rootCause}\r\n`);
        emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${issue.suggestedFix}\r\n`);
      } else if (parsed.length > 0) {
        const p = parsed[0];
        const lineStr = p.lineNumber ? ` (Line ${p.lineNumber})` : '';
        emitter.fire(`\x1b[1;31m│ ❌ Problem${lineStr}:\x1b[0m ${p.message || p.type}\r\n`);
        emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${p.type} detected from compiler/runtime output.\r\n`);
        const matchingStatic = staticIssues.find(s => s.line === p.lineNumber);
        if (matchingStatic?.suggestedFix) {
          emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${matchingStatic.suggestedFix}\r\n`);
        }
      } else if (staticIssues.length > 0) {
        const s = staticIssues[0];
        emitter.fire(`\x1b[1;31m│ ❌ Problem (Line ${s.line}):\x1b[0m ${s.message}\r\n`);
        emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${s.expected}\r\n`);
        if (s.suggestedFix) {
          emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${s.suggestedFix}\r\n`);
        }
      } else {
        emitter.fire(`\x1b[1;31m│ ❌ Process exited with error code ${exitCode}\x1b[0m\r\n`);
        emitter.fire(`\x1b[1;33m│ 💡 Check terminal stderr output above.\x1b[0m\r\n`);
      }
      emitter.fire(`\x1b[1;31m└────────────────────────────────────────────────────────┘\x1b[0m\r\n\r\n`);
    }
  }

  public static showOutputValidation(document: vscode.TextDocument, output: string): void {
    this.initialize();
    this.ptyTerminal?.show();

    const emitter = this.writeEmitter;
    const purpose = PurposeDetector.detect(document.getText(), document.fileName);
    const logicalIssues = OutputValidator.validate(output, document.getText(), document.languageId);
    const staticIssues = ErrorDetector.scan(document.getText(), document.languageId);

    emitter.fire(`\r\n\x1b[1;36m┌── 🎯 AI Error Checklister (Output & Logic Verification) ───────\x1b[0m\r\n`);
    emitter.fire(`\x1b[1;36m│ 📌 Intended Purpose:\x1b[0m ${purpose.purpose}\r\n`);

    if (logicalIssues.length > 0) {
      const issue = logicalIssues[0];
      const lineStr = issue.suspectedLine ? ` (Line ${issue.suspectedLine})` : '';
      emitter.fire(`\x1b[1;31m│ ❌ ${issue.summary}${lineStr}\x1b[0m\r\n`);
      emitter.fire(`\x1b[1;33m│ 💡 Why it happened:\x1b[0m ${issue.rootCause}\r\n`);
      emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${issue.suggestedFix}\r\n`);
      emitter.fire(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Variable Initialization & Loop Bounds.\r\n`);
      emitter.fire(`\x1b[1;31m└── Logic anomaly detected in program output! ──────────────────\x1b[0m\r\n\r\n`);
    } else if (staticIssues.length > 0) {
      const s = staticIssues[0];
      emitter.fire(`\x1b[1;31m│ ❌ Problem (Line ${s.line}):\x1b[0m ${s.message}\r\n`);
      emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${s.expected}\r\n`);
      if (s.suggestedFix) {
        emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${s.suggestedFix}\r\n`);
      }
      emitter.fire(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Logic & Boundary Verification.\r\n`);
      emitter.fire(`\x1b[1;31m└── Potential issue detected in code! ──────────────────────────\x1b[0m\r\n\r\n`);
    } else {
      emitter.fire(`\x1b[1;32m│ ✔️  Verdict: Logic & Output Verified Correct!\x1b[0m\r\n`);
      emitter.fire(`\x1b[1;32m│ 💡 Result:\x1b[0m Output metrics and calculations conform to expected ${purpose.purpose} behavior.\r\n`);
      emitter.fire(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Verification — Comparing actual execution output against algorithm constraints confirms correctness.\r\n`);
      emitter.fire(`\x1b[1;32m└── Great job! Implementation is working as expected. ──────────\x1b[0m\r\n\r\n`);
    }
  }

  public static printMinimalCard(report: DebuggingReport): void {
    const emitter = this.writeEmitter;
    const purpose = report.programPurpose.purpose || 'General Program';
    const finding = report.findings.length > 0 ? report.findings[0] : undefined;
    const fix = report.suggestedFixes.length > 0 ? report.suggestedFixes[0] : undefined;
    const learning = report.learningPoints.length > 0 ? report.learningPoints[0] : undefined;

    emitter.fire(`\r\n\x1b[1;36m┌── 🎯 AI Error Checklister ──────────────────────────────────────\x1b[0m\r\n`);
    emitter.fire(`\x1b[1;36m│ 📌 Intended Purpose:\x1b[0m ${purpose}\r\n`);

    if (report.programPurpose.isMismatch) {
      emitter.fire(`\x1b[1;33m│ ⚠️  Warning:\x1b[0m Header comment contradicts code implementation!\r\n`);
    }

    if (report.overallVerdict === 'likely_correct' || (!finding && !fix)) {
      emitter.fire(`\x1b[1;32m│ ✔️  Verdict: Logic & Output Verified Correct!\x1b[0m\r\n`);
      emitter.fire(`\x1b[1;32m│ 💡 Result:\x1b[0m ${report.verdictSummary || 'Program output values are valid and adhere to algorithm requirements.'}\r\n`);
      if (learning) {
        emitter.fire(`\x1b[1;35m│ 🧠 Learn:\x1b[0m \x1b[4m${learning.concept}\x1b[0m — ${learning.takeaway}\r\n`);
      }
      emitter.fire(`\x1b[1;32m└── Great job! Implementation is working as expected. ──────────\x1b[0m\r\n\r\n`);
      return;
    }

    if (finding) {
      const lineStr = finding.lineNumber ? ` (Line ${finding.lineNumber})` : '';
      const problemDesc = finding.actualBehavior && finding.actualBehavior !== 'Syntax error or runtime exception'
        ? finding.actualBehavior
        : (finding.explanation || report.verdictSummary);
      emitter.fire(`\x1b[1;31m│ ❌ Problem${lineStr}:\x1b[0m ${problemDesc}\r\n`);
      emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${finding.explanation}\r\n`);
      if (finding.codeSnippet) {
        emitter.fire(`\x1b[90m│    Snippet: ${finding.codeSnippet.trim()}\x1b[0m\r\n`);
      }
      const quickFix = finding.suggestedCorrection || fix?.replacementSnippet;
      if (quickFix) {
        emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${quickFix.trim()}\r\n`);
      }
    } else if (fix) {
      emitter.fire(`\x1b[1;31m│ ❌ Problem:\x1b[0m ${report.verdictSummary}\r\n`);
      emitter.fire(`\x1b[1;33m│ 💡 Why:\x1b[0m ${fix.explanation}\r\n`);
      emitter.fire(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${fix.replacementSnippet || fix.description}\r\n`);
    } else {
      emitter.fire(`\x1b[1;33m│ 💡 Note:\x1b[0m ${report.verdictSummary}\r\n`);
    }

    if (learning) {
      emitter.fire(`\x1b[1;35m│ 🧠 Learn:\x1b[0m \x1b[4m${learning.concept}\x1b[0m — ${learning.takeaway}\r\n`);
    }

    emitter.fire(`\x1b[1;36m└── Focus on the fix above and get back to coding! ───────────\x1b[0m\r\n\r\n`);
  }
}
