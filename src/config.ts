import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.graft', 'config.json');

const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'groq'] as const;

export type Provider = (typeof VALID_PROVIDERS)[number];

export interface GraftConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

const DEFAULTS: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
};

function isValidProvider(p: unknown): p is Provider {
  return VALID_PROVIDERS.includes(p as Provider);
}

function isValidConfig(c: unknown): c is GraftConfig {
  if (typeof c !== 'object' || c === null) return false;
  const obj = c as Record<string, unknown>;
  return (
    isValidProvider(obj['provider']) &&
    typeof obj['model'] === 'string' &&
    obj['model'].length > 0 &&
    typeof obj['apiKey'] === 'string'
  );
}

export function loadConfig(): GraftConfig {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (isValidConfig(raw)) return raw;
    } catch {
      // fall through to env vars
    }
  }

  const provider = isValidProvider(process.env['GRAFT_PROVIDER'])
    ? process.env['GRAFT_PROVIDER']
    : 'openai';
  const model = process.env['GRAFT_MODEL'] ?? DEFAULTS[provider];
  const apiKey = process.env['GRAFT_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '';

  return { provider, model, apiKey };
}

export function saveConfig(config: GraftConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getModel(config: GraftConfig): LanguageModel {
  switch (config.provider) {
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey })(config.model);
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
    case 'groq':
      return createGroq({ apiKey: config.apiKey })(config.model);
  }
}
