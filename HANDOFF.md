# Token Gen Handoff

Last updated: 2026-06-09 01:35 Australia/Sydney

## 2026-06-21 Alignment Guardrail

Added `TOKEN_GEN_SOURCE_OF_TRUTH.md` as the shared routing contract for Codex
CLI and Codex app. Read it before changing the Token Gen site, API, Cloudflare
tunnel, bot helper, or generated client code.

Key rule: the active public API currently lives on `token-gen` at
`/home/zenfree/server-details-api/server_details_api.py`. The PC-side Node
gateway is dormant/local reference code unless Jesse explicitly asks to migrate
Cloudflare routing to it.

Required API preflight:

```bash
curl -sS https://token-gen-api.owenonthenet.com/api/agent.json
ssh token-gen 'systemctl is-active server-details-api.service; pgrep -af server_details_api.py'
```

## Last Session Changes

- 2026-07-02 chat image guidance controls:
  - Added collapsible Image settings in the chat sidebar.
  - Added creativity, preservation preset, and editable change
    strength/denoise controls.
  - Normal edit requests now use the configured edit change value instead of
    hardcoded `0.45`.
  - Reworked image prompt injection so image calls send the user's request in a
    `USER IMAGE REQUEST` block followed by `IMAGE SETTINGS GUIDANCE`. Text chat
    requests do not receive these image prompt additions.
  - Added verbose preservation instructions to reduce unrequested changes to
    clothing, pose, hand placement, facial identity, composition, lighting, and
    background details.
  - No API change was required for these controls because `/api/image/edits`
    already accepts `strength` and `denoise`.
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - local Playwright payload check for rendered controls, edit
      strength/denoise, source resize, and structured prompt guidance
    - local Playwright layout screenshot check for the sidebar settings
- 2026-07-02 chat image sizing bugfix:
  - Fixed image edit/style generation so the selected source image is resized
    in the browser to the configured output dimensions before submission to
    `/api/image/edits`.
  - This addresses edits saving at the source image size, such as 512 x 384,
    even when the user selected 1024 x 1024.
  - Cache-busted `chat.html` to
    `chat.js?v=token-chat-image-edit-size-20260702`.
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - local Playwright check proving a 64 x 48 uploaded PNG is submitted as a
      1024 x 1024 PNG data URL when 1024 square is selected
- 2026-07-02 chat image bugfix:
  - Fixed generated-image Download so it creates a blob URL and triggers a
    download without leaving `chat.html`.
  - Added a separate open-in-new-tab icon link for generated images.
  - Fixed uploaded PNG/JPG image edits by sending `image_base64` as a data URL
    and `source_filename_prefix`, without an `image.filename` object. The API
    interprets `image.filename` as an existing ComfyUI `/view` reference, which
    caused uploaded files to fail with `HTTP Error 404: Not Found`.
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - local Playwright check for download behavior and upload edit payload
    - live `/api/image/edits` uploaded-base64 payload returned 200 when
      `image.filename` was omitted
- Updated the monitor page counter rendering:
  - `monitor-simple-20260607-token-rates.js`
  - `server-monitor.html`
- The Counters card now uses `vllm.lifetime_counters` when the public API
  provides a populated object. When the API returns no lifetime data, it labels
  the values as current runtime process counters and says lifetime counters are
  not provided by the API.
- Added shared Codex context files for the Token Gen project:
  - `AGENTS.md`
  - `CURRENT_STATE.md`
  - `HANDOFF.md`
- Documented that both Codex CLI sessions should read and update these files.
- Documented the required public API routes and current token-gen API producer
  architecture.
- Documented development responsibilities:
  - Token-Gen Server Codex owns the API producer/runtime side.
  - This PC Codex owns the static website/browser-consumer side.
- Current accepted architecture: website consumes the token-gen server API
  directly; the PC-side Node API proxy is dormant/obsolete unless explicitly
  reintroduced.
- Website should be protected by Cloudflare Access with Google login for:
  `jesse@owenonthenet.com`, `li-zen@owenonthenet.com`,
  `gusulei@gmail.com`.
- Cloudflare Access configuration is pending: Wrangler can read the
  `owenonthenet.com` zone, but Access app endpoints return Cloudflare
  `Authentication error` with the current OAuth token.

## Current Live Status

Fresh route check shows the required API routes are currently returning 200:

- `/api/health`
- `/api/public-status`
- `/.well-known/token-gen-api.json`
- `/api/agent.json`
- `/api/chat/models`
- `/api/web-search/health`

## Current Metrics Diagnosis

The website is not hiding the >25M lifetime counter. The API is not currently
providing it to the public monitor page.

Evidence checked on 2026-06-09:

- `https://token-gen-api.owenonthenet.com/api/public-status` contains current
  process counters under `vllm.runtime_counters` and no populated lifetime
  counter object.
- Token-gen local `http://100.98.87.102:8765/api/public-status` contains
  `vllm.lifetime_counters: {}`.
- Authenticated `/api/vllm` and `/api/usage` return lifetime as `null`.
- Authenticated `/api/storage` reports Owen_Share unavailable and metrics
  storage degraded.
- Token-gen fstab still points `/mnt/owenshare` at
  `//192.168.68.54/Owen_Share`; that host/port is timing out.
- `192.168.68.59:445` is reachable, but the saved Owen_Share credentials fail
  there, so the mount target should be confirmed before changing fstab.

API producer next step: restore the Owen_Share mount or update it to the
confirmed current SMB host for `Owen_Share`, then verify `/api/vllm` returns a
populated `lifetime_counters.total_tokens` and `/api/public-status` forwards
that value.

## Next Steps For Any Codex CLI Session

1. Read `TOKEN_GEN_SOURCE_OF_TRUTH.md`, `AGENTS.md`, `CURRENT_STATE.md`, and
   `HANDOFF.md`.
2. Run `git status --short --branch`.
3. Confirm whether the task belongs to the API producer role or website builder
   role. If the other role owns the fix, update the docs with evidence and hand
   it off instead of papering over the boundary.
4. Re-check live API routes before diagnosing monitor or chat issues:

```bash
for path in /api/health /api/public-status /.well-known/token-gen-api.json /api/agent.json /api/chat/models /api/web-search/health; do
  echo "### $path"
  curl -sS -i --max-time 12 "https://token-gen-api.owenonthenet.com${path}" | sed -n '1,35p'
done
```

5. Update this file before stopping with:
   - files changed
   - commits made
   - live verification output summary
   - remaining broken routes or risks
