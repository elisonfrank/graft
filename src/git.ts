import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const BUILTIN_EXCLUDED = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^bun\.lockb$/,
  /\.lock$/,
  /^dist\//,
  /^build\//,
  /^\.next\//,
];

function getGraftIgnorePatterns(): RegExp[] {
  const ignoreFile = join(process.cwd(), '.graftignore');
  if (!existsSync(ignoreFile)) return [];

  return readFileSync(ignoreFile, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((pattern) => {
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${escaped}`);
    });
}

function isExcluded(file: string): boolean {
  const custom = getGraftIgnorePatterns();
  return [...BUILTIN_EXCLUDED, ...custom].some((p) => p.test(file));
}

export function addToGraftIgnore(pattern: string): void {
  const ignoreFile = join(process.cwd(), '.graftignore');
  const existing = existsSync(ignoreFile)
    ? readFileSync(ignoreFile, 'utf-8')
    : '';

  if (existing.split('\n').some((l) => l.trim() === pattern)) {
    return;
  }

  appendFileSync(ignoreFile, `${existing.endsWith('\n') || existing === '' ? '' : '\n'}${pattern}\n`);
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

export function getStagedFiles(): string[] {
  return getChangedFiles(true);
}

export function getUnstagedFiles(): string[] {
  return getChangedFiles(false);
}

export function stageAll(): void {
  execSync('git add .', { stdio: 'pipe' });
}

export function commit(message: string): void {
  execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: 'inherit' });
}
