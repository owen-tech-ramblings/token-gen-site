# Token Gen Handoff

Last updated: 2026-06-09 01:35 Australia/Sydney

## Last Session Changes

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
