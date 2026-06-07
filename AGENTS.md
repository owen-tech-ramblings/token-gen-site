# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

## Shared Codex Context

Before changing this repo, read:

- `AGENTS.md`
- `CURRENT_STATE.md`
- `HANDOFF.md`

After changing this repo, update `CURRENT_STATE.md` and `HANDOFF.md` with:

- what changed
- what was verified
- exact commands or URLs checked
- known remaining failures

These files are the shared context between Codex CLI sessions working on the
Token Gen site and API gateway. Do not rely on chat memory as the source of
truth.

## Architecture Rules

- `https://token-gen.owenonthenet.com` is the static site.
- `https://token-gen-api.owenonthenet.com` must route to the Node API gateway.
- The Node API gateway must expose both monitor and chat routes.
- Python `ServerDetailsAPI` stays behind the Node gateway for status data.
- Browser JavaScript must never include `SERVER_DETAILS_TOKEN` or other secrets.
- The monitor page uses public API routes only.
- The chat page uses the chat and web-search proxy routes exposed by the Node
  gateway.
- Do not point the public API hostname directly at Python `ServerDetailsAPI`
  unless the Node gateway is deliberately replaced with equivalent public routes.

Required public API routes:

- `/api/health`
- `/api/public-status`
- `/.well-known/token-gen-api.json`
- `/api/agent.json`
- `/api/chat/models`
- `/api/chat/stream`
- `/api/web-search/health`

Before committing:

1. Verify the root with `git rev-parse --show-toplevel`.
2. Verify the remote with `git remote -v`.
3. Review `git status --short`.

Expected remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

Related paths:

- Windows source mirror: `/mnt/c/Users/User/Documents/New project/token-gen-site`
- Runtime API proxy: `/home/jesse/.openclaw/workspace/token-gen-api-proxy`

Commit and push public-site changes from this repo unless Jesse explicitly asks
for a different target. Mirror changes to the Windows source copy when useful,
but do not treat the mirror as the deploy authority by default.
