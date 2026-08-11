# Token Gen Source Of Truth

Last updated: 2026-08-11

This file is the routing and ownership contract for Codex CLI, Codex app, and
any other agent working on Token Gen. Read it before changing the website, API,
Cloudflare tunnel, bot integration, or generated client helpers.

## Live Surfaces

- Website: `https://token-gen.owenonthenet.com`
- Public API: `https://token-gen-api.owenonthenet.com`
- API contract: `https://token-gen-api.owenonthenet.com/api/agent.json`
- Well-known API contract: `https://token-gen-api.owenonthenet.com/.well-known/token-gen-api.json`

## Active API source and runtime

The canonical API source is the separate repository at
`/home/jesse/.openclaw/workspace/token-gen-api`, remote
`https://github.com/owen-tech-ramblings/token-gen-api.git`. Its
rollback-protected release transaction installs the reviewed commit on the
Token Gen server. The runtime path is a deployment target, not an authoring
source. Never patch it directly.

Production chat and web search remain entirely on the Token Gen server. The
API calls its pinned loopback-only SearXNG service; this PC is not a production
API, search, Tor or page-fetch dependency.

## Deployed and mirror code

The local Node gateway is a deployed integration copy owned by the Lil Zen
control-plane source. It is not the public API authority or a product commit
source:

```text
/home/jesse/.openclaw/workspace/token-gen-api-proxy/server.js
```

Do not repoint `token-gen-api.owenonthenet.com` to this gateway or edit the
deployed copy. A deliberate routing migration requires a versioned
control-plane decision and rollback-protected release.

The checked-in `services/` examples in this website repository are historical
reference material. They are not installed by the website release and must not
be treated as an API, SearXNG or worker deployment source.

The Windows project copy is a non-authoritative mirror. It may be refreshed
from a verified release, but it is never a source or deployment authority:

```text
C:\Users\User\Documents\New project\token-gen-site
/mnt/c/Users/User/Documents/New project/token-gen-site
```

## Required Preflight

Before changing Token Gen API behaviour, use the enhancement guide, create a
receipt-bound managed worktree for `token-gen-api`, and run that repository's
full preflight and checks. This website repository may perform read-only
integration checks:

```bash
curl -fsS https://token-gen-api.owenonthenet.com/api/agent.json
curl -fsS https://token-gen-api.owenonthenet.com/api/web-search/health
```

Do not use these checks to select an ad hoc patch location. Source ownership is
fixed by the ecosystem contract even when the live service is unhealthy.

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
- Do not use the deployed Node gateway as a reason to change the live site or
  public API route.
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
