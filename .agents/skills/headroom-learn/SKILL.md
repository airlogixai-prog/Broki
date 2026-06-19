---
name: headroom-learn
description: >
  Guide for running Headroom's offline failure learning: mine past agent
  sessions for tool-call failures, correlate them with what eventually worked,
  and write actionable corrections to CLAUDE.md or AGENTS.md. Use when the
  user says "headroom learn", "/headroom-learn", "learn from past sessions",
  "mine agent failures", "update AGENTS.md from sessions", or "what did the
  agent get wrong before".
license: Apache-2.0
---

# Headroom Learn

Offline failure learning for coding agents. Scans past conversations, finds
what went wrong, correlates failures with eventual successes, and writes
specific project-level corrections — not generic advice.

## Workflow

When the user asks to learn from sessions or improve agent context files:

```bash
# 1. Dry-run: show recommendations, change nothing
headroom learn

# 2. Apply: write to CLAUDE.md / AGENTS.md / MEMORY.md
headroom learn --apply

# 3. Specific project
headroom learn --project ~/my-project --apply

# 4. All discovered projects
headroom learn --all --apply
```

Always show-learning dry-run first unless the user explicitly says `--apply`.

## What it produces

| Category | Example | Written to |
|----------|---------|------------|
| Environment facts | "use `uv run python`, not `python3`" | CLAUDE.md / AGENTS.md |
| File path corrections | wrong path → correct path | CLAUDE.md / AGENTS.md |
| Search scope | "don't search `axion-model/`, use `axion/`" | CLAUDE.md / AGENTS.md |
| Command patterns | user rejected auto-run 18 times | CLAUDE.md / AGENTS.md |
| Known large files | "`server.py` ~8000 lines — use offset/limit" | CLAUDE.md / AGENTS.md |
| Retry prevention | specific fix that worked | MEMORY.md |

Sections are marker-delimited and replaced on re-run — not duplicated.

## Agent sources

`headroom learn --agent auto` scans all detected sources:

- Claude Code: `~/.claude/projects/*.jsonl`
- Codex: `~/.codex/sessions/*.json`
- Gemini CLI: `~/.gemini/tmp/*/chats/session-*.json`

Override: `--agent claude`, `--agent codex`, `--agent gemini`.

## When to suggest it

- User keeps hitting the same wrong path, command, or search scope.
- Session ended with repeated tool failures that eventually got fixed manually.
- Project has no `AGENTS.md` corrections from real usage yet.
- After a long debugging session: "want me to run `headroom learn` and propose
  AGENTS.md updates?"

## When NOT to suggest it

- One-off mistake, already fixed in the current session.
- User hasn't run enough sessions for patterns to emerge.
- Sandbox/CI with no local session logs.

## Apply discipline

1. Run `headroom learn` (no `--apply`).
2. Show the user the proposed sections.
3. Apply only after confirmation: `headroom learn --apply`.
4. If Broki uses `AGENTS.md`, learnings land there automatically when the
   project is the cwd.

## Boundaries

Guides the learn workflow; does not run commands unless the user asks.
Does not edit marker-delimited sections by hand — re-run learn instead.
One-shot report when invoked as a skill reference; persistent behavior only
when user requests a learn run.

Docs: https://headroom-docs.vercel.app/docs/failure-learning
