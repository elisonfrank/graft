#!/usr/bin/env node
import { Command } from 'commander';
import { commitCommand } from './commands/commit.js';
import { prCommand } from './commands/pr.js';
import { configCommand } from './commands/config.js';
import { syncCommand } from './commands/sync.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('graft')
  .description('AI-powered git workflow — commit messages and PR descriptions that actually make sense')
  .version(version);

program
  .command('commit')
  .description('Analyze your diff and suggest a commit message')
  .action(commitCommand);

program
  .command('pr')
  .description('Generate a PR title and description from your branch commits')
  .option('-b, --base <branch>', 'Base branch to compare against', 'main')
  .action((opts: { base: string }) => prCommand(opts.base));

program
  .command('sync')
  .description('Sync with base branch — AI resolves merge conflicts automatically')
  .option('-b, --base <branch>', 'Base branch to sync against', 'main')
  .action((opts: { base: string }) => syncCommand(opts.base));

program
  .command('config')
  .description('Configure AI provider, model, and API key')
  .action(configCommand);

program.parse();
