import * as vscode from 'vscode';
import { getCommitLog, getDefaultBranch } from '../git';
import { generate, getLanguage } from '../ai';

const SYSTEM = (language: string) => `You are an expert at writing pull request descriptions.
Rules:
- Write a clear title (max 72 chars)
- Write a concise summary of what changed and why
- Use bullet points for the main changes
- Add a "## How to test" section if relevant
- Be direct — no filler phrases
- Format: markdown
- Respond with ONLY the PR title on the first line, then a blank line, then the body
- PR title and body MUST be in ${language}`;

export async function prCommand(): Promise<void> {
    const defaultBranch = getDefaultBranch();
    const base = await vscode.window.showInputBox({
        prompt: 'Base branch',
        value: defaultBranch,
        placeHolder: defaultBranch
    });
    if (base === undefined) return;

    let prText = '';
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Graft: generating PR description...' },
        async () => {
            const log = getCommitLog(base || 'main');
            const language = getLanguage();
            prText = await generate(
                SYSTEM(language),
                `Generate a PR title and description based on these commits:\n\n${log}`
            );
        }
    );

    if (!prText) return;

    const lines = prText.split('\n');
    const title = lines[0]?.trim() ?? '';
    const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() !== '');
    const body = bodyStart > 0 ? lines.slice(bodyStart).join('\n').trim() : '';

    showPrPanel(title, body);
}

function showPrPanel(title: string, body: string): void {
    const panel = vscode.window.createWebviewPanel(
        'graftPr',
        'Graft: PR Description',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getPrHtml(title, body);
    panel.webview.onDidReceiveMessage(msg => {
        if (msg.type === 'copy') {
            vscode.env.clipboard.writeText(`${title}\n\n${body}`);
            vscode.window.showInformationMessage('Graft: PR description copied to clipboard.');
        }
    });
}

function getPrHtml(title: string, body: string): string {
    const escapedTitle = escapeHtml(title);
    const escapedBody = escapeHtml(body);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Graft PR</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--vscode-editor-background); color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px; padding: 20px; }
h2 { font-size: 1em; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
.title { font-size: 1.1em; font-weight: 700; margin-bottom: 20px; padding: 10px 14px; background: var(--vscode-input-background); border-radius: 4px; border: 1px solid var(--vscode-widget-border); }
.body { white-space: pre-wrap; line-height: 1.6; padding: 14px; background: var(--vscode-input-background); border-radius: 4px; border: 1px solid var(--vscode-widget-border); margin-bottom: 16px; }
button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 7px 16px; border-radius: 3px; cursor: pointer; font-size: 12px; }
button:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
<h2>Title</h2>
<div class="title">${escapedTitle}</div>
<h2>Description</h2>
<div class="body">${escapedBody}</div>
<button onclick="copy()">Copy to clipboard</button>
<script>
const vscode = acquireVsCodeApi();
function copy() { vscode.postMessage({ type: 'copy' }); }
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
