import { generateText } from 'ai';
import { input, confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getDiff, commit, getStagedFiles, getUnstagedFiles, stageAll } from '../git.js';
import { loadConfig, getModel, languageInstruction } from '../config.js';
import { runReview } from './review.js';

const SYSTEM = (language: string) => `You are an expert at writing git commit messages.
Rules:
- Use conventional commits format: type(scope): description
- First line max 72 characters
- Be specific and meaningful — no "updated files" or "fixed stuff"
- If there are multiple logical changes, list them in the body
- Respond with ONLY the commit message, nothing else
- The user may provide additional context in any language, but the commit message MUST be in ${language}
- ${languageInstruction(language)}`;

const AI_TIMEOUT_MS = 30_000;

export async function commitCommand(): Promise<void> {
  const staged = getStagedFiles();
  const unstaged = getUnstagedFiles();

  if (staged.length === 0 && unstaged.length === 0) {
    console.log(chalk.yellow('No changes found.'));
    return;
  }

  if (staged.length === 0 && unstaged.length > 0) {
    console.log(chalk.dim(`${unstaged.length} unstaged file(s):`));
    unstaged.forEach((f) => console.log(chalk.dim(`  ${f}`)));

    const doStage = await confirm({ message: 'Stage all and continue?', default: true });
    if (!doStage) {
      console.log(chalk.dim('Run "git add" to stage your changes, then try again.'));
      return;
    }

    stageAll();
    console.log(chalk.dim('Staged.'));
  }

  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  const diff = getDiff();

  // review step
  const hasCriticals = await runReview(diff, config);
  if (hasCriticals) {
    const proceed = await confirm({
      message: 'Critical issues found. Commit anyway?',
      default: false,
    });
    if (!proceed) {
      console.log(chalk.dim('Cancelled. Fix the issues and try again.'));
      return;
    }
  }

  let context: string | undefined;

  console.log(chalk.dim('\nAnalyzing diff...'));

  let { text } = await generateText({
    model: getModel(config),
    system: SYSTEM(config.language),
    prompt: `Generate a commit message for this diff:\n\n${diff}`,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  let suggestion = text.trim();

  while (true) {
    console.log('\n' + chalk.bold('Suggested commit message:'));
    console.log(chalk.cyan(suggestion));

    const approved = await confirm({ message: 'Use this message?', default: true });

    if (approved) {
      commit(suggestion);
      console.log(chalk.green('Committed!'));
      return;
    }

    const action = await select<'regenerate' | 'edit' | 'cancel'>({
      message: 'What now?',
      choices: [
        { value: 'regenerate', name: 'Regenerate with additional context' },
        { value: 'edit', name: 'Edit the message' },
        { value: 'cancel', name: 'Cancel' },
      ],
    });

    if (action === 'cancel') {
      console.log(chalk.dim('Cancelled.'));
      return;
    }

    if (action === 'edit') {
      const edited = await input({
        message: 'Edit the message:',
        default: suggestion,
      });

      if (edited.trim()) {
        commit(edited.trim());
        console.log(chalk.green('Committed!'));
      }

      return;
    }

    const additionalContext = await input({
      message: 'Additional context to clarify the commit message:',
    });

    if (!additionalContext.trim()) {
      console.log(chalk.yellow('No context provided.'));
      continue;
    }

    context = additionalContext.trim();

    console.log(chalk.dim(`Regenerating with additional context...`));

    ({ text } = await generateText({
      model: getModel(config),
      system: SYSTEM(config.language),
      prompt: `Generate a commit message for this diff. Incorporate this into the message (in ${config.language}): ${context}\n\n${diff}`,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    }));

    suggestion = text.trim();
  }
}
