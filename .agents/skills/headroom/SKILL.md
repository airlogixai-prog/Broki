---
name: headroom
description: >
  Context compression literacy for agents running with Headroom. Teaches how to
  work with CCR (Compress-Cache-Retrieve): compressed tool outputs, hash markers,
  when to retrieve originals vs stay on the summary, and how to avoid redundant
  headroom_retrieve calls. Use when the user says "headroom", "compressed context",
  "headroom_retrieve", "CCR", "context compression", or when tool output shows
  compression markers like "hash=" or "items compressed to".
license: Apache-2.0
---

# Headroom

Headroom compresses what you read — tool outputs, logs, files, search results —
before it reaches the model. Compression is **reversible** via CCR
(Compress-Cache-Retrieve): originals are cached locally; you can retrieve them
on demand.

## Persistence

ACTIVE when Headroom is in use (proxy, MCP, or wrap). No mode switch needed.
This skill governs **how you behave inside compressed context**, not whether
compression runs.

## CCR markers

Compressed content often includes a marker:

```
[1000 items compressed to 20. Retrieve more: hash=abc123]
```

Or for dropped conversation turns:

```
[Earlier context compressed: 60 message(s) dropped by importance scoring.
Full content available via headroom_retrieve with reference 'def456'.]
```

The hash is the retrieval key. The summary is real data — not a placeholder.

## The retrieve ladder

Stop at the first rung that holds:

1. **Does the summary answer the task?** Work from the compressed output. Most
   tasks need only the summary (70–90% savings, zero risk).
2. **Need one specific item?** Retrieve with a query, not the full blob:
   `headroom_retrieve(hash=abc123, query="auth middleware")`.
3. **Need the full original?** Retrieve once with the hash. Read what you need,
   then continue — do not re-retrieve the same hash in the same turn.
4. **Already retrieved this hash?** Use what you have. Re-fetching the same
   content wastes tokens and latency.

## Rules

- **Summary first, retrieve second.** Treat compression markers as "here is
  the gist; full data exists if you need it" — not as "you must fetch everything."
- **Targeted retrieval beats full retrieval.** Use the `query` parameter
  (BM25 search within the cached original) before pulling the entire cache.
- **One retrieve per hash per task.** If you retrieved `abc123` and still need
  more, refine your query — do not call retrieve again with the same hash and
  no query.
- **Do not retrieve out of anxiety.** Missing a detail in the summary is the
  signal to retrieve; curiosity about "what else is there" is not.
- **Trust proactive expansion.** Headroom's context tracker may expand relevant
  compressed content across turns before you ask. If new detail appeared, use it.
- **Compressed ≠ lost.** Never tell the user data was deleted. Say "compressed
  to N items; I can retrieve the full set if needed."

## MCP tools (when installed)

| Tool | When to use |
|------|-------------|
| `headroom_compress` | Shrink large content before reasoning over it on demand |
| `headroom_retrieve` | Get original by hash; prefer `query` for partial retrieval |
| `headroom_stats` | Check session compression savings and recent events |

Proxy mode handles `headroom_retrieve` transparently — the client never sees
the tool call; the proxy executes it and continues.

## What compresses well

| Content | Typical savings | Notes |
|---------|------------------|-------|
| JSON arrays (search, API, DB rows) | 70–95% | Primary win |
| Logs, diffs, build output | 60–90% | Error lines preserved |
| Long conversations | 50–80% | Low-importance turns dropped |
| Active code you're editing | passthrough | Bodies kept when you're working on them |

## When NOT to fight compression

- User explicitly asked to see full raw output → retrieve or re-read the source.
- Summary clearly missing a field the task requires → retrieve with query.
- Security or correctness depends on an exact byte/string → retrieve that section.

## Boundaries

This skill governs retrieval discipline inside compressed context. It does
not install Headroom, configure the proxy, or run `headroom learn` — use
`headroom-help` for setup and `headroom-learn` for failure mining.

Docs: https://headroom-docs.vercel.app/docs
