import chalk from 'chalk';
import { addToGraftIgnore } from '../git.js';

export function ignoreCommand(pattern: string): void {
  if (!pattern?.trim()) {
    console.log(chalk.red('Please provide a pattern. Example: graft ignore "*.generated.ts"'));
    return;
  }

  addToGraftIgnore(pattern.trim());
  console.log(chalk.green(`Added "${pattern.trim()}" to .graftignore`));
  console.log(chalk.dim('This file will be excluded from all graft diff analysis.'));
}
