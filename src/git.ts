import { execSync } from 'child_process';

export function getDiff(): string {
  try {
    let diff = execSync('git diff --cached', { encoding: 'utf-8' });
    if (!diff.trim()) {
      diff = execSync('git diff HEAD', { encoding: 'utf-8' });
    }
    return diff;
  } catch {
    throw new Error('Not a git repository or no changes found.');
  }
}

export function getCommitLog(base = 'main'): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const log = execSync(`git log ${base}..${branch} --pretty=format:"%h %s%n%b"`, { encoding: 'utf-8' });
    if (!log.trim()) {
      throw new Error(`No commits found between ${base} and ${branch}.`);
    }
    return log;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith('No commits')) throw e;
    throw new Error('Could not read git log. Make sure you have commits ahead of the base branch.');
  }
}

export function getCurrentBranch(): string {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
}

export function commit(message: string): void {
  execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: 'inherit' });
}
