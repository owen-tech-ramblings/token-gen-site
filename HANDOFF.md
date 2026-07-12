# Token Gen Handoff

Last updated: 2026-07-13 Australia/Sydney

## 2026-07-13 Current Chat System Prompt

The default system prompt in `chat.html` now reflects the full current chat
surface rather than the original text-only prototype. Keep it synchronized when
document ingestion, web providers, image modes, privacy behavior, or runtime
capability boundaries change. `tools/site-contract-tests.mjs` contains the
regression contract. The prompt is intentionally user-visible and editable.

## 2026-07-13 Tavily To SearXNG Failover Handoff

The requested behavior is implemented and verified end to end:

- Provider priority is user-supplied session Tavily key, site Tavily key, then
  balanced local SearXNG only after Tavily HTTP 432.
- User keys are password inputs, sent in the request body, never written to
  localStorage, returned in responses, or logged by the application.
- Local SearXNG container `token-gen-searxng` listens only on
  `127.0.0.1:8888`, restarts unless stopped, and uses
  `services/token-gen-searxng/settings.yml`.
- Tailscale Serve exposes that port to the tailnet only at
  `100.92.126.107:8888` for the active Token Gen server.
- The active server source `/home/zenfree/server-details-api/server_details_api.py`
  implements the same provider order and publishes it in `/api/agent.json`.
- The API process and PC-side services were restarted and are healthy.
- Public streaming fallback was reproduced successfully with the exhausted
  site key; no user or site key was printed or returned.

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

- 2026-07-03 image prompt cleanup:
  - Jesse provided a generated image that visibly rendered browser chrome,
    settings-panel text, `Quality.max`, `Creativity...0.80`, `API edit
    preservation`, and a blank bordered rectangle.
  - Root cause: image prompts contained machine-readable scaffold headings and
    key/value API labels. The API values should be JSON fields only, not visual
    prompt text.
  - Removed `USER IMAGE REQUEST`, `IMAGE SETTINGS GUIDANCE`, `API controls`,
    and `API edit preservation` style strings from image prompts.
  - Reworded quality/content/creativity/preservation prompt fragments as
    natural art direction rather than field labels.
  - Added negative prompt coverage for browser chrome, web pages, screenshots,
    UI/control panels, text labels, blank white rectangles, borders, frames, and
    matte artifacts.
  - Cache-busted `chat.html` to:
    - `styles.css?v=token-chat-image-prompt-clean-20260703`
    - `chat.js?v=token-chat-image-prompt-clean-20260703`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright uploaded-image restyle payload check proving scaffold
      text is absent and anti-border/UI negative prompts are present
    - local Playwright edit and generation payload checks
    - local Playwright masked edit/upscale and desktop/mobile UI checks
- 2026-07-02 uploaded-image restyle mode:
  - Added `Restyle source image` for converting an uploaded source image into
    a selected style such as pencil drawing, Van Gogh, comic, manga, etc.
  - This fixes the conflict where normal edit mode used strict preservation and
    low denoise, which is appropriate for small edits but too conservative for
    whole-image style transfer.
  - Restyle mode routes through `/api/image/edits` with stronger defaults:
    - preservation: `flexible`
    - strength/denoise: `0.65`
  - Restyle prompt text now explicitly says to change the visual medium,
    linework, brushwork, color treatment, texture, and rendering technique while
    preserving identity, pose, relationships, composition, camera angle, and
    object layout.
  - Selecting a style preset on an uploaded source image auto-switches from
    `Edit source image` to `Restyle source image`.
  - Cache-busted `chat.html` to:
    - `styles.css?v=token-chat-image-restyle-20260702`
    - `chat.js?v=token-chat-image-restyle-20260702`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright uploaded-image restyle payload check
    - local Playwright edit payload check
    - local Playwright generation API controls check
    - local Playwright masked edit/upscale checks
    - local Playwright desktop/mobile UI check
- 2026-07-02 image API controls:
  - Reviewed live `/api/image/models`; the useful new parameter metadata is in
    that public endpoint rather than the protected `/docs`/`/openapi.json`
    routes, which return 401 from this shell.
  - Added UI/payload support for:
    - `quality` with the new `max` option
    - numeric `creativity`
    - `content_rating` values `kid`, `teen`, `standard`, `adult_ok`
    - edit `preservation` values `strict`, `balanced`, `flexible`
    - `sampler_name`
    - `scheduler`
  - Image generation and edit requests now send those API fields directly.
    Upscale remains deterministic and continues to send only the upscale fields.
  - Cache-busted `chat.html` to:
    - `styles.css?v=token-chat-image-api-controls-20260702`
    - `chat.js?v=token-chat-image-api-controls-20260702`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright desktop/mobile UI screenshot check
    - local Playwright generation payload check for the new fields
    - local Playwright edit payload check for the new fields
    - local Playwright masked edit and upscale payload checks
    - local Playwright upload-button and large JPEG upload checks
- 2026-07-02 upload button hardening:
  - Jesse reported the page still disappeared when pressing the upload button,
    so the upload activation path was changed rather than only the post-upload
    preview behavior.
  - Replaced label-wrapped hidden file inputs with explicit buttons for:
    - source image upload
    - edit mask upload
    - document attach
  - The standalone hidden file inputs are now opened from button click
    handlers. This should be more reliable in embedded/live browser contexts
    while preserving the same visual layout.
  - Cache-busted `chat.html` to:
    - `styles.css?v=token-chat-upload-button-20260702`
    - `chat.js?v=token-chat-upload-button-20260702`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright upload-button click/filechooser test
    - local Playwright 5.6 MB JPEG source upload test
    - local Playwright desktop/mobile UI check
    - local Playwright image guidance, masked edit, and upscale payload checks
- 2026-07-02 uploaded image preview bugfix:
  - Fixed a blank/stalled page risk after uploading larger PNG/JPG source
    images in chat.
  - Root cause: the preview renderer put the full uploaded base64 data URL into
    the DOM as the `<img src>`. Reproducing with
    `C:\Users\User\Downloads\image0.jpeg` showed page HTML growing to about
    7.5 MB after upload.
  - Uploaded image previews now use lightweight browser object URLs. The full
    base64 payload is still retained in JS state for `/api/image/edits` and
    `/api/image/upscale` requests.
  - Preview object URLs are revoked when a source/mask image is replaced or
    cleared.
  - Cache-busted `chat.html` to:
    - `chat.js?v=token-chat-upload-preview-20260702`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright reproduction with a 5.6 MB JPEG source upload
    - local Playwright desktop/mobile UI check
    - local Playwright image guidance, masked edit, and upscale payload checks
- 2026-07-02 chat UI polish:
  - Cleaned up the chat image settings panel so controls are grouped into
    Source, Output, Prompt guidance, Edit control, Enhance, and Reference
    images.
  - Replaced the cramped edit-strength number field with a range slider and
    live value chip. Preservation presets still set the underlying strength.
  - Kept the document attach control inside the chat input shell and kept Send
    as the existing right-side action, while preventing the composer from
    collapsing or splitting into awkward rows on desktop.
  - Desktop chat now uses internal sidebar/thread scrolling so the outer page
    does not create a giant blank scroll area.
  - Prompt injection for image requests now distinguishes the user request from
    settings guidance more clearly and tells the image model not to invent
    unrelated objects, outfits, text, logos, or background changes. Edit prompts
    explicitly preserve unmentioned source-image details and existing
    relationships/interactions.
  - Cache-busted `chat.html` to:
    - `styles.css?v=token-chat-ui-polish-20260702`
    - `chat.js?v=token-chat-ui-polish-20260702`
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - `git diff --check`
    - local Playwright desktop/mobile UI screenshot check
    - local Playwright image guidance payload check
    - local Playwright masked edit and upscale payload checks
- 2026-07-02 chat image mask/upscale integration:
  - Verified the updated public API contract now documents:
    - `/api/image/edits` with optional `mask_base64`
    - `/api/image/upscale`
  - Added `Enhance/upscale selected` source mode in chat.
  - Added optional edit mask upload and preview/clear behavior.
  - Masked edit payloads send resized `mask_base64` alongside the resized
    `image_base64`.
  - Added upscale scale/method controls and routed enhance/upscale jobs to
    `/api/image/upscale`.
  - Upscale payloads intentionally do not send creative prompt text.
  - Cache-busted `chat.html` to
    `chat.js?v=token-chat-image-mask-upscale-20260702`.
  - Verification:
    - `node --check chat.js`
    - `node tools/site-contract-tests.mjs`
    - local Playwright masked-edit payload check
    - local Playwright upscale payload check
    - local Playwright layout screenshot check
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
