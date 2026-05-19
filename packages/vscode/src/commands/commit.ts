import * as vscode from 'vscode';
import { getStagedDiff, setCommitMessage } from '../git';
import { generate, getLanguage } from '../ai';

const SYSTEM = (language: string) => `You are an expert at writing git commit messages.
Rules:
- Use conventional commits format: type(scope): description
- First line max 72 characters
- Be specific and meaningful — no "updated files" or "fixed stuff"
- If there are multiple logical changes, list them in the body
- Respond with ONLY the commit message, nothing else
- Commit message MUST be in ${language}`;

export async function commitCommand(): Promise<void> {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.SourceControl, title: 'Graft: generating commit message...' },
        async () => {
            const diff = await getStagedDiff();
            if (!diff.trim()) {
                vscode.window.showWarningMessage('Graft: no changes to commit.');
                return;
            }

            const language = getLanguage();
            const truncated = diff.length > 12000 ? diff.slice(0, 12000) + '\n\n[diff truncated]' : diff;
            const message = await generate(
                SYSTEM(language),
                `Generate a commit message for this diff:\n\n${truncated}`
            );

            setCommitMessage(message);
        }
    );
}
