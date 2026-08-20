# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

## Repository contract

- Canonical root: `/home/jesse/.openclaw/workspace/token-gen-site-pages`
- Canonical remote:
  `https://github.com/owen-tech-ramblings/token-gen-site.git`
- Release branch: `master`
- Integration branch: `dev`
- Expected GitHub identity: `owen-tech-ramblings`.
- Browser source must contain no secret. Approved secret locators are
  Google Secret Manager project `lil-zen-oc` and `D:\openclaw`
  (`/mnt/d/openclaw` in WSL); never copy their values into this repository.
- Branch and review flow: begin only when `dev` and `master` are aligned.
  Create receipt-bound `codex/*` worktrees through the Lil Zen managed-worktree
  command, push the branch, and open the reviewed pull request directly to
  `master`. The versioned release transaction aligns `dev` only after the exact
  `master` commit is deployed and verified. At stable state, local and origin
  `dev`/`master` must identify that one commit and temporary branches and leases
  must be removed.
- Test policy: use `risk-based-targeted-v2`. Ordinary changes run one to five
  small checks selected for the changed behaviour and adjacent protected
  outcome; ten is the hard maximum. Do not run the historic complete `npm test`
  suite unless Jesse explicitly asks for it or the change is genuinely
  ecosystem-wide. GitHub CI runs once, on the resulting `master` push, on the
  private `lil-zen-ci` runner. It must not run for pull requests, `dev` pushes,
  schedules, workflow chains, or unrelated historical coverage.
- Live deployment path: GitHub Pages deployment from the repository
  root of `master`, serving `https://token-gen.owenonthenet.com` through the
  checked-in `CNAME`. A release is complete only when the latest Pages build
  names the exact reviewed commit and the protected public routes pass.
- Release path: use the receipt-bound Token Gen Pages cutover in the Lil Zen
  control plane. It accepts only the reviewed `master` commit after its exact
  targeted CI and Pages deployment succeed, verifies the protected live assets,
  writes rollback evidence, and aligns `dev` to the deployed commit.
- Rollback path: revert through a reviewed `master` pull request, wait for the
  exact targeted CI and Pages deployment, and run the same rollback-protected
  Pages cutover and live checks.
- Forbidden actions: broad default suites, hosted GitHub runners, duplicate CI
  triggers, direct commits to `dev` or `master`, unleased worktrees, direct live
  edits, global GitHub-auth switching, repository-local secrets, deployment
  from a mirror, PC-hosted production API/search dependencies, silent
  fallbacks, or release evidence that does not match the Pages commit.

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
`/home/jesse/.openclaw/workspace/token-gen-api`, remote
`https://github.com/owen-tech-ramblings/token-gen-api.git`. Any Codex or Codex
CLI instance may build either product, but it must use that product's `dev`
branch, repository instructions, verification, release and rollback path.
Machine location does not create ownership. Never patch managed runtime files
outside the API's local installer or work around missing API behaviour by
inventing browser data.

Token Gen site and API have separate canonical repositories and product release
scopes. Their reviewed release and alignment transactions are owned by the Lil
Zen control plane; runtime copies are never authoring sources.

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

Before committing in a receipt-bound managed worktree:

1. Verify the root with `git rev-parse --show-toplevel`.
2. Verify the remote with `git remote -v`.
3. Review `git status --short`.

Expected remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

Related canonical path:

- API source: `/home/jesse/.openclaw/workspace/token-gen-api`

Commit and push public-site changes only from the receipt-bound worktree, merge
the reviewed pull request to `master`, and use the versioned Pages cutover.
Mirrors and historical gateway copies are non-authoritative and may never
become the deploy source.
