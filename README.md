# AI Error Checklister — AI Debugging Tutor for VS Code

An AI-powered debugging tutor extension for Visual Studio Code designed specifically for student developers.

Instead of merely rephrasing compiler error messages into English, **AI Error Checklister** identifies what the student *intended* their program to do, analyzes logical errors, off-by-one loops, and algorithm mismatches, provides step-by-step execution traces, previews targeted fixes via diffs, and explains core computer science concepts.

---

## 🌟 Key Features

### 1. 🎯 Purpose-First Program Identification (Critical Requirement)
Every analysis starts by identifying what the program was intended to do before diagnosing bugs:
- **Priority to Header Comments**: Detects explicit algorithm titles (e.g. `// Round Robin Scheduling Algorithm`, `# Binary Search`).
- **Deep Structural Inference**: Inspects loops, variable patterns, and data structures when comments are absent.
- **Mismatch Detection**: Flags when a header comment claims an algorithm (e.g. Binary Search) but the implementation implements another (e.g. Bubble Sort or FCFS).
- **Graceful Unclear Handling**: Explicitly labels ambiguous scripts as general logic rather than hallucinating an algorithm.

### 2. 📋 8-Section Pedagogical Report
Every report adheres to a structured, 8-part format:
1. **Program Purpose**: Stated vs. Inferred with source badge and mismatch warning.
2. **Overall Verdict**: `Likely Correct`, `Bugs Detected`, `Potential Logical Issues`, or `Cannot Determine`. Never declares a program correct merely because it ran without throwing an exception.
3. **Problems Found**: Numbered issue cards with severity, category (`logic`, `compile-time`, `runtime`, `syntax`), validated file & line links that jump to code on click, snippet, expected vs. actual behavior, and root-cause explanation.
4. **Step-by-Step Logic Explanation & Loop Tracer**: Explains loop iterations, initial values, conditions, and termination checks with a tabular execution trace table.
5. **Suggested Fixes**: Focused patches preserving the student's original approach with **"Preview Diff"** and **"Apply Fix"** buttons (requires explicit user confirmation dialog).
6. **Verification Checklist**: Concrete test cases with inputs and expected outputs.
7. **What You Should Learn**: Explains the underlying programming concept and key takeaway.
8. **Limitations and Confidence**: Clear distinction between verified errors, assumptions, and confidence level.

### 3. 🔌 AI Provider Abstraction
- **Google Gemini (Default)**:
  - Cloud provider configured through a user-supplied API key.
  - Credentials are stored in VS Code `SecretStorage`.
  - Clear handling of quota (HTTP 429), auth (HTTP 401/403), and network errors.
- **Ollama (Local & Private)**:
  - Default Base URL: `http://localhost:11434` (API endpoint: `/api/chat`).
  - Configurable model (e.g. `llama3.2`, `codellama`, `qwen2.5-coder`).
  - Native JSON structured format.
  - Clear diagnosis if Ollama is not running (`ollama serve`) or model is missing (`ollama pull <model>`).
- **Mock Deterministic AI**:
  - Built-in deterministic tutor for offline testing, demos, and instant automated validation.

### 4. 🖥️ Native VS Code Integration
- **Webview UI**: Clean interface adhering to VS Code light and dark themes using standard `--vscode-*` CSS variables and strict Content Security Policy.
- **Diff Preview**: Review suggested code modifications side-by-side using `vscode.diff` before applying.
- **Status Bar Indicator**: Live display of active AI provider status.
- **Run & Capture**: Execute active Python, Node.js, C files and pipe runtime outputs directly into error analysis.
- **Live Server Error Monitoring**: Background listener with 3-second debouncing for long-running servers (e.g. Django, Express, Flask) that preserves server processes without killing them.
- **Debugging History**: Local report history persisted in workspace/global memento with configurable retention limit.

---

## ⌨️ Registered Commands & Shortcuts

| Command | Shortcut / UI | Description |
|---|---|---|
| `ai-error-checklister.runAndCapture` | **`Ctrl+Alt+R`** or top ▶️ button | **Run & Diagnose in Terminal**: Executes the active C/C++, Python, or JavaScript file. Errors produce a compact diagnosis; successful runs still show recognized static logic issues. |
| `ai-error-checklister.analyzeCurrentFile` | `Ctrl+Shift+P` | **Analyze Current File**: Performs static analysis and opens report. |
| `ai-error-checklister.analyzeSelection` | Right-click editor | **Analyze Selected Code**: Analyzes highlighted lines within surrounding context. |
| `ai-error-checklister.explainLoopOrAlgorithm` | `Ctrl+Shift+P` | **Explain Loop or Algorithm**: Generates a student trace table. |
| `ai-error-checklister.configureProvider` | `Ctrl+Shift+P` | **Configure AI Provider**: Switch models or endpoints. |

---

## ⚙️ Configuration Settings

Accessible via VS Code Settings (`Ctrl+,` or `Cmd+,`) under **AI Error Checklister**:

- `aiErrorChecklister.provider`: Active AI provider (`"gemini"` [default], `"ollama"`, or `"mock"`).
- `aiErrorChecklister.ollama.baseUrl`: Ollama server address (default: `http://localhost:11434`).
- `aiErrorChecklister.ollama.model`: Model tag to use (default: `llama3.2`).
- `aiErrorChecklister.gemini.model`: Gemini model name (default: `gemini-2.5-flash`).
- `aiErrorChecklister.requestTimeoutMs`: Request timeout in milliseconds (default: `45000`).
- `aiErrorChecklister.autoAnalyzeOnError`: Automatically prompt for analysis when a program exits with non-zero code (default: `false`).
- `aiErrorChecklister.liveMonitoring`: Enable background terminal monitoring for server errors (default: `false`).
- `aiErrorChecklister.maxSourceLines`: Max source lines included in AI prompt (default: `500`).
- `aiErrorChecklister.historyRetentionLimit`: Number of historical reports stored (default: `10`).

---

## 🚀 Running in VS Code Extension Development Host

1. Open this project directory in VS Code:
   ```powershell
   code "d:\AI for Student Developers"
   ```
2. Compile the extension:
   ```powershell
   npm run compile
   ```
3. Press **`F5`** (or open the **Run and Debug** view and select **`Run Extension`**).
4. A new **Extension Development Host** VS Code window will launch with **AI Error Checklister** installed and active.
5. In the host window, open any sample file (for instance `scheduling/fcfs.c`).
6. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`), type **`AI Error Checklister: Analyze Current File`**, and press Enter.
7. The Webview panel will open on the right showing the full 8-section debugging report.

---

## 🧪 Running Automated Tests

AI Error Checklister includes automated unit and integration tests that run deterministically without requiring an active internet connection or paid API key.

To compile and execute the test suite:
```powershell
npm test
```

### Test Coverage Summary:
- **Purpose Detection**: Comment priority, code inference, mismatch detection, ambiguous programs.
- **Report Validation**: Schema compliance, line number clamping to file bounds, markdown fence stripping, malformed JSON recovery.
- **Runtime Error Parsing**: Python tracebacks, Node.js stack traces, GCC/Clang diagnostics, Java stack traces.
- **Static Error Detection**: C missing variable types, uninitialized variable accumulators (`+=`), condition assignments (`=`), off-by-one loops (`<=`).
- **Provider Reliability**: Ollama connection failures, missing models, Gemini missing/invalid keys, mock responses.
- **Execution Tracking**: Exit codes, listener notifications, history retention limits.

---

## 📦 Packaging into a VSIX File

To bundle the extension into an installable `.vsix` package:

1. Install `@vscode/vsce` globally or run via npx:
   ```powershell
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```powershell
   vsce package
   ```
3. This generates `ai-error-checklister-0.1.0.vsix`.
4. Install it in any VS Code instance:
   ```powershell
   code --install-extension ai-error-checklister-0.1.0.vsix
   ```
   Or inside VS Code: Extensions view (`Ctrl+Shift+X`) &rarr; `...` (Views and More Actions) &rarr; **Install from VSIX...**.

---

## 🛡️ Security & Privacy Guarantees

- **No Arbitrary Code Execution**: The extension never executes AI-generated code or patches automatically. Applying a fix requires explicit student confirmation dialog.
- **Local-First Default**: Powered by local Ollama by default, ensuring student code does not leave the machine unless Gemini is explicitly configured.
- **SecretStorage API**: API keys for external services (Gemini) are stored in encrypted OS credential storage via VS Code's `SecretStorage` API, never in workspace files or git repositories.
- **Webview Isolation**: All Webviews enforce a strict Content Security Policy (`default-src 'none'`), nonce-guarded scripts, and sanitized HTML output preventing XSS.

---

## 📄 License

MIT License. See [LICENSE](file:///d:/AI%20for%20Student%20Developers/LICENSE) for full details.
