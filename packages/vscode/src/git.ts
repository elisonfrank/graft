import * as vscode from 'vscode';
import { execSync } from 'child_process';

interface GitExtension {
    getAPI(version: 1): GitAPI;
}

interface GitAPI {
    repositories: Repository[];
}

interface Repository {
    state: {
        indexChanges: Change[];
        workingTreeChanges: Change[];
    };
    inputBox: { value: string };
    diff(staged: boolean): Promise<string>;
}

interface Change {
    uri: vscode.Uri;
}

function getCwd(): string {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) throw new Error('No workspace folder open.');
    return folder;
}

export function getRepo(): Repository | undefined {
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!ext?.isActive) return undefined;
    return ext.exports.getAPI(1).repositories[0];
}

export async function getStagedDiff(): Promise<string> {
    const cwd = getCwd();
    try {
        const staged = execSync('git diff --cached', { encoding: 'utf-8', cwd }).trim();
        if (staged) return staged;
        const unstaged = execSync('git diff', { encoding: 'utf-8', cwd }).trim();
        return unstaged;
    } catch {
        // fallback to VS Code git API
        const repo = getRepo();
        if (!repo) throw new Error('No git repository found.');
        const diff = await repo.diff(true);
        if (!diff.trim()) return repo.diff(false);
        return diff;
    }
}

export function getDefaultBranch(): string {
    const cwd = getCwd();
    try {
        const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf-8', cwd }).trim();
        // return as origin/branchname so we compare against remote, not local
        return ref.replace('refs/remotes/', '');
    } catch {
        try {
            execSync('git rev-parse --verify origin/main', { encoding: 'utf-8', cwd, stdio: 'pipe' });
            return 'origin/main';
        } catch {
            return 'origin/master';
        }
    }
}

export function getCommitLog(base: string): string {
    const cwd = getCwd();
    try {
        const log = execSync(
            `git log ${base}..HEAD --pretty=format:"%h %s%n%b"`,
            { encoding: 'utf-8', cwd }
        ).trim();
        if (!log) throw new Error(`No commits found between ${base} and HEAD.`);
        return log;
    } catch (e: any) {
        if (e.message?.startsWith('No commits')) throw e;
        throw new Error('Could not read git log. Make sure you have commits ahead of the base branch.');
    }
}

export function hasStagedChanges(): boolean {
    return (getRepo()?.state.indexChanges.length ?? 0) > 0;
}

export function setCommitMessage(message: string): void {
    const repo = getRepo();
    if (repo) repo.inputBox.value = message;
}
