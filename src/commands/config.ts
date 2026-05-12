import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config.js';
import type { GraftConfig } from '../config.js';

const MODELS: Record<GraftConfig['provider'], string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  google: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};

const COMMON_LANGUAGES = [
  'English',
  'Portuguese',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Chinese',
  'Korean',
];

export async function configCommand(): Promise<void> {
  const current = loadConfig();

  console.log(chalk.dim('Current config:'));
  console.log(chalk.dim(`  Provider : ${current.provider}`));
  console.log(chalk.dim(`  Model    : ${current.model}`));
  console.log(chalk.dim(`  API Key  : ${current.apiKey ? '***' + current.apiKey.slice(-4) : 'not set'}`));
  console.log(chalk.dim(`  Language : ${current.language ?? 'English'}`));
  console.log();

  const updated = { ...current };

  if (await confirm({ message: 'Change provider/model?', default: false })) {
    updated.provider = await select<GraftConfig['provider']>({
      message: 'Provider:',
      choices: [
        { value: 'openai', name: 'OpenAI' },
        { value: 'anthropic', name: 'Anthropic' },
        { value: 'google', name: 'Google Gemini' },
        { value: 'groq', name: 'Groq' },
      ],
      default: current.provider,
    });

    const modelChoices = MODELS[updated.provider].map((m) => ({ value: m, name: m }));
    updated.model = await select<string>({
      message: 'Model:',
      choices: modelChoices,
      default: MODELS[updated.provider].includes(current.model) ? current.model : undefined,
    });
  }

  if (await confirm({ message: 'Change API key?', default: false })) {
    updated.apiKey = await input({
      message: 'API Key:',
      default: current.apiKey,
    });
  }

  if (await confirm({ message: 'Change language?', default: false })) {
    const currentLang = current.language ?? 'English';
    const isCommon = COMMON_LANGUAGES.includes(currentLang);

    const langChoice = await select<string>({
      message: 'Language:',
      choices: [
        ...COMMON_LANGUAGES.map((l) => ({ value: l, name: l })),
        { value: '__other__', name: 'Other (type manually)' },
      ],
      default: isCommon ? currentLang : '__other__',
    });

    if (langChoice === '__other__') {
      updated.language = await input({ message: 'Language name:', default: currentLang });
    } else {
      updated.language = langChoice;
    }
  }

  saveConfig(updated);

  console.log(chalk.green('\nConfig saved!'));
  console.log(chalk.dim(`  Provider : ${updated.provider}`));
  console.log(chalk.dim(`  Model    : ${updated.model}`));
  console.log(chalk.dim(`  Language : ${updated.language ?? 'English'}`));
}
