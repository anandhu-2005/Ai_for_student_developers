import { DebuggingReport } from '../types/analysis';

export function escapeHtml(unsafe: string): string {
  if (!unsafe) {
    return '';
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateReportHtml(
  report: DebuggingReport | null,
  activeProviderName: string,
  nonce: string,
  isLoading: boolean = false,
  loadingMessage: string = 'Analyzing program with AI Tutor...'
): string {
  if (isLoading) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>AI Error Checklister</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      box-sizing: border-box;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
      border-top-color: var(--vscode-progressBar-background, #007acc);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { font-size: 1.2rem; font-weight: 500; margin-bottom: 8px; }
    p { color: var(--vscode-descriptionForeground, #888); font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>${escapeHtml(loadingMessage)}</h2>
  <p>Active Provider: <strong>${escapeHtml(activeProviderName)}</strong></p>
</body>
</html>`;
  }

  if (!report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>AI Error Checklister</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 32px 24px;
      text-align: center;
    }
    .empty-card {
      max-width: 500px;
      margin: 40px auto;
      padding: 32px;
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      border-radius: 8px;
      background: var(--vscode-editorWidget-background, rgba(0,0,0,0.05));
    }
    h1 { font-size: 1.4rem; margin-bottom: 12px; }
    p { color: var(--vscode-descriptionForeground); margin-bottom: 24px; line-height: 1.5; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 18px;
      font-size: 0.95rem;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="empty-card">
    <h1>AI Error Checklister</h1>
    <p>Open any source file in VS Code and click <strong>Analyze Current File</strong> to identify your program's purpose and inspect errors.</p>
    <button id="btnAnalyze">Analyze Active File</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('btnAnalyze')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'analyzeActive' });
    });
  </script>
</body>
</html>`;
  }

  // Verdict badge class
  let verdictBadgeClass = 'badge-yellow';
  let verdictLabel = 'Potential Issues';
  if (report.overallVerdict === 'likely_correct') {
    verdictBadgeClass = 'badge-green';
    verdictLabel = 'Likely Correct';
  } else if (report.overallVerdict === 'bugs_detected') {
    verdictBadgeClass = 'badge-red';
    verdictLabel = 'Bugs Detected';
  } else if (report.overallVerdict === 'cannot_determine') {
    verdictBadgeClass = 'badge-gray';
    verdictLabel = 'Cannot Determine';
  }

  // Purpose badge
  let purposeSourceLabel = 'Inferred';
  if (report.programPurpose.source === 'explicit_comment') {
    purposeSourceLabel = 'Explicit Comment';
  } else if (report.programPurpose.source === 'mismatch_detected') {
    purposeSourceLabel = 'MISMATCH DETECTED';
  } else if (report.programPurpose.source === 'user_specified') {
    purposeSourceLabel = 'User Specified';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>AI Error Checklister Report</title>
  <style>
    :root {
      --card-bg: var(--vscode-editorWidget-background, rgba(128,128,128,0.06));
      --card-border: var(--vscode-panel-border, rgba(128,128,128,0.25));
      --tag-bg: var(--vscode-badge-background, #333);
      --tag-fg: var(--vscode-badge-foreground, #fff);
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
    }
    .header-title h1 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-meta {
      font-size: 0.85rem;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    .header-actions {
      display: flex;
      gap: 8px;
    }
    button.btn-action {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
      border: none;
      padding: 6px 12px;
      font-size: 0.85rem;
      border-radius: 4px;
      cursor: pointer;
    }
    button.btn-action:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    button.btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Section 1: Purpose Card */
    .purpose-card {
      background: var(--card-bg);
      border-left: 4px solid var(--vscode-activityBarBadge-background, #007acc);
      border-radius: 0 6px 6px 0;
      padding: 16px 20px;
      margin-bottom: 24px;
      border-top: 1px solid var(--card-border);
      border-right: 1px solid var(--card-border);
      border-bottom: 1px solid var(--card-border);
    }
    .purpose-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .purpose-title {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
    }
    .purpose-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 6px 0;
      color: var(--vscode-editor-foreground);
    }
    .purpose-explanation {
      margin: 0;
      font-size: 0.95rem;
      color: var(--vscode-descriptionForeground);
    }
    .mismatch-banner {
      margin-top: 10px;
      padding: 8px 12px;
      background: rgba(230, 81, 0, 0.15);
      border-left: 3px solid #ff9800;
      color: #ffb74d;
      font-size: 0.9rem;
      border-radius: 2px;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-source {
      background: var(--tag-bg);
      color: var(--tag-fg);
    }
    .badge-green {
      background: #1b5e20;
      color: #a5d6a7;
    }
    .badge-red {
      background: #b71c1c;
      color: #ffcdd2;
    }
    .badge-yellow {
      background: #e65100;
      color: #ffe0b2;
    }
    .badge-gray {
      background: #424242;
      color: #e0e0e0;
    }

    /* Section 2: Verdict */
    .verdict-box {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .verdict-text {
      flex: 1;
    }
    .verdict-text h3 {
      margin: 0 0 4px 0;
      font-size: 1.05rem;
    }
    .verdict-text p {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9rem;
    }

    /* Section Headings */
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 6px;
    }
    .section-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 0.75rem;
    }

    /* Section 3: Finding Cards */
    .finding-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .finding-title {
      font-weight: 600;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .line-link {
      color: var(--vscode-textLink-foreground, #3794ff);
      cursor: pointer;
      text-decoration: underline;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .line-link:hover {
      color: var(--vscode-textLink-activeForeground, #3794ff);
    }
    .finding-row {
      margin-top: 8px;
      font-size: 0.9rem;
    }
    .finding-row strong {
      color: var(--vscode-descriptionForeground);
      display: inline-block;
      width: 140px;
    }
    .code-block {
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.2));
      padding: 8px 12px;
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.88rem;
      overflow-x: auto;
      margin: 6px 0;
    }

    /* Section 4: Loop Trace Table */
    .trace-table-container {
      overflow-x: auto;
      margin: 12px 0;
    }
    table.trace-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;
    }
    table.trace-table th {
      background: var(--card-bg);
      border-bottom: 2px solid var(--card-border);
      padding: 8px 10px;
      font-weight: 600;
    }
    table.trace-table td {
      border-bottom: 1px solid var(--card-border);
      padding: 8px 10px;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .trace-notes {
      font-size: 0.82rem;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      margin-top: 6px;
    }

    /* Section 5: Suggested Fixes */
    .fix-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 14px;
    }
    .fix-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    /* Section 6: Verification Checklist */
    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 0.92rem;
    }
    .checklist-item input[type="checkbox"] {
      margin-top: 4px;
      cursor: pointer;
    }
    .checklist-details {
      flex: 1;
    }
    .checklist-io {
      font-size: 0.82rem;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }

    /* Section 7: Learning Points */
    .learning-box {
      background: rgba(0, 122, 204, 0.08);
      border-left: 4px solid var(--vscode-progressBar-background, #007acc);
      padding: 14px 18px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 20px;
    }
    .learning-concept {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 6px;
      color: var(--vscode-editor-foreground);
    }
    .learning-takeaway {
      font-weight: 500;
      color: var(--vscode-textLink-foreground, #3794ff);
      margin-top: 6px;
    }

    /* Section 8: Limitations */
    .limitations-box {
      font-size: 0.85rem;
      color: var(--vscode-descriptionForeground);
      padding: 12px 16px;
      background: var(--card-bg);
      border-radius: 6px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>

  <!-- Top Header Bar -->
  <div class="header-bar">
    <div class="header-title">
      <h1>AI Error Checklister</h1>
      <div class="header-meta">
        ${escapeHtml(report.fileName)} &bull; ${escapeHtml(report.languageId)} &bull; ${new Date(report.timestamp).toLocaleTimeString()} &bull; Provider: <strong>${escapeHtml(activeProviderName)}</strong>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-action" id="btnConfigProvider">Provider Settings</button>
      <button class="btn-action btn-primary" id="btnReanalyze">Re-Analyze</button>
    </div>
  </div>

  <!-- 1. Program Purpose (CRITICAL REQUIREMENT: Must appear first) -->
  <div class="purpose-card">
    <div class="purpose-header">
      <div class="purpose-title">1. Program Purpose</div>
      <span class="badge badge-source">${escapeHtml(purposeSourceLabel)}</span>
    </div>
    <div class="purpose-name">${escapeHtml(report.programPurpose.purpose)}</div>
    <p class="purpose-explanation">${escapeHtml(report.programPurpose.explanation)}</p>
    ${report.programPurpose.isMismatch ? `
      <div class="mismatch-banner">
        <strong>Warning (Purpose Mismatch):</strong> The code implementation appears to diverge from the stated comment. Verify if the algorithm being tested is intended.
      </div>
    ` : ''}
  </div>

  <!-- 2. Overall Verdict -->
  <div class="verdict-box">
    <span class="badge ${verdictBadgeClass}">${escapeHtml(verdictLabel)}</span>
    <div class="verdict-text">
      <h3>Overall Verdict: ${escapeHtml(verdictLabel)}</h3>
      <p>${escapeHtml(report.verdictSummary)}</p>
    </div>
  </div>

  <!-- 3. Problems Found -->
  <div class="section-title">
    <span>3. Problems Found</span>
    <span class="section-badge">${report.findings.length}</span>
  </div>

  ${report.findings.length === 0 ? `
    <div class="finding-card" style="text-align: center; color: var(--vscode-descriptionForeground);">
      No syntax or logical defects detected in this evaluation. Check the verification checklist below to validate edge cases.
    </div>
  ` : report.findings.map(f => `
    <div class="finding-card">
      <div class="finding-header">
        <div class="finding-title">
          <span>Issue #${f.issueNumber}</span>
          <span class="badge ${f.severity === 'error' ? 'badge-red' : f.severity === 'warning' ? 'badge-yellow' : 'badge-gray'}">${escapeHtml(f.severity)}</span>
          <span class="badge badge-source">${escapeHtml(f.category)}</span>
        </div>
        ${f.lineNumber ? `
          <div class="line-link" data-line="${f.lineNumber}">
            Line ${f.lineNumber} &rarr; Jump to Code
          </div>
        ` : ''}
      </div>

      <div class="finding-row">
        <strong>Explanation:</strong>
        <span>${escapeHtml(f.explanation)}</span>
      </div>

      ${f.codeSnippet ? `
        <div class="code-block">${escapeHtml(f.codeSnippet)}</div>
      ` : ''}

      <div class="finding-row">
        <strong>Expected:</strong>
        <span>${escapeHtml(f.expectedBehavior)}</span>
      </div>

      <div class="finding-row">
        <strong>Actual:</strong>
        <span>${escapeHtml(f.actualBehavior)}</span>
      </div>

      ${f.suggestedCorrection ? `
        <div class="finding-row" style="margin-top: 8px;">
          <strong>Suggested Fix:</strong>
          <div class="code-block" style="color: #4ec9b0;">${escapeHtml(f.suggestedCorrection)}</div>
        </div>
      ` : ''}
    </div>
  `).join('')}

  <!-- 4. Step-by-Step Logic Explanation & Loop Trace -->
  <div class="section-title">
    <span>4. Step-by-Step Logic Explanation</span>
  </div>
  <div class="finding-card">
    <p style="white-space: pre-wrap; margin: 0 0 12px 0;">${escapeHtml(report.logicExplanation)}</p>

    ${report.loopTrace ? `
      <h4 style="margin: 16px 0 8px 0; font-size: 0.95rem;">${escapeHtml(report.loopTrace.title || 'Loop & Algorithm Execution Trace')} ${report.loopTrace.isIllustrative ? '<small style="color:var(--vscode-descriptionForeground); font-weight:normal;">(Illustrative)</small>' : ''}</h4>
      <div class="trace-table-container">
        <table class="trace-table">
          <thead>
            <tr>
              ${report.loopTrace.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${report.loopTrace.rows.map(r => `
              <tr>
                <td>${escapeHtml(String(r.iteration))}</td>
                <td>${escapeHtml(r.varsBefore)}</td>
                <td>${escapeHtml(r.condition)}</td>
                <td>${escapeHtml(r.operation)}</td>
                <td>${escapeHtml(r.varsAfter)}</td>
                <td>${escapeHtml(r.output)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${report.loopTrace.notes ? `<div class="trace-notes">${escapeHtml(report.loopTrace.notes)}</div>` : ''}
    ` : ''}
  </div>

  <!-- 5. Suggested Fixes -->
  <div class="section-title">
    <span>5. Suggested Fixes</span>
    <span class="section-badge">${report.suggestedFixes.length}</span>
  </div>

  ${report.suggestedFixes.length === 0 ? `
    <div class="finding-card" style="color: var(--vscode-descriptionForeground);">
      No specific code patch required.
    </div>
  ` : report.suggestedFixes.map(fix => `
    <div class="fix-card">
      <h4 style="margin: 0 0 6px 0;">${escapeHtml(fix.description)}</h4>
      <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: var(--vscode-descriptionForeground);">${escapeHtml(fix.explanation)}</p>

      ${fix.originalSnippet ? `
        <div style="font-size: 0.8rem; font-weight: 600; color: #f48771;">Original:</div>
        <div class="code-block" style="border-left: 3px solid #f48771;">${escapeHtml(fix.originalSnippet)}</div>
      ` : ''}

      ${fix.replacementSnippet ? `
        <div style="font-size: 0.8rem; font-weight: 600; color: #89d185;">Replacement:</div>
        <div class="code-block" style="border-left: 3px solid #89d185;">${escapeHtml(fix.replacementSnippet)}</div>
      ` : ''}

      <div class="fix-actions">
        <button class="btn-action btnPreviewDiff" data-fix-id="${escapeHtml(fix.id)}">Preview Diff</button>
        <button class="btn-action btn-primary btnApplyFix" data-fix-id="${escapeHtml(fix.id)}">Apply Fix...</button>
      </div>
    </div>
  `).join('')}

  <!-- 6. Verification Checklist -->
  <div class="section-title">
    <span>6. Verification Checklist</span>
    <span class="section-badge">${report.verificationChecklist.length}</span>
  </div>

  <div class="finding-card">
    ${report.verificationChecklist.length === 0 ? `
      <div style="color: var(--vscode-descriptionForeground);">No specific verification test cases generated.</div>
    ` : report.verificationChecklist.map((item, idx) => `
      <div class="checklist-item">
        <input type="checkbox" id="chk_${idx}">
        <div class="checklist-details">
          <label for="chk_${idx}" style="cursor: pointer; font-weight: 500;">${escapeHtml(item.step)}</label>
          ${item.testInput || item.expectedOutput ? `
            <div class="checklist-io">
              ${item.testInput ? `<span><strong>Input:</strong> <code>${escapeHtml(item.testInput)}</code></span> ` : ''}
              ${item.expectedOutput ? `<span><strong>Expected:</strong> <code>${escapeHtml(item.expectedOutput)}</code></span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>

  <!-- 7. What You Should Learn -->
  <div class="section-title">
    <span>7. What You Should Learn</span>
  </div>

  ${report.learningPoints.map(lp => `
    <div class="learning-box">
      <div class="learning-concept">${escapeHtml(lp.concept)}</div>
      <div style="font-size: 0.92rem;">${escapeHtml(lp.explanation)}</div>
      <div class="learning-takeaway">&bull; Takeaway: ${escapeHtml(lp.takeaway)}</div>
    </div>
  `).join('')}

  <!-- 8. Limitations and Confidence -->
  <div class="section-title">
    <span>8. Limitations & Confidence</span>
  </div>

  <div class="limitations-box">
    <div><strong>Confidence Level:</strong> <span class="badge ${report.confidence === 'high' ? 'badge-green' : report.confidence === 'medium' ? 'badge-yellow' : 'badge-gray'}">${escapeHtml(report.confidence)}</span></div>
    ${report.assumptions.length > 0 ? `
      <div style="margin-top: 6px;"><strong>Assumptions:</strong> ${escapeHtml(report.assumptions.join('; '))}</div>
    ` : ''}
    ${report.limitations.length > 0 ? `
      <div style="margin-top: 4px;"><strong>Limitations:</strong> ${escapeHtml(report.limitations.join('; '))}</div>
    ` : ''}
  </div>

  <!-- Webview Interaction Script -->
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Line navigation
    document.querySelectorAll('.line-link').forEach(el => {
      el.addEventListener('click', () => {
        const line = parseInt(el.getAttribute('data-line'), 10);
        if (line) {
          vscode.postMessage({ command: 'jumpToLine', line });
        }
      });
    });

    // Preview diff
    document.querySelectorAll('.btnPreviewDiff').forEach(el => {
      el.addEventListener('click', () => {
        const fixId = el.getAttribute('data-fix-id');
        vscode.postMessage({ command: 'previewDiff', fixId });
      });
    });

    // Apply fix
    document.querySelectorAll('.btnApplyFix').forEach(el => {
      el.addEventListener('click', () => {
        const fixId = el.getAttribute('data-fix-id');
        vscode.postMessage({ command: 'applyFix', fixId });
      });
    });

    // Header actions
    document.getElementById('btnConfigProvider')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'configureProvider' });
    });

    document.getElementById('btnReanalyze')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'reanalyze' });
    });
  </script>
</body>
</html>`;
}

