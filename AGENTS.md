# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

## Repository contract

- Canonical root: `/home/zenfree/token-gen-site`
- Canonical remote:
  `https://github.com/owen-tech-ramblings/token-gen-site.git`
- Release branch: `master`
- Integration branch: `dev`
- Expected GitHub identity: `owen-tech-ramblings`.
- Browser source must contain no secret. The static-site release requires no
  repository-local credential, remote shell, or separate control-plane source.
- Branch and review flow: this one-developer repository has exactly two
  branches, `dev` and `master`. Develop directly on `dev`, run the complete
  check, then fast-forward `master` to the verified `dev` commit and push both.
  Do not create temporary `codex/*`, feature, release, or worktree branches.
  At the end of every development cycle, local `dev`, local `master`,
  `origin/dev`, and `origin/master` must identify the same commit, the checkout
  must be clean, and no other local or remote branch may remain.
- Complete check command: `npm test`
  It is the sole aggregate check and must run unchanged in exact-commit
  `quality / site` GitHub CI for `dev` and
  `master`, plus feature-specific browser checks from a local static server. The
  legacy `services/` examples are not production sources and are not an
  alternative to the canonical `token-gen-api` suite.
- Live deployment path: GitHub Pages deployment from the repository
  root of `master`, serving `https://token-gen.owenonthenet.com` through the
  checked-in `CNAME`. A release is complete only when the latest Pages build
  names the exact reviewed commit and the protected public routes pass.
- Release path: work directly on local `dev`, run `npm test`, push `dev`,
  fast-forward local `master` to that exact commit, push `master`, return to
  `dev`, then verify four-way equality and the exact GitHub Pages build.
- Rollback path: restore the prior immutable site release with a revert on
  `dev`, verify it, fast-forward `master`, wait for the
  exact Pages rebuild, and repeat the same live checks.
- Forbidden actions: bypassing `quality / site`, creating extra branches or
  feature worktrees, direct live edits, global GitHub-auth switching,
  repository-local secrets, deployment from a mirror, PC-hosted production
  API/search dependencies, silent fallbacks, or a release record that does not
  match the Pages commit.

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

The API and server-side SearXNG source is the separate canonical repository at
`/home/zenfree/server-details-api`, remote
`https://github.com/owen-tech-ramblings/token-gen-api.git`. Any Codex or Codex
CLI instance may build either product, but it must use that product's `dev`
branch, repository instructions, verification, release and rollback path.
Machine location does not create ownership. Never patch managed runtime files
outside the API's local installer or work around missing API behaviour by
inventing browser data.

Token Gen site/API authoring and release are self-contained in the two
`/home/zenfree` repositories. Lil Zen, OpenClaw, SSH, and a separate control
plane are not source, promotion, or deployment dependencies.

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

Before committing on `dev`:

1. Verify the root with `git rev-parse --show-toplevel`.
2. Verify the remote with `git remote -v`.
3. Review `git status --short`.

Expected remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

Related canonical path:

- API source/runtime: `/home/zenfree/server-details-api`

Commit and push public-site changes only from this repository's `dev` branch,
then fast-forward `master` after verification. Mirrors and historical gateway
copies are non-authoritative and may never become the deploy source.
