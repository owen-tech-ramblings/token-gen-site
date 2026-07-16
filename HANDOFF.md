# Token Gen Handoff

Last updated: 2026-07-16 Australia/Sydney

## 2026-07-16 Token Gen Stage 6 Handoff

Automatic routing and local Deep Research are live at site commit `02686a8`
through successful Pages workflow `29482216914`, with API commits `c05f6ba`
and `837edba`. Auto classifies each submitted turn once, then keeps that route
stable through context budgeting and dispatch. It can choose local chat,
current web context, deep research, local vision, or image generation; the
explicit Research mode forces the full evidence pipeline and local reasoning.

Research uses Tavily first and private balanced SearXNG after Tavily HTTP 432.
Tavily's plan is currently exhausted, so SearXNG at `100.92.126.107:8888` is
the active provider. Destination pages are fetched through Tor at
`socks5h://100.92.126.107:9050`, extracted with Trafilatura/Readability, ranked
locally, compacted by the local vLLM, and answered by the local vLLM with
citations. Preserve the fail-closed rule: Tor or Proxy must never silently
become Direct, and webpage instructions remain untrusted evidence.

All 62 API tests, site syntax/contracts, plain chat SSE, authenticated private
history/projects/jobs, Tor egress, SearXNG health, model discovery, ComfyUI
health, and a real production research evidence turn pass. Production serves
`token-chat-research-20260716-1`. The six-part extension roadmap is complete;
future work should start from this verified site/API pair rather than an older
Windows source copy.

## 2026-07-16 Token Gen Stage 5 Handoff

The focused image-editing canvas is live at site commit `5e95564` through
successful Pages workflow `29478424261`. It opens from attached source images
or generated outputs and uses the established `/api/image/edits` contract, so
no API deployment was required. Painted areas become a lossless grayscale PNG
mask; existing target-size preparation sends source and mask at matching edit
dimensions.

The editor supports paint, erase, brush size, bounded undo/redo, clear,
keyboard focus containment, Escape, pointer capture, and full-screen mobile
use. A new source always clears the previous mask. JavaScript syntax, site
contracts, real generation and editing interactions, desktop/mobile visual QA,
and authenticated production all pass. Production serves
`token-chat-canvas-20260716-1`; private history and projects remain healthy and
the console is clean. The next roadmap item is Stage 6: automatic routing and
a research mode that should coordinate existing web, project, document, vision,
chat, and image capabilities without requiring routine manual mode selection.

## 2026-07-16 Token Gen Stage 4 Handoff

Persistent background image jobs are live. Site commits `90fef73`, `e3f077d`,
and `cc67f9b` add the queue UI and the same-origin private bridge. API commits
`8b5ba3b` and `0f8c0e9` add the encrypted job store and support the bridge's
forwarded signed Access assertion. Job records are stored separately under
`token_gen_server/private-ai/v1/jobs` using AES-256-GCM over encrypted SMB;
the default retention is 30 days with a 100-job user cap.

The Cloudflare Worker source is in `cloudflare/private-api-bridge`. Its route
must remain exactly `token-gen.owenonthenet.com/api/private/*`, and its resource
allowlist must remain conversations, projects, and jobs. It strips incoming
cookies and authorization, re-presents only the signed site assertion as the
API application's `CF_Authorization` cookie, and forwards the same assertion
for Token Gen's issuer/audience/signature/expiry/email verification. Do not put
an Access token, service token, or bearer token in browser JavaScript.

All 53 API tests and site contracts pass. Authenticated production reports
`Private history ready`, an available project library, an available background
queue, and no browser errors. The next roadmap item is Stage 5, an image edit
canvas that should build on the existing source-image and optional mask API
contracts without changing plain chat behavior.

## 2026-07-16 Token Gen Stage 3 Handoff

Local image understanding is published at site commit `a903d23` through
successful Pages workflow `29472574465`, with API commits `efe7c51` and
`9114736`. Chat accepts up to four PNG, JPEG, or WebP images, automatically
uses the local multimodal model for image questions, and can reuse a generated
image through the Ask about action. Retained assets are encrypted in the
private OWENLABSHARE store and history keeps metadata rather than base64.

The production `Qwen-Qwen3.6-27B-FP8` runtime is healthy at a 131,072-token
context across five vLLM GPUs using pipeline partition `14,14,14,14,8`; ComfyUI
keeps its dedicated sixth GPU. Forty-three API tests, site contracts, encrypted
NAS asset create/read/delete, text and vision inference, responsive browser QA,
an actual browser chat turn, and authenticated production inspection pass.
Production served `token-chat-vision-20260716-1` with no console warnings or
errors. The system vLLM service is enabled for reboot and uses the versioned
launch script; the active verified runtime was started as the transient user
service `vllm-vision-balanced.service` because this session had no sudo access.

## 2026-07-15 Vampire Survival Iteration 42 Handoff

Iteration 42 is published at exact release commit `6e2fbab` through successful
Pages workflow `29409992586`. Its exact archive is
`iteration-42-codex.html` (461,813 bytes; SHA-256
`e591395c1f6efbf71470b48b7e7eb3c00d1b56c283d0b7715e59ab3890df5fe5`).

The dawn transition now uses an embedded generated WebP for an ornate
burgundy, black, gold, and ruby lid, backed by a velvet-lined coffin, detailed
vampire, moonbeams, bats, candles, mist, and a timed sealing pulse. The
four-second transition remains skippable; mobile and app/system reduced-motion
states are verified. Fifty-eight tests, exact contracts, deterministic builds,
desktop/mobile visual review, reduced-motion inspection, and the real Night 1
coffin flow pass. Both remotes contain the release; direct origin matches the
archive, public HTTPS retains its Access 302, and authenticated production
passed with Cloud Save left local-only and no game console errors. Use
Iteration 41 commit `561f3bd` and `iteration-41-codex.html` as the rollback
point.

## 2026-07-15 Vampire Survival Iteration 41 Handoff

Iteration 41 is published at exact release commit `561f3bd` through successful
Pages workflow `29373432079`. Its exact archive is
`iteration-41-codex.html` (218,810 bytes; SHA-256
`1cfea85374e95166362b7dcc0208a773b875e7ad36bc3cb94560e29ecb67306b`).

Basic Hunt is now playable immediately, enters the next unbeaten depth, and
explains its mutator and next ruler before start. Campaign continues to own the
Create Thrall, Mist, Swarm, and Ascension milestones. All player pages have
been rewritten to remove design/requirements language. Title and Campaign
screens isolate the background game surface for assistive technology.
Fifty-eight tests, exact contracts, deterministic builds, responsive/copy/
accessibility browser QA, and the Depth 1-to-2 coffin loop pass. Both remotes
contain the release; direct origin matches the archive, public HTTPS retains
its Access 302, and authenticated production passed the fresh Hunt smoke with
Cloud Save left local-only and no console errors. Use Iteration 40 commit
`540c418` and `iteration-40-codex.html` as the rollback point.

## 2026-07-15 Vampire Survival Iteration 40 Handoff

Iteration 40 is published at exact release commit `540c418` through successful
Pages workflow `29358796611` and completes the Iterations 32-40 roadmap. Its
exact archive is `iteration-40-codex.html` (218,870 bytes; SHA-256
`480c642170cbe2e69599d00e87409a84e0059782a7e8df2a159796cdab7fafb4`).

The final pass adds complete controller menu/gameplay support, strict modal
isolation and focus containment, 44/48px targets, visible focus, system/app
reduced motion, high contrast verification, local cloud-size preflight, and a
safe backend 413 path. All 58 tests, exact contracts, deterministic builds,
responsive/accessibility QA, deep Hunt/Campaign routes, entity caps, and the
performance gate pass. The exact backend is active; authenticated normal and
oversize canaries passed and cleaned up. Both remotes contain the release,
direct origin matches the archive, public HTTPS retains its Access 302, and
authenticated production passed the final non-mutating smoke with no fresh
console errors. Treat this as the rollback point for a new playtest-led roadmap.

## 2026-07-15 Vampire Survival Iteration 39 Handoff

Iteration 39 is published and exact-origin verified at commit `77bb6d5` through
Pages workflow `29356836011`. Its exact archive is
`iteration-39-codex.html` (213,850 bytes; SHA-256
`f2402e9ae59168bba543a7924f933b11390917ea48c0891dfc50c388f7a9fb41`).

Cloud Save is optional and local-first. The client never accepts a typed email;
the backend verifies the Cloudflare Access assertion and stores only a keyed
identity hash. ETag/`If-Match`, idempotency, atomic writes, explicit conflict
choices, offline replay, export, recovery, and cloud-only deletion are covered
by automated and browser tests. The dedicated save hostname passed a disposable
authenticated Hostinger/Access CRUD canary and was cleaned afterward. Fifty-one
tests, exact contracts, deterministic builds, responsive conflict QA, gameplay
smoke, and performance evidence pass. Both remotes contain the release, direct
origin matches the archive, public HTTPS retains its Access 302, and production
confirmed the empty cloud state without creating a remote profile. Continue
directly through Iteration 40 hardening.

## 2026-07-15 Vampire Survival Iteration 38 Handoff

Iteration 38 is published and exact-origin verified at commit `8c08107` through
Pages workflow `29352718906`. Its exact archive is
`iteration-38-codex.html` (194,447 bytes; SHA-256
`5ccc09d85ac522fd9e0f636672ca5e2d198e77da6a685ba90bce28752ddb38b0`).

Campaign now spans Nights 1-15 and ends with Archon Sol, a committed ending,
and Ascension. All Bloodline paths contain seven nodes. Endless Hunt rotates
three mutators and milestone bosses every five depths. Forty-one tests, 15
route checks, deterministic builds, exact contracts, responsive browser QA,
and the accepted performance gate pass. Both remotes contain the release;
direct origin matches the archive and public HTTPS retains its Access 302.
Verify the server identity boundary before changing cloud persistence in
Iteration 39.

## 2026-07-15 Vampire Survival Iteration 37 Handoff

Iteration 37 is published and exact-origin verified at commit `99ef258` through
Pages workflow `29351419995`. The exact archive is
`iteration-37-codex.html` (182,897 bytes; SHA-256
`560e9abfa223188547e2a7c3a8bd38be7b3f7592eb4121932a60e78de7460d2e`).

Chapter II adds Nights 6-10, Bell Keepers, Elowen, the atomic Swarm unlock,
six Bloodline nodes, and deep-Hunt composition. All 39 tests, ten route checks,
responsive QA, exact archive contracts, and performance evidence pass. Both
remotes contain the release and Access retains its 302. Continue to Iteration 38.

## 2026-07-15 Vampire Survival Iteration 36 Handoff

Iteration 36 is published and exact-origin verified from canonical commit
`806e110` through successful Pages workflow `29350408386`.
Its exact archive is `games/vampire-survival-iterations/iteration-36-codex.html`
(175,359 bytes; SHA-256
`b460366aacc7d1e63b1774943081ff57c862787255a8954bd20a4c026075d09e`).

The release adds the two-slot coffin loadout and Create Thrall. Unlock authority
comes from immutable Campaign clears, target ties use stable IDs, conversion and
active counts are bounded, and every exit uses centralized cleanup. Thirty-eight
tests, exact archive contracts, responsive browser QA, and the performance gate
pass. Both remotes contain the release, the Pages-origin digest matches, and
the public route retains the expected Access 302. Continue directly to
Iteration 37 Chapter II and Swarm.

## 2026-07-15 Vampire Survival Iteration 35 Handoff

Iteration 35 is implemented, published, and exact-origin verified in the
canonical Pages repo at release commit `d59a907`.

- Bloodline definitions, validation, transactions, and run-stat derivation are
  in `games/vampire-survival-src/profile.mjs`.
- Nine v1 nodes form three linear prerequisite paths. All are optional for the
  validated Chapter I base-stat route.
- Purchase debits, Undo refunds, and respec refunds are distinct immutable
  economy events. Active allocation/purchase records must agree exactly, and
  the saved counter plus latest-purchase pointer prevent duplicate identities.
- `world.mjs` derives a fresh stat object from the saved allocation at each run
  start. Never mutate `BASE_RUN_STATS` or node definitions.
- The coffin opens `bloodlineModal`; desktop uses three columns and narrow
  layouts use the three accessible branch tabs plus a vertical path.
- Exact candidate/archive: 158,067 bytes, SHA-256
  `0a8977e35c21225b11e46dfd5b94e3793470dc2017e6790a17092696587ddab9`.
- Local gate: 36 tests, site contracts, syntax, deterministic build,
  transaction/save-failure flows, responsive browser QA, next-run derivation,
  and bounded Hunt soaks.
- Evidence:
  `games/vampire-survival-iterations/iteration-35-test-report.md`.
- GitHub Pages build `1095252135` completed for exact commit `d59a907`. Direct
  origin returned the exact 158,067-byte archive hash; unauthenticated HTTPS
  returned the expected Access 302.
- The authenticated Windows helper remained unavailable, so the release did
  not attempt unsafe foreground automation or a broad Chrome cookie copy. No
  production profile or Cloudflare state changed.

Next after publication: Iteration 36 loadout slots, cooldown tuning, and Create
Thrall with visible cast/cooldown/targeting feedback.

## 2026-07-15 Vampire Survival Iteration 34 Handoff

Iteration 34 is implemented, published, and exact-origin verified in the
canonical Pages repo at gameplay/QA commit `dbf837f`.

- Chapter I contracts live in `games/vampire-survival-src/progression.mjs`;
  gameplay enforces required crosses and lieutenants before dawn, then Voss as
  a distinct Night 5 post-dawn phase.
- Objective bosses and lieutenants are protected from entity-cap trimming.
- A recorded Night 5 clear is the authority for Mist and full Hunt. The clear,
  one-time Blood Pack, unlock events, and coffin result commit together.
- Full Hunt has fixed selected night length, approved cross cadence
  `3,3,4,4,4,5,5,6,6,6...`, and bounded open-ended pressure scaling.
- Exact candidate/archive: 137,476 bytes, SHA-256
  `442cff973527cdbbafecb05e861720448d5b05648eea45199ba078ff76656f45`.
- Local gate: 32 tests, site contracts, module syntax, deterministic build,
  campaign/Voss/coffin/Hunt browser flows, responsive checks, and a three-minute
  108-enemy soak.
- Evidence:
  `games/vampire-survival-iterations/iteration-34-test-report.md`.
- GitHub Pages build `1095212527` completed for exact commit `dbf837f`. Direct
  origin returned the exact 137,476-byte archive hash; unauthenticated HTTPS
  returned the expected Access 302.
- The Windows-control helper lacked required sandbox context, and Chrome's
  app-bound cookie encryption prevented a safely scoped headless cookie import
  while the real browser remained open. No protected profile or Cloudflare
  state was changed. Repeat the authenticated smoke when that helper is
  available; the exact-origin and full local browser gates passed.

Next after publication: Iteration 35 Bloodline v1 with three branches, atomic
purchases, one-step undo, and free respec in the coffin hub.

## 2026-07-15 Vampire Survival Iteration 33 Handoff

Iteration 33 is implemented, published, and authenticated-production verified
in the canonical source at
`/home/jesse/.openclaw/workspace/token-gen-site-pages`. The final
gameplay commit is `5b1fe99`.

- Edit modular files in `games/vampire-survival-src/`; regenerate the
  standalone file and archive with
  `node tools/build-vampire-survival.mjs --archive`.
- Campaign Night 1 and Hunt Depths 1-2 are authored in
  `games/vampire-survival-src/progression.mjs`.
- All three current contracts use the selected difficulty's fixed dawn timer.
  Hunt Depth 2 raises composition, pressure, elite frequency, health, and
  damage while retaining three crosses. Iteration 34 starts the approved
  spaced quota cadence `3,3,4,4,4,5,5,6,6,6...`.
- Campaign clear event `campaign:night-01:first-clear` is immutable
  and awards one Blood Pack once. Run result, first-clear reward, Night 2
  unlock, and the pending coffin outcome save in one profile commit before the
  animation.
- A failed commit remains on the result screen. A committed pending coffin
  outcome survives reload and must be acknowledged before Rise/Leave clears
  it.
- The normal coffin transition is four seconds and skippable; reduced motion
  uses a 650 ms settled state. The hub restores Blood and cooldowns and is the
  designated home of the future Bloodline tree.
- The exact Iteration 33 candidate and archive are 128,322 bytes with SHA-256
  `bb0fc35cb5a7bf8c9dbd1477abf46677c3dfc54e6da195ff08de7f611f0239db`.
- Local evidence passed: 30 Node tests, site contracts, module syntax,
  deterministic double-build, `git diff --check`,
  Campaign/Hunt browser flows, atomic-save failure, reload continuation,
  reduced motion, responsive layouts, 40 route checks, and a 180-second
  108-enemy soak.
- Detailed evidence is in
  `games/vampire-survival-iterations/iteration-33-test-report.md`.
- GitHub Pages build `1095141113` completed for exact commit
  `5b1fe99`. Direct origin returned 128,322 bytes with the exact
  archive hash, while unauthenticated HTTPS returned the expected Cloudflare
  Access 302.
- The existing authenticated Windows Chrome session loaded the protected final
  build and passed Campaign map → Night 1 → three-cross test clear → coffin
  transition → first-clear/restoration hub → Rise → Night 2 unlocked. The
  protected browser was returned to the title screen.

Next iteration: Chapter I Nights 2-5, Voss as the first milestone boss, the
one-time Mist unlock, and full escalating Hunt with the approved quota cadence.
Iteration 34 may begin.

## 2026-07-14 Vampire Survival Iteration 32 Handoff

Iteration 32 is implemented, locally verified, and published at commit
`abf7cd3`. The canonical source is
`/home/jesse/.openclaw/workspace/token-gen-site-pages`.

- Edit files in `games/vampire-survival-src/`, not the generated live HTML.
- Build and archive with:
  `node tools/build-vampire-survival.mjs --archive`.
- Verify generated output with:
  `node tools/build-vampire-survival.mjs --check`.
- Run profile/content tests with:
  `node --test tools/vampire-survival-profile.test.mjs`.
- Run the shared contract suite with:
  `node tools/site-contract-tests.mjs`.
- Iteration 32 archive SHA-256:
  `0e058d4c0dccf3d63ccaf29371e42846ef8173b5e74ac1cc18d1dea73b36e3dd`.
- The v2 local profile key is `vampire_survival_profile_v2`; retain
  `vampire_survival_profile_v31` for migration and
  `vampire_survival_profile_v2_recovery` for corrupt-save recovery.
- Supported browsers acquire an exclusive profile writer lease before any
  mutating load or save. Browsers without Web Locks show a single-tab-only
  warning; do not claim cross-tab serialization for that fallback.
- Losing the lease pauses/freezes an active run and disables resume until a
  fresh lease is held. Any profile load diagnosed as volatile blocks play.
- Full gamepad gameplay polling remains and keyboard dialog focus is now
  contained/restored. Full gamepad focus navigation for the menu and future
  coffin/Bloodline/loadout surfaces is deliberately not claimed yet.
- Iteration 32 is pushed and its authenticated public gameplay canary passed;
  Iteration 33 may begin.
- GitHub Pages reported commit `abf7cd3` built. A direct origin request returned
  101,657 bytes with the exact archive hash, and the public hostname returned
  the expected Cloudflare Access login redirect. An allowed Hostinger identity
  then loaded the protected game in Windows Chrome, began a live Night run,
  advanced the HUD to 19 seconds with enemies active and `Crosses 0/3`, and
  returned to the title screen.

Next iteration: Campaign Night 1, the atomic clear state, fixed-duration cross
contract, the skippable/reduced-motion coffin transition, coffin restoration
hub, and a two-depth Hunt preview. See
`games/vampire-survival-iterations/iterations-32-40-roadmap.md`.

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
