import * as fs from 'fs';
import * as path from 'path';
import { RuntimeErrorParser } from '../analysis/runtimeErrorParser';
import { ErrorDetector } from '../analysis/errorDetector';
import { OutputValidator } from '../analysis/outputValidator';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    return;
  }

  const logFilePath = args[0];
  const sourceFilePath = args[1];

  if (!fs.existsSync(sourceFilePath)) {
    return;
  }

  const source = fs.readFileSync(sourceFilePath, 'utf8');
  let output = '';
  if (fs.existsSync(logFilePath)) {
    output = fs.readFileSync(logFilePath, 'utf8');
  }

  const ext = path.extname(sourceFilePath).toLowerCase();
  const languageId = ext === '.c' ? 'c' : ext === '.cpp' ? 'cpp' : ext === '.py' ? 'python' : ext === '.js' ? 'javascript' : 'plaintext';

  // 1. Check for compiler / runtime crash in output
  const parsedErrors = RuntimeErrorParser.parse(output);

  // 2. Check for logical output anomalies (uninitialized memory, garbage values, impossible numbers)
  const logicalIssues = OutputValidator.validate(output, source, languageId);

  // 3. Check for static analysis issues in source
  const staticIssues = ErrorDetector.scan(source, languageId);

  // If nothing is wrong, exit silently
  if (parsedErrors.length === 0 && logicalIssues.length === 0 && staticIssues.length === 0) {
    return;
  }

  // Determine primary issue to report
  console.log('\r\n\x1b[1;36m┌── 🎯 AI Error Checklister ──────────────────────────────────────\x1b[0m');

  if (logicalIssues.length > 0) {
    const issue = logicalIssues[0];
    const lineStr = issue.suspectedLine ? ` (Line ${issue.suspectedLine})` : '';
    console.log(`\x1b[1;31m│ ❌ ${issue.summary}${lineStr}\x1b[0m`);
    console.log(`\x1b[1;33m│ 💡 Why it happened:\x1b[0m ${issue.rootCause}`);
    console.log(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${issue.suggestedFix}`);
    console.log(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Memory Initialization — Variables must be initialized before accumulation.`);
  } else if (parsedErrors.length > 0) {
    const err = parsedErrors[0];
    const lineStr = err.lineNumber ? ` (Line ${err.lineNumber})` : '';
    console.log(`\x1b[1;31m│ ❌ ${err.type}${lineStr}:\x1b[0m ${err.message}`);
    const matchingStatic = staticIssues.find(s => s.line === err.lineNumber);
    if (matchingStatic) {
      console.log(`\x1b[1;33m│ 💡 Why:\x1b[0m ${matchingStatic.message}`);
      if (matchingStatic.suggestedFix) {
        console.log(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${matchingStatic.suggestedFix}`);
      }
    } else {
      console.log(`\x1b[1;33m│ 💡 Check terminal stderr diagnostics above.\x1b[0m`);
    }
    console.log(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Code Syntax & Declaration Rules.`);
  } else if (staticIssues.length > 0) {
    const s = staticIssues[0];
    console.log(`\x1b[1;31m│ ❌ Problem (Line ${s.line}):\x1b[0m ${s.message}`);
    console.log(`\x1b[1;33m│ 💡 Why:\x1b[0m ${s.expected}`);
    if (s.suggestedFix) {
      console.log(`\x1b[1;32m│ 🛠️  Quick Fix:\x1b[0m ${s.suggestedFix}`);
    }
    console.log(`\x1b[1;35m│ 🧠 Learn:\x1b[0m Common programming pitfalls and boundary conditions.`);
  }

  console.log('\x1b[1;36m└── Focus on the fix above and get back to coding! ───────────\x1b[0m\r\n');
}

main().catch(() => {});

