import * as vscode from 'vscode';
import { getStagedDiff } from '../git';
import { generate } from '../ai';

const SYSTEM = `You are an expert code reviewer.
Rules:
- Focus on bugs, security issues, and critical problems
- Be concise — one line per issue
- Format each issue as: FILE:LINE severity: description
  severity is one of: critical, warning, info
- If no issues found, respond with: "No issues found."
- Do not praise the code`;

export async function reviewCommand(): Promise<void> {
    let reviewText = '';
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Graft: reviewing changes...' },
        async () => {
            const diff = await getStagedDiff();
            if (!diff.trim()) {
                vscode.window.showWarningMessage('Graft: no changes to review.');
                return;
            }
            reviewText = await generate(SYSTEM, `Review this diff:\n\n${diff}`);
        }
    );

    if (!reviewText) return;

    if (reviewText.trim() === 'No issues found.') {
        vscode.window.showInformationMessage('Graft: no issues found.');
        return;
    }

    const channel = vscode.window.createOutputChannel('Graft Review');
    channel.clear();
    channel.appendLine(reviewText);
    channel.show(true);
}
