import { execSync } from 'child_process';

const EXCLUDED_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^bun\.lockb$/,
  /\.lock$/,
  /^dist\//,
  /^build\//,
  /^\.next\//,
];

function isExcluded(file: string): boolean {
  return EXCLUDED_PATTERNS.some((p) => p.test(file));
}

function getChangedFiles(staged: boolean): string[] {
  const cmd = staged ? 'git diff --cached --name-only' : 'git diff HEAD --name-only';
  return execSync(cmd, { encoding: 'utf-8' })
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && !isExcluded(f));
}

export function getDiff(): string {
  try {
    let files = getChangedFiles(true);
    let staged = true;

    if (files.length === 0) {
      files = getChangedFiles(false);
      staged = false;
    }

    if (files.length === 0) {
      return '';
    }

    const cmd = staged ? 'git diff --cached' : 'git diff HEAD';
    return execSync(`${cmd} -- ${files.map((f) => JSON.stringify(f)).join(' ')}`, {
      encoding: 'utf-8',
    });
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
