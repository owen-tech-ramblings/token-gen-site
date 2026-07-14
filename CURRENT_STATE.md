# Token Gen Current State

Last updated: 2026-07-15 Australia/Sydney

## Vampire Survival Iteration 38 - 2026-07-15

- Iteration 38 completed the 15-night Campaign. Nights 11-15 introduce mixed
  endgame encounters and culminate in Archon Sol's separate post-dawn phase.
- The first Sol victory commits one finite reward, the ending, and Ascension
  before presentation. Replays cannot duplicate the ending or Blood Pack.
- Bloodline now has seven chained nodes per branch (21 total). Hunt rotates
  Blood Famine, Silver Rain, and Swift Hunters and stages milestone bosses at
  every fifth depth.
- All normal-night lengths remain fixed. The five new routes are unique,
  collision-free, and use at most 12.9% of the base travel budget.
- Validation: 41/41 tests, exact archive contracts, deterministic 194,447-byte
  artifact, responsive Chromium finale/endgame QA, and a 175 ms accepted p95
  versus the archived release's 205 ms under the same warmed harness.
- Release candidate SHA-256:
  `5ccc09d85ac522fd9e0f636672ca5e2d198e77da6a685ba90bce28752ddb38b0`.
- Next: publish Iteration 38, then verify the API/Access boundary before
  implementing Iteration 39 cloud identity and saves.

## Vampire Survival Iteration 37 - 2026-07-15

- Iteration 37 is published and exact-origin verified at commit `99ef258`
  through Pages workflow `29351419995`.
- Campaign now contains Nights 1-10. Nights 6-10 add Bell Keepers, four authored
  objective nights, and Sister Elowen in a separate Night 10 dawn phase.
- Elowen uses timing zones, radial peals, charge lanes, and summons; her first
  defeat atomically unlocks Swarm exactly once.
- Bloodline now has five nodes per branch (15 total). Deep Hunt includes the
  Chapter II enemy family while keeping the established fixed timer/quota.
- Validation: 39/39 tests, ten collision-free routes, exact contracts,
  responsive Chromium QA, zero console errors, 182,897 bytes, SHA-256
  `560e9abfa223188547e2a7c3a8bd38be7b3f7592eb4121932a60e78de7460d2e`.
- Next: Iteration 38 Chapter III, ending, and endgame.

## Vampire Survival Iteration 36 - 2026-07-15

- Iteration 36 is published and exact-origin verified from the canonical Pages
  repo at commit `806e110` (Pages workflow `29350408386`).
- The coffin now owns a two-slot talent loadout. Create Thrall unlocks from the
  authoritative Night 1 clear; Mist and Swarm retain Nights 5 and 10 authority.
- Create Thrall is deterministic and bounded: one conversion, three active
  thralls, stable-ID ties, 0.35-second retarget cadence, 28-second lifetime, and
  centralized cleanup/refund at run boundaries.
- All ability tiles and touch actions expose the highest-priority blocker and
  synchronize numeric cooldown/fill state with gameplay.
- Validation: 38/38 tests, site contracts, desktop/mobile Chromium QA, zero
  console errors, deterministic 175,359-byte artifact, SHA-256
  `b460366aacc7d1e63b1774943081ff57c862787255a8954bd20a4c026075d09e`.
- Performance accepted p95 increased 3.8% versus the archived Iteration 35
  baseline, below the 10% blocker.
- Next: Iteration 37 Chapter II, expanded Bloodline, and Swarm.

## Vampire Survival Iteration 35 - 2026-07-15

- Bloodline v1 now lives in the coffin with Crimson Hunger, Moonstride, and
  Nightborn Arts, each containing three prerequisite-linked nodes.
- Every node shows cost, rank, prerequisite state, concise flavor, and current
  versus next effect. Desktop shows three branches; 375x812 uses fitting tabs
  and one vertically scrollable path without horizontal overflow.
- Purchases debit the immutable economy ledger atomically. One-step Undo adds
  an exact compensating refund; free respec refunds every active node. Invalid,
  duplicate, orphaned, and stale transaction states are rejected.
- Run stats derive from a copy of frozen base definitions at night start. A
  coffin purchase never mutates the finished run; Crimson Reservoir changed
  the next run from 112 to 124 maximum Blood in browser QA.
- Verification passed: 36 Node tests, shared contracts, all module syntax,
  deterministic double-build, exact archive equality, desktop/mobile Bloodline
  flows, failed-save currency safety, and three 180-second cap soaks.
- Published artifact: 158,067 bytes, SHA-256
  `0a8977e35c21225b11e46dfd5b94e3793470dc2017e6790a17092696587ddab9`.
- Release commit `d59a907` is on both remotes. GitHub Pages build `1095252135`
  completed for the exact commit; direct origin returned the exact archive and
  the public hostname retained its expected Access 302.
- The authenticated Windows helper remained unavailable. No broad cookie copy
  or foreground automation was used; production profile and Cloudflare state
  were not changed.
- Detailed evidence:
  `games/vampire-survival-iterations/iteration-35-test-report.md`.

## Vampire Survival Iteration 34 - 2026-07-15

- Chapter I Nights 1-5 are implemented with distinct objectives,
  lieutenants, composition, map presentation, and fixed selected night length.
- Night 5 enters a separate post-dawn Captain Voss phase. His first defeat
  atomically grants one Blood Pack, Mist, and full Hunt; forged unlock fields
  and old pending coffin outcomes cannot bypass the clear requirement.
- Full Hunt stays open-ended. Its cross quotas follow
  `3,3,4,4,4,5,5,6,6,6...`, while bounded pressure, elites, health, damage,
  hunters, guards, and score multipliers continue to rise with depth.
- Review fixed objective-enemy removal at the entity cap, locked-Hunt bypass,
  stale post-dawn HUD data, and desktop/mobile boss-message overlap.
- Local verification passed: 32 Node tests, shared contracts, all module syntax,
  deterministic double-build, exact archive equality, browser Night 2 failure,
  Voss milestone/coffin flow, deep Hunt route checks, responsive layouts, and a
  180-second 108-enemy soak.
- Published artifact: 137,476 bytes, SHA-256
  `442cff973527cdbbafecb05e861720448d5b05648eea45199ba078ff76656f45`.
- Gameplay/QA commit `dbf837f` is on both remotes. GitHub Pages build
  `1095212527` completed for the exact commit; direct origin returned the exact
  artifact and the public hostname returned the expected Access 302.
- The authenticated Windows helper was unavailable for the protected-session
  smoke. App-bound Chrome cookies were not copied or exposed; the release used
  exact-origin proof plus the full generated-artifact browser gate instead.
- Detailed evidence:
  `games/vampire-survival-iterations/iteration-34-test-report.md`.

## Vampire Survival Iteration 33 - 2026-07-15

- Iteration 33 was published from the canonical Pages repo at final gameplay
  commit `5b1fe99` on 2026-07-15. It adds Campaign Night 1, a
  two-depth Hunt preview, and the full survived-night coffin loop.
- Campaign Night 1 starts with Feed and Dash. Mist is visibly locked behind
  the Night 5 boss and Swarm behind the Night 10 boss.
- Every run now uses an authored objective contract. Night length remains fixed
  for the selected difficulty while Hunt Depth 2 raises patrol count, director
  pressure, elites, enemy health, and damage. The broader Hunt quota cadence
  begins in Iteration 34.
- Dawn with crosses remaining produces a specific failure. A successful clear
  is committed atomically before the coffin appears; the first Campaign clear
  awards exactly one Blood Pack and replays cannot duplicate it.
- The vampire hops into an open coffin, the lid closes, Blood and cooldowns
  restore, and a compact coffin hub shows rewards, progression, and the next
  choice. The transition is skippable and has a short reduced-motion path.
- The coffin now owns the permanent-progression location. Iteration 33 shows
  the Bloodline entry point; the purchasable three-branch tree remains
  deliberately scheduled for Iteration 35 after Chapter I.
- A pending coffin result survives reload and can be resumed from the title
  screen. A failed clear save shows `Progress Not Saved` and never
  bypasses into the coffin.
- Verification: 30/30 Node tests, shared site contracts, syntax and
  deterministic build checks, exact live/archive equality, browser Campaign
  and Hunt flows, save-failure and reload recovery, reduced motion, desktop and
  mobile layouts, 40 cross-route generations, and a three-minute 108-enemy
  soak.
- The direct production origin returned the exact 128,322-byte artifact with
  SHA-256
  `bb0fc35cb5a7bf8c9dbd1477abf46677c3dfc54e6da195ff08de7f611f0239db`.
- GitHub Pages build `1095141113` completed successfully for exact
  commit `5b1fe99`. The unauthenticated HTTPS route returns the
  expected Cloudflare Access 302.
- The authenticated production canary passed through the Campaign map, live
  Night 1 HUD, three-cross objective, locked Mist/Swarm states, safe
  `?test=1` clear, coffin transition, first-clear reward, restoration
  hub, Rise action, and Night 2 unlocked/coming-soon map state. The browser was
  returned to the title screen. Iteration 34 is unblocked.
- Detailed evidence:
  `games/vampire-survival-iterations/iteration-33-test-report.md`.

## Vampire Survival Iteration 32 - 2026-07-14

- Iteration 32 was published from the canonical Pages repo at commit `abf7cd3`
  on 2026-07-14. GitHub Pages reported that exact commit built successfully.
- The standalone game is now generated from modular vanilla-JS source in
  `games/vampire-survival-src/`; the exact generated artifact is archived as
  `games/vampire-survival-iterations/iteration-32-codex.html`.
- Profile schema v2 adds revision-checked local transactions, Campaign,
  Bloodline, Hunt, unlock, settings, achievement, score, and idempotent economy
  scaffolding while preserving the current Iteration 31 play path.
- v31 saves migrate once, with fingerprint/snapshot reconciliation if progress
  is later earned during an Iteration 31 rollback. Malformed v2 values are
  copied exactly to recovery before a safe active fallback is installed.
- Player-facing build/development language and the injected Skybridge font
  override were removed. The objective is consistently described as warding
  crosses.
- Review fixed rollback/corrupt-save/cross-tab loss paths, serialized supported
  browser tabs behind an exclusive writer lease, and made pre-lease loading
  read-only. It also fixed the inherited enemy-cap loop, mobile action ordering,
  keyboard shortcut ownership, dialog focus, score retention, and cross-quota
  coupling.
- Verification: 26 Node profile/content tests, site contracts, deterministic
  build/archive hash, `git diff --check`, and real-browser gameplay,
  migration, responsive, settings, pause, writer-lease lifecycle, audio/save
  failure recovery, performance, and 108-entity soak checks.
- Roadmap: `games/vampire-survival-iterations/iterations-32-40-roadmap.md`.
- Detailed evidence:
  `games/vampire-survival-iterations/iteration-32-test-report.md`.
- Post-deploy origin verification returned the exact 101,657-byte release file
  and SHA-256 `0e058d4c0dccf3d63ccaf29371e42846ef8173b5e74ac1cc18d1dea73b36e3dd`.
  Cloudflare Access returns the expected protected-login redirect. The final
  authenticated gameplay canary passed on 2026-07-14: an allowed Hostinger
  identity loaded the protected production page, began a Night run, advanced
  the live HUD to 19 seconds with active enemies and a `0/3` cross objective,
  and returned to the title screen. Iteration 33 is unblocked.

## Current Chat System Prompt - 2026-07-13

- Replaced the original two-sentence, text-only default with a capability-aware
  prompt for the current Token Gen chat.
- The prompt now covers document context, Tavily/SearXNG web evidence and
  citations, image generation/edit/restyle/style-reference/mask/upscale flows,
  reasoning mode, self-hosted inference, request-scoped Tavily keys, prompt
  injection resistance, honest tool boundaries, and response quality.
- The prompt remains visible and editable in the chat sidebar.
- Site contract tests prevent regression to the original prompt and require the
  main capability and privacy sections.

## Web Search Failover - 2026-07-13

- The public provider chain is now:
  - session-only user Tavily key
  - site Tavily key
  - balanced SearXNG after Tavily HTTP 432
- The optional Tavily key input is a password field, is never written to
  localStorage, and is sent only inside the current chat request.
- Local SearXNG 2026.7.12 runs on `127.0.0.1:8888` and is shared with the Token
  Gen server only through Tailscale Serve at `100.92.126.107:8888`.
- The active Token Gen server source and discovery contract now accept the
  request-scoped key and implement the same fallback order.
- Verification passes:
  - 8 Python unit tests
  - `node --check chat.js`
  - `node tools/site-contract-tests.mjs`
  - `node --check` for the PC gateway
  - 11 Token Gen server unit tests
  - public health reports `searxng_available: true`
  - public streaming chat returned a SearXNG `web_context` event with
    `fallback_reason: tavily_plan_exhausted` followed by model output

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

- 2026-07-03 update:
  - Fixed image prompts leaking machine-readable scaffold text into generated
    images. Jesse provided an output that rendered browser chrome, settings
    labels, `Quality.max`, `Creativity...0.80`, `API edit preservation`, and a
    blank bordered white rectangle inside the image.
  - Root cause: `buildStyledImagePrompt` included headings and key/value API
    control text such as `USER IMAGE REQUEST`, `IMAGE SETTINGS GUIDANCE`, and
    `API controls: quality=...`, which the image model could interpret as
    visual subject matter.
  - Image prompts are now natural-language art direction only. API controls are
    still sent as JSON fields, but not described as literal labels inside the
    prompt text.
  - Shared negative prompts now explicitly discourage browser chrome, web pages,
    screenshots, UI/control panels, labels, blank white rectangles, borders,
    frames, and matte artifacts.
  - Current chat assets:
    - `styles.css?v=token-chat-image-prompt-clean-20260703`
    - `chat.js?v=token-chat-image-prompt-clean-20260703`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, local Playwright restyle/edit/generation payload
    checks proving scaffold text is absent, and existing masked edit/upscale
    plus UI checks.
- 2026-07-02 update:
  - Added a dedicated uploaded-image `Restyle source image` mode for workflows
    such as converting an uploaded image to pencil drawing, Van Gogh, comic,
    manga, etc.
  - Root cause: normal `Edit source image` mode correctly used strict
    preservation and low denoise for localized edits, but that fought full-image
    style transfer. Restyle mode now uses the edit API with stronger defaults
    (`flexible` preservation and `0.65` strength/denoise) while preserving
    composition, identity, pose, hand placement, and object layout.
  - Selecting a style preset while a source image is loaded and Source is still
    `Edit source image` automatically switches to `Restyle source image`.
  - Current chat assets:
    - `styles.css?v=token-chat-image-restyle-20260702`
    - `chat.js?v=token-chat-image-restyle-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, local Playwright uploaded-image restyle payload check,
    normal edit payload checks, masked edit/upscale checks, generation API
    controls check, and desktop/mobile UI checks.
- 2026-07-02 update:
  - Reviewed the live public image model contract at
    `https://token-gen-api.owenonthenet.com/api/image/models`.
  - The chat image UI now supports the newly documented API controls:
    - `quality` including `max`
    - numeric `creativity`
    - `content_rating` values `kid`, `teen`, `standard`, `adult_ok`
    - edit `preservation` values `strict`, `balanced`, `flexible`
    - `sampler_name`
    - `scheduler`
  - Image generation and edit payloads now send these fields directly to the
    API instead of relying only on prompt text. Prompt guidance also names the
    API control values for transparency.
  - Current chat assets:
    - `styles.css?v=token-chat-image-api-controls-20260702`
    - `chat.js?v=token-chat-image-api-controls-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, local Playwright UI desktop/mobile screenshots,
    generation payload checks, edit payload checks, masked edit/upscale checks,
    upload click, and large JPEG upload checks.
- 2026-07-02 update:
  - Reworked the chat upload triggers to avoid label-wrapped hidden file inputs,
    because Jesse reported the page still disappeared when pressing the upload
    button.
  - Source image, mask image, and document attach now use explicit buttons with
    standalone hidden file inputs opened by click handlers. This keeps the UI
    looking the same while avoiding a brittle embedded-browser file input
    activation path.
  - Current chat assets:
    - `styles.css?v=token-chat-upload-button-20260702`
    - `chat.js?v=token-chat-upload-button-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, local Playwright upload-button click test, local
    Playwright large JPEG upload test, and existing local Playwright image
    payload/layout checks.
- 2026-07-02 update:
  - Fixed a blank/stalled chat screen risk after uploading larger PNG/JPG
    source images.
  - Root cause: uploaded image previews reused the full base64 data URL, which
    injected the entire image payload into the DOM. A 5.6 MB JPEG made the
    rendered page HTML grow to about 7.5 MB before this fix.
  - Uploaded source/mask previews now use lightweight `URL.createObjectURL`
    blob URLs, while the base64 data URL remains only in JS state for API
    payloads.
  - Replaced/cleared uploaded preview object URLs are revoked to avoid leaking
    browser memory.
  - Current chat asset:
    - `chat.js?v=token-chat-upload-preview-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, a local Playwright reproduction using
    `C:\Users\User\Downloads\image0.jpeg`, and the existing local Playwright
    UI/image payload checks.
- 2026-07-02 update:
  - Chat image settings have been polished into clear sections instead of a
    long mixed control grid:
    - Source
    - Output
    - Prompt guidance
    - Edit control
    - Enhance
    - Reference images
  - Edit strength is now a slider with a live value chip, and preservation
    presets still update the slider value.
  - The bottom chat composer is kept as one stable row on desktop, with the
    attach button inside the input shell and Send left in its original position.
  - Desktop chat layout now uses internal sidebar/thread scrolling to avoid the
    large blank outer-page scroll seen in browser screenshots.
  - Image prompt guidance was tightened so settings are treated as execution
    guidance and do not invent unrelated objects, outfits, logos, text, or
    background changes. Edit prompts explicitly preserve unmentioned parts of
    the source image and existing physical relationships/interactions.
  - Current chat assets:
    - `styles.css?v=token-chat-ui-polish-20260702`
    - `chat.js?v=token-chat-ui-polish-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    `git diff --check`, local Playwright UI screenshots for desktop/mobile,
    and local Playwright payload checks for image guidance, masks, and upscale.
- 2026-07-02 update:
  - The site now consumes the updated image API contract:
    - `/api/image/edits` with optional `mask_base64`
    - `/api/image/upscale` for deterministic, non-creative enhance/upscale
  - Chat image source mode now includes `Enhance/upscale selected`.
  - Image settings now include upscale scale and method controls.
  - Edit mode now supports an optional uploaded PNG/JPG mask. The UI explains
    that white/light mask areas change and black/dark mask areas are preserved.
  - Mask images are resized in-browser to the selected output dimensions before
    being sent as `mask_base64`.
  - Upscale/enhance requests send the selected source image to
    `/api/image/upscale` without creative prompt text, using configured
    `scale`, `width`, `height`, and `method`.
  - Current chat asset:
    - `chat.js?v=token-chat-image-mask-upscale-20260702`
  - Verified with `node --check chat.js`, `node tools/site-contract-tests.mjs`,
    local Playwright payload checks for masked edit and upscale requests, and
    a local Playwright layout screenshot check.
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
