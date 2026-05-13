---
title: I built a CLI that writes my commit messages and PR descriptions for me
published: true
tags: git, productivity, typescript, opensource
---

For 18 years I've been writing commit messages like "fix stuff" and PR descriptions that say nothing useful. Last week I got tired of it and built **graftai** — a CLI that handles the annoying parts of git workflow after you finish coding.

## What it does

```bash
graft commit   # analyzes your diff, suggests a commit message
graft pr       # generates a PR title and description from your commits
graft sync     # syncs with main, resolves merge conflicts with AI
graft config   # set your provider, model, language and API key
```

## How it works

You run `graft commit`, it reads your diff, sends it to the AI model of your choice, and suggests a conventional commit message. You approve, edit, or cancel.

```
Analyzing diff...

Suggested commit message:
feat(auth): add JWT refresh token rotation with configurable expiry

? Use this message? (Y/n)
```

Same for PRs — it reads your commit history and writes a title and description that actually explains what changed and why.

`graft sync` is the interesting one: when your branch has diverged from main, it decides whether to rebase or merge (based on whether your branch is published), runs it, and for each conflicted file shows you the AI's proposed resolution with an explanation before applying anything.

## It works with your own API key

No SaaS, no subscription. You bring your own key. Supported providers:

| Provider | Models |
|---|---|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-4.1 |
| Anthropic | claude-haiku, claude-sonnet, claude-opus |
| Google | gemini-2.0-flash, gemini-2.5-pro |
| Groq | llama-3.3-70b, mixtral-8x7b (free tier available) |

Config is saved locally at `~/.graft/config.json`. You can also use env vars if you prefer.

## Install

```bash
npm install -g graftai
graft config
```

That's it. Next time you finish a feature, instead of staring at a blank commit message box:

```bash
git add .
graft commit
```

## The code

Open source on GitHub: [github.com/elisonfrank/graft](https://github.com/elisonfrank/graft)

Built with Node.js, TypeScript, and the Vercel AI SDK for provider-agnostic model switching.
