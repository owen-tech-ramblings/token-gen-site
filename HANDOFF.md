# Token Gen Handoff

Last updated: 2026-06-08 09:16 Australia/Sydney

## Last Session Changes

- Added shared Codex context files for the Token Gen project:
  - `AGENTS.md`
  - `CURRENT_STATE.md`
  - `HANDOFF.md`
- Documented that both Codex CLI sessions should read and update these files.
- Documented the required public API routes and expected gateway architecture.

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
3. Re-check live API routes before diagnosing monitor or chat issues:

```bash
for path in /api/health /api/public-status /.well-known/token-gen-api.json /api/agent.json /api/chat/models /api/web-search/health; do
  echo "### $path"
  curl -sS -i --max-time 12 "https://token-gen-api.owenonthenet.com${path}" | sed -n '1,35p'
done
```

4. Update this file before stopping with:
   - files changed
   - commits made
   - live verification output summary
   - remaining broken routes or risks

