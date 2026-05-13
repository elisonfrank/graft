# graft

AI-powered git workflow — commit messages, PR descriptions, code review, and merge conflict resolution.

## The problem

You finished the implementation. Now comes the annoying part: writing a meaningful commit message, crafting a PR description that explains what changed and why, dealing with merge conflicts. Graft handles that for you.

## What it does

- `graft commit` — stages, reviews, and commits with an AI-generated message
- `graft pr` — generates a PR title and description from your branch commits
- `graft sync` — syncs with the base branch and resolves merge conflicts with AI
- `graft review` — reviews your diff for bugs, security issues, and logic errors
- `graft ignore <pattern>` — exclude files or folders from diff analysis
- `graft config` — configure your AI provider, model, language, and API key

## Install

```bash
npm install -g graftai
```

## Setup

```bash
graft config
```

You'll be prompted to choose a provider, model, language, and paste your API key. Supported providers:

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
GRAFT_LANGUAGE=English
```

## Usage

### Commit

```bash
graft commit
```

If nothing is staged, graft lists the changed files and asks to stage them. Then it reviews the diff for issues and generates a commit message for you to approve or edit.

If critical issues are found during review, you'll be warned before committing.

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

### Sync

When your branch has diverged from main:

```bash
graft sync
```

Graft detects whether to use merge or rebase, runs it, and resolves conflicts file by file with AI — showing the proposed resolution and explanation before applying.

To sync against a different base branch:

```bash
graft sync --base develop
```

### Review

```bash
graft review
```

Analyzes your diff and reports issues in three levels:

- `● CRITICAL` — bugs, security vulnerabilities, exposed secrets
- `▲ WARNING` — missing error handling, logic problems
- `◆ SUGGESTION` — obvious quality improvements

Review also runs automatically inside `graft commit`.

### Ignore

Exclude files or patterns from all diff analysis:

```bash
graft ignore "*.generated.ts"
graft ignore "src/migrations/"
```

Patterns are saved to `.graftignore` in your project root. Supports `*` and `?` wildcards.

## How it works

Graft sends your git diff or commit log to the configured AI model. Lock files, build artifacts, and `.graftignore` patterns are automatically excluded from the diff.

## License

MIT
