# Vampire Survival Iteration 39 Test Report

Date: 2026-07-15 Australia/Sydney
Status: release candidate; publication pending

## Artifact

- Live file and exact archive: 213,850 bytes
- Archive: `games/vampire-survival-iterations/iteration-39-codex.html`
- SHA-256:
  `f2402e9ae59168bba543a7924f933b11390917ea48c0891dfc50c388f7a9fb41`
- Two consecutive builds were byte-identical.

## Local-First Cloud Profile

- Play, migration, progression, currency, and saves remain local and do not
  wait for the network. Cloud Save is optional and explicitly connected.
- Cloud identity comes only from a verified Cloudflare Access JWT. The client
  never asks for, stores, or trusts a typed mailbox address.
- The server stores only an HMAC-SHA-256 identity filename and a mode-600 JSON
  envelope. Raw mailbox addresses are neither persisted nor returned.
- GET returns an ETag. PUT requires `If-Match` and an idempotency key. Stale
  writes return 412 with an explicit conflict; key reuse with different data
  returns 409. DELETE requires the latest ETag.
- Empty cloud accounts never trigger an automatic upload. Local and cloud
  conflicts require an explicit choice, and replacing the local copy first
  preserves it in the recovery slot. Blood Pack ledgers are never merged.
- Offline changes remain in a separate replay queue. Export and two-step cloud
  deletion remain available, and deleting cloud data never deletes local data.

## Routing and Authenticated Canary

- The initial API-path probe exposed that the public Token Gen API hostname is
  served by the established gateway rather than the local Node proxy. No live
  API route was replaced.
- Cloud saves were isolated on `vampire-save.owenonthenet.com`, routed through
  the existing named tunnel to the scoped profile handler. The temporary path
  Access application was removed after the dedicated hostname passed.
- The Hostinger-backed Access login reached the dedicated session endpoint.
  A disposable authenticated canary passed 404, create 201, idempotent replay
  200, stale write 412, read 200 with the same strong ETag, delete 200, and
  final read 404.
- The canary profile was removed. The runtime store contained only its
  server-side 32-byte identity secret afterward.
- Production-origin preflight returned credentials, the exact origin, PUT,
  and the required content, `If-Match`, and idempotency headers.

## Automated and Browser Results

- 51/51 profile, cloud-client, backend identity/store, Campaign, Hunt, boss,
  ending, Ascension, Bloodline, migration, persistence, concurrency, loadout,
  targeting, and entity-cap tests passed.
- Shared site contracts, exact Iteration 39 archive equality, module syntax,
  deterministic builds, and `git diff --check` passed.
- Desktop browser checks covered local-only, empty-cloud, conflict, recovery,
  and gameplay states. The 390x844 cloud dialog remained scrollable.
- A controlled conflict never replaced local progress until `Use Cloud Copy`
  was selected, then retained the replaced local profile in recovery storage.
- Gameplay remained active with a queued cloud state and produced no new
  console errors.
- Under the same warmed test harness, Iteration 38 measured an accepted p95 of
  83 ms and Iteration 39 measured 57 ms.

## Screenshots

- `iteration-39-cloud-local.png`
- `iteration-39-cloud-conflict.png`
- `iteration-39-cloud-mobile.png`
- `iteration-39-gameplay.png`

## Rollback

- Published baseline: Iteration 38 release commit `8c08107`.
- Static rollback: `iteration-38-codex.html`.

## Publication Evidence

- Pending release commit, Pages workflow, direct-origin digest, and public
  Access verification.
