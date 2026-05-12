import { generateText } from 'ai';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { loadConfig, getModel, languageInstruction } from '../config.js';
import { getCurrentBranch } from '../git.js';

const AI_TIMEOUT_MS = 60_000;

interface ConflictBlock {
  raw: string;
  ours: string;
  theirs: string;
  oursLabel: string;
  theirsLabel: string;
}

interface ConflictResolution {
  index: number;
  resolved: string;
  explanation: string;
}

function hasDivergence(base: string): boolean {
  try {
    const ahead = execSync(`git rev-list --count ${base}..HEAD`, { encoding: 'utf-8' }).trim();
    const behind = execSync(`git rev-list --count HEAD..${base}`, { encoding: 'utf-8' }).trim();
    return parseInt(ahead) > 0 && parseInt(behind) > 0;
  } catch {
    return false;
  }
}

function isBranchPublished(branch: string): boolean {
  try {
    execSync(`git ls-remote --exit-code --heads origin ${branch}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isRebaseInProgress(): boolean {
  try {
    execSync('git rev-parse --git-path rebase-merge', { stdio: 'pipe' });
    return true;
  } catch {
    try {
      execSync('git rev-parse --git-path rebase-apply', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

function getConflictedFiles(): string[] {
  return execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' })
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

function parseConflicts(content: string): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];
  const regex = /^(<{7} .+)\n([\s\S]*?)\n={7}\n([\s\S]*?)\n(>{7} .+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      raw: match[0],
      oursLabel: match[1]!,
      ours: match[2]!,
      theirs: match[3]!,
      theirsLabel: match[4]!,
    });
  }

  return blocks;
}

async function resolveFile(
  filePath: string,
  config: ReturnType<typeof loadConfig>
): Promise<boolean> {
  const originalContent = readFileSync(filePath, 'utf-8');
  const conflicts = parseConflicts(originalContent);

  if (conflicts.length === 0) return true;

  console.log(chalk.yellow(`\nConflict in ${filePath} (${conflicts.length} block(s))`));

  const { text } = await generateText({
    model: getModel(config),
    system: `You are an expert at resolving git merge conflicts.
For each conflict block, produce the correct merged result.
- Understand the intent of each side
- Preserve both changes when they are complementary
- Choose the better version when they are contradictory
- Respond with a JSON array, one object per conflict block, in order:
  [{ "index": 0, "resolved": "<merged code>", "explanation": "<one line why>" }, ...]
- ${languageInstruction(config.language)}`,
    prompt: `File: ${filePath}

${conflicts
  .map(
    (b, i) => `=== Conflict ${i} ===
Ours (${b.oursLabel}):
${b.ours}

Theirs (${b.theirsLabel}):
${b.theirs}`
  )
  .join('\n\n')}`,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  let resolutions: ConflictResolution[];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    resolutions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(resolutions) || resolutions.length !== conflicts.length) {
      throw new Error('Resolution count mismatch');
    }
  } catch {
    console.log(chalk.red('Could not parse AI response. Skipping this file — resolve manually.'));
    return false;
  }

  let allApproved = true;
  let newContent = originalContent;

  for (let i = 0; i < conflicts.length; i++) {
    const block = conflicts[i]!;
    const resolution = resolutions.find((r) => r.index === i) ?? resolutions[i]!;

    console.log(chalk.dim(`\nBlock ${i + 1}/${conflicts.length}: ${resolution.explanation}`));
    console.log(chalk.bold('Proposed:'));
    console.log(chalk.cyan(resolution.resolved));

    const approved = await confirm({ message: 'Apply?', default: true });

    if (!approved) {
      allApproved = false;
      console.log(chalk.dim('Skipped. Resolve manually.'));
      continue;
    }

    newContent = newContent.replace(block.raw, resolution.resolved);
  }

  writeFileSync(filePath, newContent, 'utf-8');

  if (allApproved) {
    execSync(`git add -- ${JSON.stringify(filePath)}`);
    console.log(chalk.green(`Staged: ${filePath}`));
  } else {
    console.log(chalk.yellow(`Partially resolved: ${filePath} — stage manually after fixing remaining conflicts.`));
  }

  return allApproved;
}

export async function syncCommand(base = 'main'): Promise<void> {
  const branch = getCurrentBranch();
  const config = loadConfig();

  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  console.log(chalk.dim(`Fetching ${base}...`));
  try {
    execSync(`git fetch origin ${base}`, { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow(`Could not fetch ${base}. Continuing with local state.`));
  }

  if (!hasDivergence(`origin/${base}`)) {
    console.log(chalk.green('No divergence detected. Branch is up to date.'));
    return;
  }

  const published = isBranchPublished(branch);
  const strategy = published ? 'merge' : 'rebase';

  console.log(chalk.dim(`Branch is ${published ? 'published → merge' : 'local only → rebase'}`));
  console.log(chalk.bold(`Strategy: git ${strategy} origin/${base}`));

  const proceed = await confirm({ message: 'Proceed?', default: true });
  if (!proceed) return;

  const result = spawnSync(
    'git',
    strategy === 'rebase' ? ['rebase', `origin/${base}`] : ['merge', `origin/${base}`],
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  if (result.status === 0) {
    console.log(chalk.green('No conflicts. Done.'));
    return;
  }

  const conflicted = getConflictedFiles();

  if (conflicted.length === 0) {
    console.log(chalk.red(`git ${strategy} failed for an unexpected reason:`));
    console.log(result.stderr);
    return;
  }

  console.log(chalk.yellow(`\n${conflicted.length} file(s) with conflicts. Resolving with AI...`));

  for (const file of conflicted) {
    await resolveFile(file, config);
  }

  const remaining = getConflictedFiles();
  if (remaining.length > 0) {
    console.log(chalk.yellow(`\n${remaining.length} file(s) still have unresolved conflicts:`));
    remaining.forEach((f) => console.log(chalk.dim(`  ${f}`)));
    console.log(chalk.dim('Resolve them manually, then run: git add <file>'));
    if (strategy === 'rebase') {
      console.log(chalk.dim('Then: git rebase --continue'));
    } else {
      console.log(chalk.dim('Then: git commit'));
    }
    return;
  }

  if (strategy === 'rebase') {
    if (!isRebaseInProgress()) {
      console.log(chalk.green('Rebase already completed.'));
      return;
    }
    const cont = spawnSync('git', ['rebase', '--continue'], {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: { ...process.env, GIT_EDITOR: 'true' },
    });
    if (cont.status !== 0) {
      console.log(chalk.yellow('git rebase --continue had issues. Check git status.'));
      return;
    }
  } else {
    console.log(chalk.dim('\nAll conflicts resolved. Run: git commit'));
  }

  console.log(chalk.green('\nSync complete.'));
}
