import { generateText } from 'ai';
import { confirm, select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import { getCommitLog, getCurrentBranch } from '../git.js';
import { loadConfig, getModel, languageInstruction } from '../config.js';

const SYSTEM = (language: string) => `You are an expert at writing pull request descriptions.
Rules:
- Write a clear title (max 72 chars)
- Write a concise summary of what changed and why
- Use bullet points for the main changes
- Add a "## How to test" section if relevant
- Be direct — no filler phrases
- Format: markdown
- Respond with ONLY the PR title on the first line, then a blank line, then the body
- The user may provide additional context in any language, but the PR title and body MUST be in ${language}
- ${languageInstruction(language)}`;

const AI_TIMEOUT_MS = 30_000;

export async function prCommand(base = 'main'): Promise<void> {
  const log = getCommitLog(base);
  const branch = getCurrentBranch();

  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  let context: string | undefined;

  console.log(chalk.dim('Analyzing commits...'));

  let { text } = await generateText({
    model: getModel(config),
    system: SYSTEM(config.language),
    prompt: `Generate a PR title and description for this branch (${branch}) based on these commits:\n\n${log}`,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  while (true) {
    const lines = text.trim().split('\n');
    const title = (lines[0]?.trim() || branch).slice(0, 72);
    const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() !== '');
    const body = bodyStart > 0 ? lines.slice(bodyStart).join('\n').trim() : '';

    console.log('\n' + chalk.bold('PR Title:'));
    console.log(chalk.cyan(title));

    if (body) {
      console.log('\n' + chalk.bold('PR Body:'));
      console.log(chalk.dim(body));
    }

    const approved = await confirm({ message: 'Open PR with this description?', default: true });

    if (approved) {
      const result = spawnSync('gh', ['pr', 'create', '--title', title, '--body', body || title, '--base', base], {
        stdio: 'inherit',
        encoding: 'utf-8',
      });

      if (result.status !== 0) {
        console.log(chalk.red('\nGitHub CLI (gh) not found or not authenticated.'));
        console.log(chalk.dim('Install it at: https://cli.github.com'));
        console.log('\n' + chalk.bold('Copy the PR description manually:'));
        console.log(`Title: ${title}`);

        if (body) console.log(`\n${body}`);
      }
      return;
    }

    const action = await select<'regenerate' | 'cancel'>({
      message: 'What now?',
      choices: [
        { value: 'regenerate', name: 'Regenerate with additional context' },
        { value: 'cancel', name: 'Cancel' },
      ],
    });

    if (action === 'cancel') {
      console.log(chalk.dim('Cancelled.'));

      return;
    }

    const additionalContext = await input({
      message: 'Additional context to clarify the PR description:',
    });

    if (!additionalContext.trim()) {
      console.log(chalk.yellow('No context provided.'));
      continue;
    }

    context = additionalContext.trim();

    console.log(chalk.dim('Regenerating with additional context...'));

    ({ text } = await generateText({
      model: getModel(config),
      system: SYSTEM(config.language),
      prompt: `Generate a PR title and description for this branch (${branch}) based on these commits. Incorporate this into the description (in ${config.language}): ${context}\n\n${log}`,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    }));
  }
}
