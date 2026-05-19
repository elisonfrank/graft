import * as vscode from 'vscode';
import { commitCommand } from './commands/commit';
import { prCommand } from './commands/pr';
import { reviewCommand } from './commands/review';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('graft.commit', async () => {
            try { await commitCommand(); }
            catch (e: any) { vscode.window.showErrorMessage(`Graft: ${e.message}`); }
        }),
        vscode.commands.registerCommand('graft.pr', async () => {
            try { await prCommand(); }
            catch (e: any) { vscode.window.showErrorMessage(`Graft: ${e.message}`); }
        }),
        vscode.commands.registerCommand('graft.review', async () => {
            try { await reviewCommand(); }
            catch (e: any) { vscode.window.showErrorMessage(`Graft: ${e.message}`); }
        })
    );
}

export function deactivate() {}
