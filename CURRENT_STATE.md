# Token Gen Current State

Last updated: 2026-06-08 12:56 Australia/Sydney

## Repos And Surfaces

- Static site repo: `/home/jesse/.openclaw/workspace/token-gen-site-pages`
- Dormant PC API proxy workspace: `/home/jesse/.openclaw/workspace/token-gen-api-proxy`
- Site: `https://token-gen.owenonthenet.com`
- API: `https://token-gen-api.owenonthenet.com`

## Expected Architecture

`token-gen.owenonthenet.com/*` should be protected by Cloudflare Access using
Google auth. Initial allowed users:

- `jesse@owenonthenet.com`
- `li-zen@owenonthenet.com`
- `gusulei@gmail.com`

`token-gen-api.owenonthenet.com` routes to the token-gen server API. The
website is only a consumer of that API.

The PC-side Node gateway is dormant/obsolete unless deliberately reintroduced
for a specific future feature.

Cloudflare Access setup is still pending. Wrangler OAuth login works for zone
reads, but the current token returns Cloudflare `Authentication error` for
Access app endpoints. Configure Access in the Cloudflare dashboard or provide a
token/session with Zero Trust Access application/policy permissions.

## Development Responsibilities

These roles apply only to Token Gen API and Token Gen webpage development:

- Token-Gen Server Codex is the API producer. It owns API/runtime routing,
  upstream service connectivity, `.well-known`/agent API contract documents,
  CORS/auth behavior, Cloudflare tunnel target, and live API verification.
- This PC Codex is the web site builder. It owns static page rendering,
  browser-safe API consumption, UI degraded/error states, frontend verification,
  and cache-busting static assets.
- The website should consume the API contract and live public routes. It should
  not embed secrets, call private status routes directly, or invent values when
  API data is absent.

## Required Public Routes

- `/api/health`
- `/api/public-status`
- `/.well-known/token-gen-api.json`
- `/api/agent.json`
- `/api/chat/models`
- `/api/chat/stream`
- `/api/web-search/health`

## Live Route Status

Checked from this workspace on 2026-06-08 09:16 Australia/Sydney:

```bash
for path in /api/health /api/public-status /.well-known/token-gen-api.json /api/agent.json /api/chat/models /api/web-search/health; do
  curl -sS -o /tmp/token-gen-route-body -w '%{http_code}' --max-time 12 "https://token-gen-api.owenonthenet.com${path}"
done
```

Observed status:

- `/api/health`: 200
- `/api/public-status`: 200
- `/.well-known/token-gen-api.json`: 200
- `/api/agent.json`: 200
- `/api/chat/models`: 200
- `/api/web-search/health`: 200

## Recent Site State

- Monitor page was simplified to a direct public API renderer.
- Chat page no longer uses fallback model discovery. If `/api/chat/models`
  fails, chat is disabled until the API works.
- Current chat asset:
  - `chat.js?v=token-chat-api-required-20260608`
  - `/api/chat/models` returning 200
- `/api/web-search/health` returns 200 but currently reports Tavily unavailable
  when the web-search service is not configured/running.

## Known Risks

- Cloudflare/API routing has changed during recent work. Always re-check live
  API routes before assuming the gateway state.
- Cloudflare Access is not verified as active yet. Do not assume the site is
  private until an unauthenticated browser is redirected to Access login.
- If `/api/chat/models` hangs or returns an error, the chat page disables chat.
- If `/api/public-status` or `/.well-known/token-gen-api.json` returns 404, the
  public API hostname is likely pointed at a stale service or wrong tunnel.
