# graft

AI-powered git workflow — commit messages and PR descriptions that actually make sense.

## The problem

You finished the implementation. Now comes the annoying part: writing a meaningful commit message, crafting a PR description that explains what changed and why, dealing with merge conflicts. Graft handles that for you.

## What it does

- `graft commit` — analyzes your diff and suggests a commit message in conventional commits format
- `graft pr` — generates a PR title and description from your branch commits
- `graft config` — configure your AI provider, model, and API key

## Install

```bash
npm install -g graft
```

## Setup

```bash
graft config
```

You'll be prompted to choose a provider, model, and paste your API key. Supported providers:

| Provider | Models |
|---|---|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1 |
| Anthropic | claude-haiku, claude-sonnet, claude-opus |
| Google | gemini-2.0-flash, gemini-2.5-pro |
| Groq | llama-3.3-70b, llama-3.1-8b, mixtral-8x7b |

Config is saved to `~/.graft/config.json`. You can also use environment variables:

```bash
GRAFT_PROVIDER=openai
GRAFT_MODEL=gpt-4o-mini
GRAFT_API_KEY=sk-...
```

## Usage

### Commit

Stage your changes and run:

```bash
git add .
graft commit
```

Graft analyzes the diff, suggests a message, and you approve or edit it before committing.

### Pull Request

After pushing your branch:

```bash
graft pr
```

Graft reads your commit history, generates a title and description, and opens the PR via GitHub CLI if available. Otherwise it prints the description for you to copy.

To compare against a different base branch:

```bash
graft pr --base develop
```

## How it works

Graft sends your git diff or commit log to the configured AI model and asks it to write a meaningful, specific message — not "updated files" or "fixed stuff". Lock files, build artifacts, and generated files are automatically excluded from the diff.

## License

MIT
