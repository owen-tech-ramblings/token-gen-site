# Token Gen Source Of Truth

Last updated: 2026-06-21

This file is the routing and ownership contract for Codex CLI, Codex app, and
any other agent working on Token Gen. Read it before changing the website, API,
Cloudflare tunnel, bot integration, or generated client helpers.

## Live Surfaces

- Website: `https://token-gen.owenonthenet.com`
- Public API: `https://token-gen-api.owenonthenet.com`
- API contract: `https://token-gen-api.owenonthenet.com/api/agent.json`
- Well-known API contract: `https://token-gen-api.owenonthenet.com/.well-known/token-gen-api.json`

## Active Runtime

The active public API is the Python Server Details API on the Token Gen server:

```text
ssh token-gen
/home/zenfree/server-details-api/server_details_api.py
systemd unit: server-details-api.service
```

Patch API behavior there unless the live contract and process checks prove the
public hostname has intentionally moved.

## Dormant / Local Code

The PC-side Node gateway is not the live public API source by default:

```text
/home/jesse/.openclaw/workspace/token-gen-api-proxy/server.js
```

Do not repoint `token-gen-api.owenonthenet.com` to this gateway unless Jesse
explicitly asks for a routing migration. Treat it as local/runtime reference
code, not as the live API authority.

The old Windows project copy was removed. Do not recreate or use it as a
source for this site:

```text
C:\Users\User\Documents\New project\token-gen-site
/mnt/c/Users/User/Documents/New project/token-gen-site
```

## Required Preflight

Before changing Token Gen API behavior, every agent must run or otherwise verify:

```bash
curl -sS https://token-gen-api.owenonthenet.com/api/agent.json
ssh token-gen 'systemctl is-active server-details-api.service; pgrep -af server_details_api.py'
```

Use the result to decide where to patch. Do not infer the live runtime from a
local file name, a stale handoff note, or a matching route in a dormant repo.

Before changing the public website, verify the canonical repo:

```bash
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages rev-parse --show-toplevel
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages remote -v
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages status --short
```

Expected deploy/source remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

## Safety Rules

- Do not put `SERVER_DETAILS_TOKEN`, `TOKEN_GEN_BOT_API_KEY`, or any private
  token in browser JavaScript.
- Do not work around missing live API behavior by inventing frontend fallback
  data. Fix or document the API route.
- Do not make Cloudflare tunnel, DNS, Worker, or Access changes without proving
  which service currently serves the hostname.
- Do not use the dormant Node gateway as a reason to change the live site unless
  the live contract says the public hostname is using that gateway.
- After API changes, verify public routes from `https://token-gen-api.owenonthenet.com`,
  not only localhost or Tailscale routes.

## Current Required Public API Routes

- `/api/health`
- `/api/public-status`
- `/api/agent.json`
- `/.well-known/token-gen-api.json`
- `/api/chat/models`
- `/api/chat/completions`
- `/api/chat/stream`
- `/api/web-search/health`

## Current Protected Bot Routes

- `/api/discord-auth-check`
- `/api/discord/chat/models`
- `/api/discord/chat/completions`
- `/api/discord/chat/stream`

These require `Authorization: Bearer <TOKEN_GEN_BOT_API_KEY>`. If
`TOKEN_GEN_BOT_API_KEY` is not configured on the active server, the current
runtime falls back to `SERVER_DETAILS_TOKEN`.
