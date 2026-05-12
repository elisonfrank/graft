import { generateText } from 'ai';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { getCommitLog, getCurrentBranch } from '../git.js';
import { loadConfig, getModel } from '../config.js';

const SYSTEM = `You are an expert at writing pull request descriptions.
Rules:
- Write a clear title (max 72 chars)
- Write a concise summary of what changed and why
- Use bullet points for the main changes
- Add a "## How to test" section if relevant
- Be direct — no filler phrases
- Format: markdown
- Respond with ONLY the PR title on the first line, then a blank line, then the body`;

export async function prCommand(base = 'main'): Promise<void> {
  const log = getCommitLog(base);
  const branch = getCurrentBranch();

  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  console.log(chalk.dim('Analyzing commits...'));

  const { text } = await generateText({
    model: getModel(config),
    system: SYSTEM,
    prompt: `Generate a PR title and description for this branch (${branch}) based on these commits:\n\n${log}`,
  });

  const lines = text.trim().split('\n');
  const title = lines[0]?.trim() ?? branch;
  const body = lines.slice(2).join('\n').trim();

  console.log('\n' + chalk.bold('PR Title:'));
  console.log(chalk.cyan(title));
  console.log('\n' + chalk.bold('PR Body:'));
  console.log(chalk.dim(body));

  const approved = await confirm({ message: 'Open PR with this description?', default: true });

  if (!approved) return;

  try {
    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"');
    execSync(`gh pr create --title "${escapedTitle}" --body "${escapedBody}" --base ${base}`, {
      stdio: 'inherit',
    });
  } catch {
    console.log(chalk.red('GitHub CLI (gh) not found or not authenticated.'));
    console.log(chalk.dim('Install it at: https://cli.github.com'));
    console.log('\n' + chalk.bold('Copy the PR body manually:'));
    console.log(body);
  }
}
