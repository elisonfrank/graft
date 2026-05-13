import { generateText } from 'ai';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getDiff, getStagedFiles, getUnstagedFiles, stageAll } from '../git.js';
import { loadConfig, getModel, languageInstruction } from '../config.js';
import type { GraftConfig } from '../config.js';

interface ReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  file: string;
  line?: number;
  message: string;
}

const SYSTEM = (language: string) => `You are an expert code reviewer analyzing a git diff.
Important: you are seeing ONLY the changed lines, not the full files. Do NOT report missing imports, undefined variables, or missing definitions — those likely exist in the unchanged parts of the files.

Focus exclusively on:
- Bugs and logic errors introduced by these changes
- Security vulnerabilities (injection, exposed secrets, unsafe input handling)
- Missing error handling at system boundaries (user input, external APIs)
- Obvious performance problems introduced by these changes

Respond with a JSON array of issues:
[{ "severity": "critical"|"warning"|"suggestion", "file": "path/to/file", "line": 42, "message": "description" }]

If there are no issues, respond with an empty array: []
- ${languageInstruction(language)}`;

const AI_TIMEOUT_MS = 45_000;

const SEVERITY_COLOR: Record<ReviewIssue['severity'], (s: string) => string> = {
  critical: chalk.red,
  warning: chalk.yellow,
  suggestion: chalk.cyan,
};

const SEVERITY_LABEL: Record<ReviewIssue['severity'], string> = {
  critical: '● CRITICAL',
  warning: '▲ WARNING',
  suggestion: '◆ SUGGESTION',
};

function printIssues(issues: ReviewIssue[]): void {
  const criticals = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const suggestions = issues.filter((i) => i.severity === 'suggestion');

  console.log(`\n${chalk.bold(`Review — ${issues.length} issue(s) found:`)}`);
  console.log(chalk.dim(`  ${criticals.length} critical  ${warnings.length} warning  ${suggestions.length} suggestion\n`));

  for (const issue of [...criticals, ...warnings, ...suggestions]) {
    const color = SEVERITY_COLOR[issue.severity];
    const label = SEVERITY_LABEL[issue.severity];
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    console.log(color(label) + chalk.dim(` ${location}`));
    console.log(`  ${issue.message}\n`);
  }
}

function parseIssues(text: string): ReviewIssue[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log(chalk.yellow('Could not parse review response — skipping review.'));
    return [];
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.log(chalk.yellow('Could not parse review response — skipping review.'));
    return [];
  }
}

// Returns true if there are critical issues
export async function runReview(diff: string, config: GraftConfig): Promise<boolean> {
  if (!diff.trim()) return false;

  console.log(chalk.dim('Reviewing diff...'));

  let text: string;
  try {
    const result = await generateText({
      model: getModel(config),
      system: SYSTEM(config.language),
      prompt: `Review this diff:\n\n${diff}`,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    text = result.text;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(chalk.yellow(`Review timed out or failed (${message}) — skipping review.`));
    return false;
  }

  const issues = parseIssues(text);

  if (issues.length === 0) {
    console.log(chalk.green('No issues found. Looks good!'));
    return false;
  }

  printIssues(issues);
  return issues.some((i) => i.severity === 'critical');
}

// Standalone command
export async function reviewCommand(): Promise<void> {
  const staged = getStagedFiles();
  const unstaged = getUnstagedFiles();

  if (staged.length === 0 && unstaged.length === 0) {
    console.log(chalk.yellow('No changes found.'));
    return;
  }

  if (staged.length === 0 && unstaged.length > 0) {
    console.log(chalk.dim(`${unstaged.length} unstaged file(s) found.`));
    const doStage = await confirm({ message: 'Stage all to review?', default: true });
    if (!doStage) {
      console.log(chalk.dim('Run "git add" to stage your changes, then try again.'));
      return;
    }
    stageAll();
  }

  const config = loadConfig();
  if (!config.apiKey) {
    console.log(chalk.red('API key not configured. Run: graft config'));
    return;
  }

  const diff = getDiff();

  if (!diff.trim()) {
    console.log(chalk.yellow('No diff content to review.'));
    return;
  }

  const hasCriticals = await runReview(diff, config);

  if (hasCriticals) {
    console.log(chalk.red('Fix critical issues before committing.'));
  }
}
