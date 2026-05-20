# Graft for VS Code

AI-powered git workflow — commit messages and PR descriptions that actually make sense.

## Features

- **Generate Commit Message** — analyzes your staged diff and writes a meaningful conventional commit message
- **Generate PR Description** — reads your branch commits and writes a PR title + description
- **Review Changes** — reviews your diff for bugs and issues before committing

All three buttons appear in the **Source Control** panel toolbar (top right icons).

## Setup

### Option 1: GitHub Copilot (no API key needed)
If you have the GitHub Copilot extension installed and active, Graft uses it automatically. No configuration needed.

### Option 2: Already using Graft CLI
If you've run `graft config` in the terminal, the extension reads `~/.graft/config.json` automatically. No configuration needed.

### Option 3: Configure in VS Code Settings
Open Settings (`Ctrl+,`) and search for `graft`:
- **Graft: Ai Provider** — choose your provider (Anthropic, OpenAI, Groq, Google)
- **Graft: Api Key** — your API key
- **Graft: Language** — language for generated messages (default: English)

## Supported Providers & Models

| Provider  | Models |
|-----------|--------|
| OpenAI    | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1 |
| Anthropic | claude-haiku, claude-sonnet, claude-opus |
| Google    | gemini-2.0-flash, gemini-2.5-pro |
| Groq      | llama-3.3-70b, llama-3.1-8b, mixtral-8x7b |

## Links

- [GitHub](https://github.com/elisonfrank/graft)
- [Graft CLI on npm](https://www.npmjs.com/package/graftai)
