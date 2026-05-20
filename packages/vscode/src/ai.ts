import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface GraftConfig {
    provider: 'anthropic' | 'openai' | 'groq' | 'google';
    model: string;
    apiKey: string;
    language: string;
}

const GROQ_BASE      = 'https://api.groq.com/openai/v1';
const OPENAI_BASE    = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const GOOGLE_BASE    = 'https://generativelanguage.googleapis.com/v1beta/openai';

const MODEL_ALIASES: Record<string, string> = {
    // Anthropic
    'claude-haiku':  'claude-haiku-4-5-20251001',
    'claude-sonnet': 'claude-sonnet-4-6',
    'claude-opus':   'claude-opus-4-7',
    // Google
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-2.5-pro':   'gemini-2.5-pro',
    // Groq
    'llama-3.3-70b': 'llama-3.3-70b-versatile',
    'llama-3.1-8b':  'llama-3.1-8b-instant',
    'mixtral-8x7b':  'mixtral-8x7b-32768',
};

function resolveModel(model: string): string {
    return MODEL_ALIASES[model] ?? model;
}

function loadCliConfig(): GraftConfig | null {
    const configPath = join(homedir(), '.graft', 'config.json');
    if (!existsSync(configPath)) return null;
    try { return JSON.parse(readFileSync(configPath, 'utf-8')); }
    catch { return null; }
}

function getEffectiveConfig(): { provider: string; apiKey: string; model?: string } {
    const vs = vscode.workspace.getConfiguration('graft');
    const vsProvider = vs.inspect<string>('aiProvider');
    const vsApiKey = vs.inspect<string>('apiKey');

    // VS Code settings take priority if explicitly set by the user
    const userSetProvider = vsProvider?.globalValue ?? vsProvider?.workspaceValue;
    const userSetApiKey = vsApiKey?.globalValue ?? vsApiKey?.workspaceValue;
    if (userSetProvider || userSetApiKey) {
        return {
            provider: userSetProvider ?? 'copilot',
            apiKey: userSetApiKey ?? '',
            model: vs.get<string>('model', '') || undefined,
        };
    }

    // Otherwise fall back to CLI config
    const cli = loadCliConfig();
    if (cli?.apiKey) return cli;

    return { provider: 'copilot', apiKey: '' };
}

export function getLanguage(): string {
    return loadCliConfig()?.language
        ?? vscode.workspace.getConfiguration('graft').get<string>('language', 'English');
}

export async function generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const cfg = getEffectiveConfig();

    if (cfg.provider === 'copilot') {
        return generateWithCopilot(systemPrompt, userPrompt);
    }

    if (!cfg.apiKey) {
        throw new Error('No API key found. Run "graft config" in the terminal, or set graft.apiKey in VS Code settings.');
    }

    return generateWithRest(cfg.provider, cfg.apiKey, cfg.model, systemPrompt, userPrompt);
}

async function generateWithCopilot(systemPrompt: string, userPrompt: string): Promise<string> {
    let models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length === 0) {
        models = await vscode.lm.selectChatModels({});
    }
    if (models.length === 0) {
        throw new Error('No AI model available. Install GitHub Copilot Chat, or set graft.aiProvider and graft.apiKey in VS Code Settings.');
    }
    const model = models[0];
    const messages = [vscode.LanguageModelChatMessage.User(systemPrompt + '\n\n' + userPrompt)];
    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    let text = '';
    for await (const chunk of response.text) text += chunk;
    return text.trim();
}

function defaultModelFor(provider: string): string {
    switch (provider) {
        case 'anthropic': return 'claude-haiku';
        case 'groq':      return 'llama-3.3-70b';
        case 'google':    return 'gemini-2.0-flash';
        default:          return 'gpt-4o-mini';
    }
}

async function generateWithRest(
    provider: string,
    apiKey: string,
    model: string | undefined,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const resolvedModel = resolveModel(model ?? defaultModelFor(provider));

    if (provider === 'anthropic') {
        const resp = await fetch(`${ANTHROPIC_BASE}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: resolvedModel,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            })
        });
        if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
        const json = await resp.json() as any;
        return json.content[0].text.trim();
    }

    // OpenAI-compatible: openai, groq, google
    const baseUrl = provider === 'groq' ? GROQ_BASE : provider === 'google' ? GOOGLE_BASE : OPENAI_BASE;

    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: resolvedModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });
    if (!resp.ok) throw new Error(`${provider} API error ${resp.status}: ${await resp.text()}`);
    const json = await resp.json() as any;
    return json.choices[0].message.content.trim();
}
