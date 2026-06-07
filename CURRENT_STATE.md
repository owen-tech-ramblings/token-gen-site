# Token Gen Current State

Last updated: 2026-06-08 09:16 Australia/Sydney

## Repos And Surfaces

- Static site repo: `/home/jesse/.openclaw/workspace/token-gen-site-pages`
- API gateway workspace: `/home/jesse/.openclaw/workspace/token-gen-api-proxy`
- Site: `https://token-gen.owenonthenet.com`
- API: `https://token-gen-api.owenonthenet.com`

## Expected Architecture

`token-gen-api.owenonthenet.com` should route to the Node API gateway.

The Node gateway should proxy to:

- Python `ServerDetailsAPI` for monitor/status data
- vLLM for chat models and chat streaming
- Token Gen web-search service for Tavily context

Python `ServerDetailsAPI` should not be the direct public browser API unless it
also provides all required public monitor and chat routes.

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
- Chat page has a fallback model for model discovery failures:
  `Qwen-Qwen3.6-27B-FP8`.
- Current live chat check previously passed with:
  - `chat.js?v=token-chat-model-fallback-20260608`
  - `/api/chat/models` returning 200
  - `/api/web-search/health` returning 200

## Known Risks

- Cloudflare/API routing has changed during recent work. Always re-check live
  API routes before assuming the gateway state.
- If `/api/chat/models` hangs or returns Cloudflare 502, the chat page should
  fall back to the default model but the gateway/vLLM route still needs fixing.
- If `/api/public-status` or `/.well-known/token-gen-api.json` returns 404, the
  public API hostname is likely pointed at a stale gateway build or wrong service.

