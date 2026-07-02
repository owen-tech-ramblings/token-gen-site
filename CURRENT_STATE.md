# Token Gen Current State

Last updated: 2026-06-09 01:35 Australia/Sydney

## Alignment Update - 2026-06-21

`TOKEN_GEN_SOURCE_OF_TRUTH.md` is now the routing authority for Codex CLI,
Codex app, and other agents.

Current live API authority:

- `https://token-gen-api.owenonthenet.com`
- `token-gen:/home/zenfree/server-details-api/server_details_api.py`
- `server-details-api.service`

The PC-side Node API proxy is dormant/local reference code unless Jesse
explicitly asks for a Cloudflare routing migration.

Before any API behavior edit, agents must verify:

```bash
curl -sS https://token-gen-api.owenonthenet.com/api/agent.json
ssh token-gen 'systemctl is-active server-details-api.service; pgrep -af server_details_api.py'
```

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
- `/api/chat/completions`
- `/api/chat/stream`
- `/api/web-search/health`

Required protected Discord bot routes:

- `/api/discord-auth-check`
- `/api/discord/chat/models`
- `/api/discord/chat/completions`
- `/api/discord/chat/stream`

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

- 2026-07-02 update:
  - Image settings in chat now include a collapsible settings area with
    creativity, preservation preset, and edit change strength controls.
  - Normal image edits now use the configured edit change value for both
    `strength` and `denoise` instead of a hardcoded `0.45`.
  - Image prompt injection is now structured as `USER IMAGE REQUEST` plus
    `IMAGE SETTINGS GUIDANCE`, and only applies to image generation/edit API
    calls, not normal text chat.
  - Edit prompts now explicitly ask the image model to preserve unmentioned
    identity, clothing, pose, hand placement, facial expression, object
    positions, camera angle, lighting, crop, composition, and unrelated
    background details.
  - Current chat asset:
    - `chat.js?v=token-chat-image-guidance-controls-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    and local Playwright checks for rendered controls plus edit payload
    strength/denoise/prompt guidance.
- 2026-07-02 update:
  - Image edit/style requests now resize the selected source image in the
    browser to the configured output dimensions before calling
    `/api/image/edits`. This prevents edits of a 512 x 384 uploaded/source
    image from saving at 512 x 384 when the user selected 1024 x 1024.
  - Current chat asset:
    - `chat.js?v=token-chat-image-edit-size-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    and a local Playwright check proving a 64 x 48 uploaded PNG is submitted to
    `/api/image/edits` as a 1024 x 1024 PNG data URL when 1024 square is
    selected.
- 2026-07-02 update:
  - Chat image Download now uses a browser blob download helper so it does not
    navigate away from the chat page.
  - Generated images also expose a separate open-in-new-tab icon link.
  - Uploaded PNG/JPG image edits now send a data URL `image_base64` plus
    `source_filename_prefix`; they no longer send `image.filename`, because the
    API treats that as an existing ComfyUI image reference.
  - Current chat asset:
    - `chat.js?v=token-chat-image-download-upload-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    a local Playwright browser check, and a live `/api/image/edits` payload
    check returning 200 for uploaded base64 without `image.filename`.
- Monitor page was simplified to a direct public API renderer.
- Monitor counters now label their scope. If
  `public-status.vllm.lifetime_counters` is populated, the Counters card shows
  lifetime totals. If the API returns an empty/null lifetime object, the card
  explicitly says it is showing current vLLM process counters only.
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
- Lifetime token totals are currently an API/storage issue, not a website
  renderer issue. On 2026-06-09, live `/api/public-status` exposed
  `vllm.lifetime_counters` as `{}` and private `/api/vllm`/`/api/usage`
  exposed lifetime as `null`. Private `/api/storage` reported
  `owenshare_reachable: false` and `last_storage_error: "network storage unavailable"`.
  Token-gen `/etc/fstab` points `//192.168.68.54/Owen_Share` at
  `/mnt/owenshare`, but `192.168.68.54:445` times out from token-gen and this
  PC. `192.168.68.59:445` is reachable from this PC, but the saved
  Owen_Share credentials fail there, so do not repoint the mount blindly.
