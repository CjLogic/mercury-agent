# Mercury — Architecture

> Living document. Updated as the system evolves.

## Overview

Mercury is a soul-driven, token-efficient AI agent that runs 24/7. It is an **orchestrator**, not just a chatbot. It can read/write files, run commands, and perform multi-step agentic workflows — all governed by a strict permission system. It communicates via channels (CLI, Telegram, future: Signal, Discord, Slack) and maintains persistent memory.

## The Human Analogy

| Mercury Concept | Human Analogy | File/Module |
|---|---|---|
| soul.md | Heart | `soul/soul.md` |
| persona.md | Face | `soul/persona.md` |
| taste.md | Palate | `soul/taste.md` |
| heartbeat.md | Breathing | `soul/heartbeat.md` |
| Short-term memory | Working memory | `src/memory/store.ts` |
| Episodic memory | Recent experiences | `src/memory/store.ts` |
| Long-term memory | Life lessons | `src/memory/store.ts` |
| Providers | Senses | `src/providers/` |
| Capabilities | Hands & tools | `src/capabilities/` |
| Permissions | Boundaries | `src/capabilities/permissions.ts` |
| Channels | Communication | `src/channels/` |
| Heartbeat/scheduler | Circadian rhythm | `src/core/scheduler.ts` |
| Lifecycle | Awake/Sleep/Think | `src/core/lifecycle.ts` |

## Directory Structure

```
src/
├── index.ts              # CLI entry (commander)
├── channels/             # Communication interfaces
│   ├── base.ts           # Abstract channel
│   ├── cli.ts            # CLI adapter (readline + inline permission prompts)
│   ├── telegram.ts       # Telegram adapter (grammY)
│   └── registry.ts       # Channel manager
├── core/                 # Channel-agnostic brain
│   ├── agent.ts          # Multi-step agentic loop (generateText with tools)
│   ├── lifecycle.ts      # State machine
│   └── scheduler.ts     # Cron + heartbeat
├── capabilities/         # Agentic tools & permissions
│   ├── permissions.ts    # Permission manager (read/write scope, shell blocklist)
│   ├── registry.ts      # Registers all AI SDK tools
│   ├── filesystem/      # File ops: read, write, create, list, delete
│   └── shell/           # Shell execution with blocklist
├── memory/               # Persistence layer
│   └── store.ts          # Short/long/episodic memory
├── providers/            # LLM APIs
│   ├── base.ts           # Abstract provider + getModelInstance()
│   ├── openai-compat.ts
│   ├── anthropic.ts
│   └── registry.ts
├── soul/                 # Consciousness
│   └── identity.ts       # Soul/persona/taste loader + guardrails
├── skills/               # Modular abilities
│   ├── types.ts
│   └── loader.ts
├── types/                # Type definitions
└── utils/                # Config, logger, tokens
```

## Agentic Loop

Mercury uses the Vercel AI SDK's multi-step `generateText()` with tools:

```
User message → Agent loads system prompt (soul + guardrails + persona)
  → Agent calls generateText({ tools, maxSteps: 10 })
    → LLM decides: respond with text OR call a tool
      → If tool called:
        → Permission check (filesystem scope / shell blocklist)
        → If allowed: execute tool, return result to LLM
        → If denied: LLM gets denial message, adjusts approach
        → LLM continues (next step) — may call more tools or respond
      → If text: final response returned to user
  → Agent sends final response via channel
```

## Permission System

### Filesystem Permissions (folder-level scoping)

- Paths without scope = **no access**, must ask user
- User can grant: `y` (one-time), `always` (saves to manifest), `n` (deny)
- Manifest stored at `~/.mercury/permissions.yaml`
- Edit anytime — Mercury never bypasses

### Shell Permissions

- **Blocked** (never executed): `sudo *`, `rm -rf /`, `mkfs`, `dd if=`, fork bombs, `shutdown`, `reboot`
- **Auto-approved** (no prompt): `ls`, `cat`, `pwd`, `git status/diff/log`, `node`, `npm run/test`
- **Needs approval**: `npm publish`, `git push`, `docker`, `rm -r`, `chmod`, piped `curl | sh`
- Commands restricted to CWD + approved folder scopes

### Inline Permission UX

When Mercury needs a scope it doesn't have:
```
  ⚠ Mercury needs write access to ~/projects/myapp. Allow? (y/n/always):
  > always
  [Scope saved to ~/.mercury/permissions.yaml]
```

## Tools

| Tool | Description | Permission Check |
|---|---|---|
| `read_file` | Read file contents | Read scope for path |
| `write_file` | Write to existing file | Write scope for path |
| `create_file` | Create new file + dirs | Write scope for parent dir |
| `list_dir` | List directory contents | Read scope for path |
| `delete_file` | Delete a file | Write scope, always confirms |
| `run_command` | Execute shell command | Blocklist + approval list + scope |

## Agent Lifecycle

```
unborn → birthing → onboarding → idle ⇄ thinking → responding → idle
                                                          ↓
                                            idle → sleeping → awakening → idle
```

## Runtime Data Location

All runtime data lives in `~/.mercury/` (not the project directory):

| What | Where |
|---|---|
| Config | `~/.mercury/mercury.yaml` |
| Soul files | `~/.mercury/soul/*.md` |
| Memory | `~/.mercury/memory/` |
| Skills | `~/.mercury/skills/` |
| Permissions | `~/.mercury/permissions.yaml` |

## Token Budget

- System prompt (soul + guardrails + persona): ~500 tokens per request
- Short-term context: last 10 messages
- Long-term facts: keyword-matched, ~3 facts injected
- Daily default: 50,000 tokens

## Channels

### CLI
- Readline-based with inline permission prompts
- `mercury start` or just `mercury`

### Telegram
- grammY framework + @grammyjs/stream for streaming
- Typing indicator while processing
- Proactive messages via heartbeat
- `TELEGRAM_BOT_TOKEN` in .env or mercury.yaml