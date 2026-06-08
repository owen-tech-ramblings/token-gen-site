# Token Gen Handoff

Last updated: 2026-06-08 12:56 Australia/Sydney

## Last Session Changes

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

## Next Steps For Any Codex CLI Session

1. Read `AGENTS.md`, `CURRENT_STATE.md`, and `HANDOFF.md`.
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
