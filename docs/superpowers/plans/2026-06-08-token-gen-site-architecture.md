# Token Gen Site Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `token-gen.owenonthenet.com` a Cloudflare Access protected app launcher with working Monitor, Chat, and Games pages that consume the token-gen server API.

**Architecture:** The website is static and only consumes `https://token-gen-api.owenonthenet.com`. The token-gen server owns API production, vLLM proxying, telemetry, and discovery. Cloudflare Access handles Google auth and email allowlisting before users reach the static site.

**Tech Stack:** Static HTML/CSS/JavaScript, GitHub Pages deployment, Cloudflare Access, token-gen Python API.

---

### Task 1: Configure Cloudflare Access

**Files:**
- No repo file required unless Cloudflare config is exported later.

- [ ] Create or update a Cloudflare Access application for `https://token-gen.owenonthenet.com/*`.
- [ ] Configure Google as the identity provider if it is not already configured.
- [ ] Add an allow policy with these emails:
  - `jesse@owenonthenet.com`
  - `li-zen@owenonthenet.com`
  - `gusulei@gmail.com`
- [ ] Verify unauthenticated access redirects to Cloudflare Access login.
- [ ] Verify an allowed account can reach the homepage.

### Task 2: Add Frontend Contract Tests

**Files:**
- Create: `tools/site-contract-tests.mjs`

- [ ] Write tests for monitor public status validation, chat model behavior without fallback, and route links.
- [ ] Run the test and verify it fails before implementation.
- [ ] Keep tests runnable with `node tools/site-contract-tests.mjs`.

### Task 3: Homepage Launcher

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Replace monitor-first homepage with an app launcher.
- [ ] Add primary destinations for Monitor, Chat, and Games.
- [ ] Keep `server-monitor.html` as the monitor page.
- [ ] Link Games to the existing vampire survivor game.
- [ ] Verify responsive layout with Playwright or Chromium screenshot checks.

### Task 4: Monitor Public API Renderer

**Files:**
- Modify: `monitor-simple-20260607-token-rates.js`
- Modify: `server-monitor.html`

- [ ] Render every field present in `/api/public-status`.
- [ ] Remove public blank columns for private-only fields such as GPU UUID and driver unless they are present in public data.
- [ ] Remove fallback data behavior.
- [ ] Show a clear API broken state when `/api/health` or `/api/public-status` fails.

### Task 5: Chat API Behavior

**Files:**
- Modify: `chat.js`
- Modify: `chat.html`

- [ ] Remove invalid fallback model behavior.
- [ ] If `/api/chat/models` fails or returns no models, disable chat input and show a clear API error.
- [ ] Use only model IDs returned by `/api/chat/models`.
- [ ] Change web-search unavailable text to say the service is not configured/unavailable.
- [ ] Keep web search disabled when `tavily_configured` is false.

### Task 6: Docs Alignment

**Files:**
- Modify: `AGENTS.md`
- Modify: `CURRENT_STATE.md`
- Modify: `HANDOFF.md`

- [ ] Document that the active API front door is token-gen Python API.
- [ ] Mark the PC Node gateway as dormant/obsolete unless explicitly reintroduced.
- [ ] Document Cloudflare Access protected website ownership and allowlist location.

### Task 7: Verify and Publish

**Files:**
- Modify as needed only for cache-busting query strings in HTML.

- [ ] Run `node tools/site-contract-tests.mjs`.
- [ ] Run live route checks for `/api/health`, `/api/public-status`, `/api/chat/models`, and `/api/web-search/health`.
- [ ] Use browser testing against the local static site.
- [ ] Commit and push to the public Pages repo.
- [ ] Push the same commit to the private mirror remote.
- [ ] Confirm `https://token-gen.owenonthenet.com/` returns `200` after deployment.
