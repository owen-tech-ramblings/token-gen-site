# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

## Shared Codex Context

Before changing this repo, read:

- `TOKEN_GEN_SOURCE_OF_TRUTH.md`
- `AGENTS.md`
- `CURRENT_STATE.md`
- `HANDOFF.md`

After changing this repo, update `CURRENT_STATE.md` and `HANDOFF.md` with:

- what changed
- what was verified
- exact commands or URLs checked
- known remaining failures

These files are the shared context between Codex CLI sessions working on the
Token Gen site and API. Do not rely on chat memory as the source of truth.

`TOKEN_GEN_SOURCE_OF_TRUTH.md` is the routing authority. If it conflicts with
`CURRENT_STATE.md`, `HANDOFF.md`, older plans, or a local gateway route, stop
and verify the live API before editing.

## Development Roles

These roles apply only to development of the Token Gen API and Token Gen web
pages.

### Token-Gen Server Codex: API Producer

The Codex CLI session running on the Token-Gen server owns the API producer
side:

- Python `ServerDetailsAPI` runtime and deployment
- vLLM upstream connectivity
- Tavily/web-search service connectivity
- Cloudflare tunnel service target for `token-gen-api.owenonthenet.com`
- `.well-known/token-gen-api.json` and `/api/agent.json` API contract contents
- route auth/CORS behavior
- live API route verification

That Codex should make API behavior true before asking the website to consume it.

### This PC Codex: Web Site Builder

The Codex session on this PC owns the browser/site side:

- static site files for `https://token-gen.owenonthenet.com`
- monitor and chat page rendering
- browser-safe API consumption
- Cloudflare Access website protection coordination
- UI states for loading, degraded API responses, and errors
- frontend Playwright/browser verification
- cache-busting static assets when needed

This Codex should not add private tokens to browser JavaScript or work around
missing API behavior by inventing data. If the API contract or live route is
missing, document it in `CURRENT_STATE.md`/`HANDOFF.md` and hand it to the
Token-Gen Server Codex.

## Architecture Rules

- `https://token-gen.owenonthenet.com` is the static site.
- `https://token-gen.owenonthenet.com/*` should be protected by Cloudflare Access.
- Cloudflare Access allowlist should target `jesse@owenonthenet.com`,
  `li-zen@owenonthenet.com`, and `gusulei@gmail.com`.
- `https://token-gen-api.owenonthenet.com` routes to the token-gen server API.
- The active public API source is currently
  `token-gen:/home/zenfree/server-details-api/server_details_api.py`.
- The token-gen server API must expose both monitor and chat routes.
- Browser JavaScript must never include `SERVER_DETAILS_TOKEN` or other secrets.
- The monitor page uses public API routes only.
- The chat page uses the chat and web-search routes exposed by the token-gen API.
- The PC-side Node API proxy is dormant/obsolete unless deliberately
  reintroduced for a specific future feature.

Before changing API behavior, run or verify:

```bash
curl -sS https://token-gen-api.owenonthenet.com/api/agent.json
ssh token-gen 'systemctl is-active server-details-api.service; pgrep -af server_details_api.py'
```

Do not infer the live runtime from local files. Do not repoint Cloudflare to the
PC-side Node gateway unless Jesse explicitly asks for a routing migration.

Required public API routes:

- `/api/health`
- `/api/public-status`
- `/.well-known/token-gen-api.json`
- `/api/agent.json`
- `/api/chat/models`
- `/api/chat/completions`
- `/api/chat/stream`
- `/api/web-search/health`

Required protected Discord bot routes:

- `/api/discord-auth-check`
- `/api/discord/chat/models`
- `/api/discord/chat/completions`
- `/api/discord/chat/stream`

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
- Dormant PC API proxy: `/home/jesse/.openclaw/workspace/token-gen-api-proxy`

Commit and push public-site changes from this repo unless Jesse explicitly asks
for a different target. Mirror changes to the Windows source copy when useful,
but do not treat the mirror as the deploy authority by default.
