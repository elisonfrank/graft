import { generateText } from 'ai';
import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getDiff, commit } from '../git.js';
import { loadConfig, getModel, languageInstruction } from '../config.js';

const SYSTEM = (language: string) => `You are an expert at writing git commit messages.
Rules:
- Use conventional commits format: type(scope): description
- First line max 72 characters
- Be specific and meaningful — no "updated files" or "fixed stuff"
- If there are multiple logical changes, list them in the body
- Respond with ONLY the commit message, nothing else
- ${languageInstruction(language)}`;

const AI_TIMEOUT_MS = 30_000;

export async function commitCommand(): Promise<void> {
  const diff = getDiff();

  if (!diff.trim()) {
    console.log(chalk.yellow('No staged or unstaged changes found.'));
    return;
  }

  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  console.log(chalk.dim('Analyzing diff...'));

  const { text } = await generateText({
    model: getModel(config),
    system: SYSTEM(config.language),
    prompt: `Generate a commit message for this diff:\n\n${diff}`,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  const suggestion = text.trim();

  console.log('\n' + chalk.bold('Suggested commit message:'));
  console.log(chalk.cyan(suggestion));

  const approved = await confirm({ message: 'Use this message?', default: true });

  if (approved) {
    commit(suggestion);
    console.log(chalk.green('Committed!'));
    return;
  }

  const edited = await input({
    message: 'Edit the message:',
    default: suggestion,
  });

  if (edited.trim()) {
    commit(edited.trim());
    console.log(chalk.green('Committed!'));
  }
}
