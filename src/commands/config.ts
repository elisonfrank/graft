import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config.js';
import type { GraftConfig } from '../config.js';

const MODELS: Record<GraftConfig['provider'], string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  google: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};

export async function configCommand(): Promise<void> {
  const current = loadConfig();

  const provider = await select<GraftConfig['provider']>({
    message: 'Provider:',
    choices: [
      { value: 'openai', name: 'OpenAI' },
      { value: 'anthropic', name: 'Anthropic' },
      { value: 'google', name: 'Google Gemini' },
      { value: 'groq', name: 'Groq' },
    ],
    default: current.provider,
  });

  const modelChoices = MODELS[provider].map((m) => ({ value: m, name: m }));
  const model = await select<string>({
    message: 'Model:',
    choices: modelChoices,
    default: current.model,
  });

  const apiKey = await input({
    message: 'API Key:',
    default: current.apiKey,
  });

  const config: GraftConfig = { provider, model, apiKey };
  saveConfig(config);

  console.log(chalk.green('Config saved!'));
  console.log(chalk.dim(`Provider: ${provider} | Model: ${model}`));
}
