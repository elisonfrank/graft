import { generateText } from 'ai';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { loadConfig, getModel } from '../config.js';
import { getCurrentBranch } from '../git.js';

const CONFLICT_MARKER_START = '<<<<<<<';
const CONFLICT_MARKER_MID = '=======';
const CONFLICT_MARKER_END = '>>>>>>>';

function hasDivergence(base: string): boolean {
  try {
    const result = execSync(`git rev-list --count ${base}..HEAD`, { encoding: 'utf-8' }).trim();
    const behind = execSync(`git rev-list --count HEAD..${base}`, { encoding: 'utf-8' }).trim();
    return parseInt(result) > 0 && parseInt(behind) > 0;
  } catch {
    return false;
  }
}

function isBranchPublished(branch: string): boolean {
  try {
    execSync(`git ls-remote --exit-code --heads origin ${branch}`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

function getConflictedFiles(): string[] {
  return execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' })
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

interface ConflictBlock {
  ours: string;
  theirs: string;
  context: string;
}

function parseConflicts(content: string): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line !== undefined && line.startsWith(CONFLICT_MARKER_START)) {
      const ours: string[] = [];
      const theirs: string[] = [];
      const context: string[] = [];

      i++;
      while (i < lines.length && !lines[i]!.startsWith(CONFLICT_MARKER_MID)) {
        ours.push(lines[i]!);
        i++;
      }
      i++;
      while (i < lines.length && !lines[i]!.startsWith(CONFLICT_MARKER_END)) {
        theirs.push(lines[i]!);
        i++;
      }
      i++;

      const start = Math.max(0, i - ours.length - theirs.length - 10);
      context.push(...lines.slice(start, start + 5));

      blocks.push({
        ours: ours.join('\n'),
        theirs: theirs.join('\n'),
        context: context.join('\n'),
      });
    } else {
      i++;
    }
  }

  return blocks;
}

async function resolveFile(filePath: string, config: ReturnType<typeof loadConfig>): Promise<void> {
  const content = readFileSync(filePath, 'utf-8');
  const conflicts = parseConflicts(content);

  if (conflicts.length === 0) return;

  console.log(chalk.yellow(`\nConflict in ${filePath} (${conflicts.length} block(s))`));

  const { text } = await generateText({
    model: getModel(config),
    system: `You are an expert at resolving git merge conflicts.
Given a conflict block with "ours" (current branch) and "theirs" (incoming branch) versions, produce the correct merged result.
- Understand the intent of each side
- Preserve both changes when they are complementary
- Choose the better version when they are contradictory, and explain why
- Respond with JSON: { "resolved": "<merged code>", "explanation": "<one line why>" }`,
    prompt: `File: ${filePath}

${conflicts
  .map(
    (b, i) => `Conflict ${i + 1}:
Context:
${b.context}

Ours:
${b.ours}

Theirs:
${b.theirs}`
  )
  .join('\n\n')}`,
  });

  let resolved: { resolved: string; explanation: string };
  try {
    resolved = JSON.parse(text.trim());
  } catch {
    console.log(chalk.red('Could not parse AI response. Skipping this file.'));
    return;
  }

  console.log(chalk.dim(`Explanation: ${resolved.explanation}`));
  console.log('\n' + chalk.bold('Proposed resolution:'));
  console.log(chalk.cyan(resolved.resolved));

  const approved = await confirm({ message: 'Apply this resolution?', default: true });
  if (!approved) {
    console.log(chalk.dim('Skipped. Resolve manually.'));
    return;
  }

  let newContent = content;
  for (const block of conflicts) {
    const conflictText = `<<<<<<< HEAD\n${block.ours}\n=======\n${block.theirs}\n>>>>>>> `;
    newContent = newContent.replace(
      new RegExp(
        `${CONFLICT_MARKER_START}[^\n]*\n${escapeRegex(block.ours)}\n${CONFLICT_MARKER_MID}\n${escapeRegex(block.theirs)}\n${CONFLICT_MARKER_END}[^\n]*`,
        's'
      ),
      resolved.resolved
    );
    void conflictText;
  }

  writeFileSync(filePath, newContent, 'utf-8');
  execSync(`git add ${JSON.stringify(filePath)}`);
  console.log(chalk.green(`Resolved and staged: ${filePath}`));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  console.log(
    chalk.dim(
      `Branch is ${published ? 'published (using merge)' : 'local only (using rebase)'}`
    )
  );
  console.log(chalk.bold(`Strategy: ${strategy}`));

  const proceed = await confirm({
    message: `Run git ${strategy} origin/${base}?`,
    default: true,
  });

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
    console.log(chalk.green('Done.'));
    return;
  }

  console.log(chalk.yellow(`\n${conflicted.length} file(s) with conflicts. Resolving with AI...`));

  for (const file of conflicted) {
    await resolveFile(file, config);
  }

  const remaining = getConflictedFiles();
  if (remaining.length > 0) {
    console.log(chalk.yellow(`\n${remaining.length} file(s) still have conflicts. Resolve manually.`));
    return;
  }

  if (strategy === 'rebase') {
    execSync('git rebase --continue', { stdio: 'inherit' });
  } else {
    console.log(chalk.dim('\nAll conflicts resolved. Run: git commit'));
  }

  console.log(chalk.green('\nSync complete.'));
}
