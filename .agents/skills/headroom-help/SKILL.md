---
name: headroom-help
description: >
  Quick-reference card for Headroom setup, CLI commands, MCP tools, and proxy
  integration. One-shot display, not a persistent mode. Trigger: /headroom-help,
  "headroom help", "how do I use headroom", "headroom commands", "setup headroom".
license: Apache-2.0
---

# Headroom Help

Display this reference card when invoked. One-shot — do NOT change mode, write
flag files, or persist anything.

## What Headroom does

Compresses tool outputs, logs, files, and conversation history before they
reach the LLM. Same answers, 60–95% fewer tokens. Reversible via CCR — originals
cached locally, retrievable on demand.

## Install

```bash
pip install "headroom-ai[proxy]"   # proxy + MCP
pip install "headroom-ai[mcp]"       # MCP only (lightweight)
npm install headroom-ai              # TypeScript SDK
```

Docker: `curl -fsSL https://raw.githubusercontent.com/chopratejas/headroom/main/scripts/install.sh | bash`

## Quick start paths

| Path | Command | Best for |
|------|---------|----------|
| **Proxy** | `headroom proxy --port 8787` | Zero code changes, any client |
| **Wrap** | `headroom wrap claude` / `codex` / `cursor` | One command, proxy + tool |
| **MCP** | `headroom mcp install` | On-demand compress/retrieve in Claude Code |
| **Library** | `from headroom import compress` | Inline in Python/TS apps |

### Cursor

```bash
headroom wrap cursor
```

Prints config instructions and keeps the proxy running. Paste the shown
settings once — Headroom does not launch Cursor directly.

### Claude Code via proxy

```bash
headroom proxy --port 8787
ANTHROPIC_BASE_URL=http://127.0.0.1:8787 claude
```

Or: `headroom wrap claude`

## CLI commands

| Command | What it does |
|---------|--------------|
| `headroom proxy` | Start local compression proxy (default port 8787) |
| `headroom wrap <tool>` | Start proxy + launch claude/codex/cursor/copilot/aider |
| `headroom mcp install` | Register MCP tools with Claude Code |
| `headroom learn` | Mine past session failures (dry-run) |
| `headroom learn --apply` | Write learnings to CLAUDE.md / AGENTS.md |
| `headroom memory list` | Inspect stored memories |
| `headroom perf` | Summarize proxy performance from logs |
| `headroom install apply` | Persistent background proxy |

## MCP tools

| Tool | Purpose |
|------|---------|
| `headroom_compress` | Compress content on demand, returns hash |
| `headroom_retrieve` | Get original by hash; optional `query` for search |
| `headroom_stats` | Session compression stats and savings |

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **headroom** | `/headroom` | CCR literacy: summary-first, retrieve discipline |
| **headroom-learn** | `/headroom-learn` | Guide for mining session failures into project docs |
| **headroom-help** | `/headroom-help` | This card |

## Useful env vars

| Variable | Effect |
|----------|--------|
| `HEADROOM_TELEMETRY=off` | Disable anonymous telemetry |
| `HEADROOM_PROXY_URL` | MCP proxy URL (default `http://127.0.0.1:8787`) |
| `HEADROOM_WORKSPACE_DIR` | Override `~/.headroom` state root |

## Persistent install

```bash
headroom install apply --preset persistent-service --providers auto
headroom install status
```

Keeps the proxy running in the background; `wrap` reuses it automatically.

## More

- Docs: https://headroom-docs.vercel.app/docs
- GitHub: https://github.com/chopratejas/headroom
- CCR deep dive: https://headroom-docs.vercel.app/docs/ccr
