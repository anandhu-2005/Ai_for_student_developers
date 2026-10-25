# 🎯 AI Error Checklister — VS Code Extension

> A minimal, terminal-first AI debugging tutor for student programmers.  
> When your code breaks, it tells you **what broke, why, and how to fix it** — instantly, right in the terminal.

---

## 💡 The Idea

Most students waste 30–60 minutes staring at a compiler error they don't understand.  
Stack Overflow gives them unrelated answers. ChatGPT writes an essay.  
Neither helps them **learn and move on quickly**.

**AI Error Checklister** fixes that.

The moment your program crashes — whether it's a syntax error, a runtime exception, or a silent logic bug — the extension catches it and drops a **compact 5-line AI diagnosis card** directly below the error in your terminal:

```
┌── 🎯 AI Error Checklister ────────────────────────────────
│ 📌 Intended Purpose: FCFS CPU Scheduling Algorithm
│ ❌ Problem (Line 21): Loop starts at i=8, skips first 8 processes
│ 💡 Why it happened: Array index starts at 0 not 8; earlier iterations are garbage
│ 🛠️  Quick Fix: Change for(i=8; i<n; i++) → for(i=1; i<n; i++)
│ 🧠 What to Learn: Array Indexing — In C, arrays are 0-indexed by default.
└── Focus on the fix above and get back to coding! ─────────
```

No long paragraphs. No essays. Just the fix. Get back to coding.

---

## ✨ Features

| Feature | Description |
|---|---|
| **`Ctrl+Alt+R`** | Run active file + auto-diagnose errors with AI |
| **Gemini API (Cloud)** | Fast ~1s response using Google's Gemini model |
| **Ollama (Local)** | Offline support using `qwen2.5-coder:7b` on your machine |
| **Status Bar Toggle** | Click `⚡ AI: Gemini (Cloud)` in bottom bar to switch providers |
| **Static Analysis** | Catches common bugs even before the AI (uninitialized vars, wrong loop starts, off-by-one) |
| **Exit Code 0 Detection** | Detects silent logic bugs even when program doesn't crash |
| **Multi-language** | Supports C, C++, Python, JavaScript |
| **Compact terminal card** | Short diagnosis in the terminal, with a full report available in the webview |

---

## 🚀 How to Use

### Step 1 — Open your code file
Open any `.c`, `.cpp`, `.py`, or `.js` file in the VS Code editor.

### Step 2 — Press `Ctrl+Alt+R`
The extension will:
1. Save your file automatically
2. Compile it (for C/C++) using `gcc` / `g++`
3. Run the executable or script
4. If there is an error, the active AI provider diagnoses it and prints a compact card
5. Even when execution succeeds, local static checks report recognized logical issues

### Step 3 — Read the card, fix the bug, move on

> ⚠️ **Important:** Running from the regular PowerShell terminal does NOT trigger the extension.  
> You must use `Ctrl+Alt+R` with the file open in VS Code.

---

## 📁 Project Structure

```
d:\AI for Student Developers\
│
├── src/
│   ├── extension.ts              ← Entry point, activates extension
│   ├── commands/index.ts         ← All 11 registered VS Code commands
│   │
│   ├── terminal/
│   │   ├── terminalTutor.ts      ← Core: runs code + catches errors + prints AI card
│   │   ├── codeRunner.ts         ← Alternative runner
│   │   ├── executionTracker.ts   ← Tracks last run metadata
│   │   └── liveMonitor.ts        ← Server error debounce monitor
│   │
│   ├── providers/
│   │   ├── AIProvider.ts         ← Abstract base + prompt builder
│   │   ├── GeminiProvider.ts     ← Google Gemini API (cloud, fast)
│   │   ├── OllamaProvider.ts     ← Local Ollama (offline, qwen2.5-coder:7b)
│   │   ├── MockProvider.ts       ← Deterministic mock for testing
│   │   └── providerManager.ts    ← Factory: selects active provider, handles toggle
│   │
│   ├── analysis/
│   │   ├── purposeDetector.ts    ← Detects what the program is supposed to do
│   │   ├── errorDetector.ts      ← Static heuristic rules (catches common student bugs)
│   │   ├── runtimeErrorParser.ts ← Parses GCC errors, Python tracebacks, Node.js stacks
│   │   ├── contextCollector.ts   ← Gathers all context before calling AI
│   │   ├── diagnostics.ts        ← VS Code language diagnostics
│   │   └── reportValidator.ts    ← Validates + repairs AI JSON response (never fails)
│   │
│   ├── ui/
│   │   ├── statusBar.ts          ← Bottom bar pill showing active AI provider
│   │   ├── webviewPanel.ts       ← Full report webview (for deep analysis)
│   │   └── htmlTemplate.ts       ← HTML template for webview panel
│   │
│   ├── storage/
│   │   └── historyManager.ts     ← Stores past analysis reports
│   │
│   └── types/
│       ├── analysis.ts           ← DebuggingReport, Finding, SuggestedFix types
│       ├── provider.ts           ← AIProvider interface, CodeContext, AnalysisRequest
│       └── history.ts            ← HistoryItem type
│
├── test/
│   ├── purposeDetector.test.ts
│   ├── reportValidator.test.ts
│   ├── runtimeErrorParser.test.ts
│   ├── errorDetector.test.ts
│   ├── providerFailure.test.ts
│   ├── executionTracker.test.ts
│   ├── integration.test.ts       ← 8 end-to-end scenarios
│   └── test-env.d.ts
│
├── test-runner.js                ← Custom test harness (no mocha needed)
├── package.json                  ← Extension manifest + commands + keybindings
└── tsconfig.json
```

---

## ⚙️ Configuration

These settings are in VS Code Settings (`Ctrl+,`) under `aiErrorChecklister`:

| Setting | Default | Description |
|---|---|---|
| `aiErrorChecklister.provider` | `gemini` | Active provider: `gemini`, `ollama`, or `mock` |
| `aiErrorChecklister.gemini.model` | `gemini-2.5-flash-lite` | Gemini model name |
| `aiErrorChecklister.ollama.model` | `qwen2.5-coder:7b` | Ollama model name |
| `aiErrorChecklister.ollama.baseUrl` | `http://localhost:11434` | Ollama server URL |
| `aiErrorChecklister.requestTimeoutMs` | `180000` | AI request timeout (ms) |

### Gemini API Key
No API key should be committed to the project or extension package. Configure your own key through:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run **AI Error Checklister: Configure AI Provider**
3. Choose **Set / Update Gemini API Key**

The extension stores the configured key in VS Code SecretStorage. If no key is configured,
Gemini analysis cannot run; use Ollama or Mock for local/offline operation.

---

## 🧠 How the AI Diagnosis Works

```
Student presses Ctrl+Alt+R
        │
        ▼
   File saved automatically
        │
        ▼
  gcc / python / node spawned
  Output streamed to terminal
        │
   Error detected?
   (exit code ≠ 0  OR  static bugs found even on success)
        │
        ▼
  ContextCollector gathers:
  ├── Full source code
  ├── Terminal error output
  ├── Static heuristic flags  ← sent FIRST to AI
  └── Detected program purpose (from comments/code)
        │
        ▼
  AI Provider called (Gemini or Ollama)
  Response validated + repaired if needed
        │
        ▼
  Compact 5-line card printed in terminal
```

---

## 🔍 Static Analysis Rules (No AI Needed)

These bugs are caught **before** calling the AI, instantly:

| Rule | Example Bug |
|---|---|
| Missing type specifier | `i, n, bt[20];` → missing `int` |
| Uninitialized accumulator | `wtavg += wt[i]` when `wtavg` never set to `0` |
| Assignment in condition | `if (x = 5)` instead of `if (x == 5)` |
| Off-by-one loop | `for(i=0; i<=n; i++)` accessing index `n` out of bounds |
| Wrong loop start | `for(i=8; i<n; i++)` skipping first 8 elements |
| Infinite loop | `while(1)` with no `break` or `return` |

---

## 🧪 Running Tests

```bash
npm run compile       # TypeScript compile — should show 0 errors
node test-runner.js   # Run 31 unit tests — should show 31 passed, 0 failed
```

---

## 🛠️ Development Setup

> ⚠️ This machine is behind a corporate proxy — do NOT run `npm install`.  
> All dependencies are already manually placed in `node_modules/`.

**To launch the extension:**
1. Open `d:\AI for Student Developers` in VS Code
2. Press `F5` → Extension Development Host opens
3. Open a `.c` / `.py` / `.js` file
4. Press `Ctrl+Alt+R`

---

## 📋 Commands

| Command | Shortcut | Description |
|---|---|---|
| Run & Analyze Active File | `Ctrl+Alt+R` | Main: run + AI diagnose |
| Analyze Current File | — | Deep analysis without running |
| Analyze Selection | — | Analyze highlighted code only |
| Analyze Last Run | — | Analyze the latest captured execution |
| Explain Loop or Algorithm | — | Generate a step-by-step loop/algorithm trace |
| Open Debugging Report | — | Reopen the latest saved report |
| Configure AI Provider | — | Set Gemini API key |
| Toggle AI Provider | — | Switch Gemini ↔ Ollama |
| Test AI Connection | — | Ping active provider |
| Enable/Disable Live Monitoring | — | Watch supported terminal errors |
| Clear Analysis History | — | Wipe stored history |

---

## 🌐 AI Providers

### Google Gemini (Default)
- **Model:** `gemini-2.5-flash-lite`
- **Requires:** Internet + a user-configured API key

### Ollama (Local — Offline)
- **Model:** `qwen2.5-coder:7b`
- **Speed:** ~5–15 seconds depending on hardware
- **Requires:** Ollama running on `localhost:11434`

**To switch:** Click the `⚡ AI: Gemini (Cloud)` pill in the VS Code status bar.

### Mock (Offline Testing)
- **Provider:** Deterministic built-in responses
- **Requires:** No network or model installation
- **Use:** Demos, automated tests, and provider-independent UI checks

## 🧪 Supported execution

The Run & Diagnose command currently supports:

- `.c` through `gcc`, followed by the generated Windows executable
- `.cpp` through `g++`, followed by the generated Windows executable
- `.py` through `python`
- `.js` through `node`

The runner passes paths as process arguments instead of relying on shell parsing, so
workspace paths containing spaces are supported. Input typed into the AI Terminal Tutor
is forwarded to the running program, including programs that use `scanf`.

Programs are not executed automatically when opened in a normal PowerShell terminal.
Use the extension command or `Ctrl+Alt+R` to get terminal-tutor diagnosis and static checks.

---

## 🎓 Design Philosophy

> "When a student's program fails, they don't need a lecture.  
> They need the fix, the reason, and one thing to remember — in under 5 seconds."

- **Terminal-first:** No popups. Diagnosis appears where the error appeared.
- **Minimal output:** 5 lines max. Read, fix, done.
- **Purpose-aware:** AI identifies what the program *should* do before judging what it *does*.
- **Never blocks:** If AI fails, local static analysis still shows a fallback card.
- **Student-safe:** Never auto-applies fixes. Always shows a suggestion only.

---

## 👨‍💻 Built For

Students learning:
- **C / C++** — scheduling algorithms, data structures, OS lab programs
- **Python** — loops, functions, file I/O, logic problems
- **JavaScript** — Node.js scripts, console programs

Inspired by having a knowledgeable friend in the lab who taps you on the shoulder and says  
*"hey, your loop starts at 8 not 1"* — and nothing more.
