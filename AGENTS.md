# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

## Repository contract

- Canonical root: `/home/jesse/.openclaw/workspace/token-gen-site-pages`
- Canonical remote:
  `https://github.com/owen-tech-ramblings/token-gen-site.git`
- Release branch: `master`
- Integration branch: `dev`
- Expected GitHub identity: `owen-tech-ramblings`, using
  `/home/jesse/.config/gh`
- Approved secret locators: GSM project `lil-zen-oc` and `D:\openclaw`
  (`/mnt/d/openclaw` in WSL) only. Browser source must contain no secret.
- Branch and review flow: keep only `master` and `dev` as permanent branches.
  Use the receipt-bound managed-worktree tool from the released Lil Zen control
  plane to create a temporary `codex/*` branch from current `origin/dev`, push
  it immediately, pass every required check and exact-commit GitHub review,
  and merge its pull request into `dev`. Promote `dev` to `master` only through
  a reviewed release pull request. GitHub automatically deletes the temporary
  branch after merge; explicitly abandoned work is deleted immediately.
  At stable rest, `master` and `dev` identify the same released commit, the
  canonical root is clean on `master` at `origin/master`, and no dirty,
  unmerged, or additional local or remote branch remains.
- Complete check command: `npm test`
  It is the sole aggregate check and must run unchanged in exact-commit
  `quality / site` GitHub CI for `dev` and
  `master`, plus feature-specific browser checks from a local static server. The
  legacy `services/` examples are not production sources and are not an
  alternative to the canonical `token-gen-api` suite.
- Live deployment path: GitHub Pages legacy deployment from the repository
  root of `master`, serving `https://token-gen.owenonthenet.com` through the
  checked-in `CNAME`. A release is complete only when the latest Pages build
  names the exact reviewed commit and the protected public routes pass.
- Release path: pass the `token-gen-site` ecosystem release gate, promote the
  exact fetched `origin/master` commit through the rollback-protected site
  release transaction, verify the immutable release, GitHub Pages build, live
  asset digests and public API integration, and then mirror the source to the
  Windows copy when required.
- Rollback path: restore the prior immutable site release and prior Pages
  commit through a reviewed revert or corrective pull request, wait for the
  exact Pages rebuild, and repeat the same live checks.
- Forbidden actions: direct pushes to `master`, bypassing `quality / site`,
  using `dev` as a release or deployment authority, unleased or non-`codex/*`
  feature worktrees, long-lived temporary branches, direct live edits,
  global GitHub-auth switching, repository-local secrets, deployment from the
  Windows mirror, PC-hosted production API/search dependencies, silent
  fallbacks, or a release record that does not match the Pages commit.

## Shared Codex Context

Before changing this repo, read:

- `TOKEN_GEN_SOURCE_OF_TRUTH.md`
- `AGENTS.md`
- `CURRENT_STATE.md`
- `HANDOFF.md`

After changing this repo, update `CURRENT_STATE.md` and `HANDOFF.md` with:

- what changed
- what was verified
- exact commands or URLs checked
- known remaining failures

These files are the shared context between Codex CLI sessions working on the
Token Gen site and API. Do not rely on chat memory as the source of truth.

`TOKEN_GEN_SOURCE_OF_TRUTH.md` is the routing authority. If it conflicts with
`CURRENT_STATE.md`, `HANDOFF.md`, older plans, or a local gateway route, stop
and verify the live API before editing.

## Product boundaries

This repository owns only the browser/site side:

- static site files for `https://token-gen.owenonthenet.com`
- monitor and chat page rendering
- browser-safe API consumption
- Cloudflare Access website protection coordination
- UI states for loading, degraded API responses, and errors
- frontend Playwright/browser verification
- cache-busting static assets when needed

The API and server-side SearXNG source is the separate canonical
`token-gen-api` repository. Any Codex or Codex CLI instance may build either
product, but it must use that product's current receipt-bound managed worktree,
repository instructions, review, release and rollback path. Machine location
does not create ownership. Never patch the Token Gen server runtime directly
or work around missing API behaviour by inventing browser data.

## Architecture Rules

- `https://token-gen.owenonthenet.com` is the static site.
- `https://token-gen.owenonthenet.com/*` should be protected by Cloudflare Access.
- Cloudflare Access allowlist should target `jesse@owenonthenet.com`,
  `li-zen@owenonthenet.com`, and `gusulei@gmail.com`.
- `https://token-gen-api.owenonthenet.com` routes to the token-gen server API.
- The active public API is released from the canonical `token-gen-api`
  repository and installed on the Token Gen server by its versioned installer.
- The token-gen server API must expose both monitor and chat routes.
- Browser JavaScript must never include `SERVER_DETAILS_TOKEN` or other secrets.
- The monitor page uses public API routes only.
- The chat page uses the chat and web-search routes exposed by the token-gen API.
- The PC-side Node API proxy is dormant/obsolete unless deliberately
  reintroduced for a specific future feature.

Before changing API behaviour, switch to the canonical `token-gen-api`
repository and run its complete governed preflight. For read-only integration
verification from this repository, check:

```bash
curl -fsS https://token-gen-api.owenonthenet.com/api/agent.json
curl -fsS https://token-gen-api.owenonthenet.com/api/web-search/health
```

Do not infer the live runtime from local files. Do not repoint Cloudflare or
route production chat, search, Tor or page retrieval through a development PC.

Required public API routes:

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

Before committing, in the receipt-bound managed worktree:

1. Verify the root with `git rev-parse --show-toplevel`.
2. Verify the remote with `git remote -v`.
3. Review `git status --short`.

Expected remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

Related paths:

- Windows source mirror: `/mnt/c/Users/User/Documents/New project/token-gen-site`
- Canonical API source: `/home/jesse/.openclaw/workspace/token-gen-api`
- Deployed local integration proxy source: the Lil Zen control plane; its live
  path is not an authoring repository

Commit and push public-site changes only from the managed worktree created for
this repository. The Windows source copy is a non-authoritative mirror and may
never become the deploy source.
