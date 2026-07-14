# Vampire Survival Iteration 37 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and Access gates passed

## Artifact

- Live file and exact archive: 182,897 bytes
- Archive: `games/vampire-survival-iterations/iteration-37-codex.html`
- SHA-256:
  `560e9abfa223188547e2a7c3a8bd38be7b3f7592eb4121932a60e78de7460d2e`
- Two consecutive builds were byte-identical.

## Automated Results

- 39/39 runtime, Chapter I-II, Hunt, Bloodline, unlock, migration,
  persistence, concurrency, loadout, targeting, and entity-cap tests passed.
- Exact Iteration 37 archive and shared site contracts passed.
- All ten Campaign contracts use the same selected-difficulty dawn value.
  Every cross layout was unique and collision-free.

## Chapter II Browser Results

- Nights 6-10 expose distinct Bellward, Hollow Choir, Silver Chase, Tolling
  Lock, and Last Bell contracts.
- Night 6 spawned two objective Bell Keepers. Bell Keepers use telegraphed
  movement zones and join Hunt composition at Depth 8 and beyond.
- Night 10 entered a separate `boss-active` phase only after five crosses and
  dawn. Sister Elowen exposed her own identity, phase bar, timing circles,
  radial peals, charge lanes, and Bell Keeper summons.
- Elowen's first defeat recorded one immutable Swarm event, one first-clear
  pack, and a coffin result before exposing Swarm. A replay did not duplicate
  either reward or unlock.
- The Campaign map rendered ten authored nights and both milestone bosses.
- No browser console errors occurred.

## Bloodline and Responsive Results

- Each branch now contains five chained nodes (15 total). The six new nodes
  cover Feed, maximum Blood, Mist cooldown, movement, Thrall lifetime, and
  Swarm damage.
- Desktop displayed three parallel five-node paths. At 390x844, all three tabs
  remained 100px wide inside a 352px panel, scroll width equalled client width,
  one branch was visible, and all five nodes remained vertically reachable.
- Touch actions were compacted into two three-button rows with 64px targets.

## Route and Performance Evidence

- Night 6-10 greedy base-speed route ratios were 0.100, 0.120, 0.123, 0.117,
  and 0.120 of the available Night travel budget.
- Seven Nightmare Hunt Depth 12 simulations at 30 Hz measured 919, 839, 803,
  1,021, 1,040, 1,072, and 806 ms. Accepted p95 was 1,072 ms versus Iteration
  36's 1,186 ms.

## Screenshots

- `iteration-37-campaign-map.png`
- `iteration-37-elowen.png`
- `iteration-37-bloodline-v2.png`

## Rollback

- Published baseline: Iteration 36 commit `806e110`.
- Static rollback: `iteration-36-codex.html`.

## Publication Evidence

- Release commit `99ef258f474dbb820932adb89a444b5c29ce23f8` was pushed to
  both public and private `master` remotes.
- GitHub Pages workflow `29351419995` completed successfully for that exact
  commit.
- Direct Pages origin returned HTTP 200, 182,897 bytes, and the expected
  SHA-256 `560e9abfa223188547e2a7c3a8bd38be7b3f7592eb4121932a60e78de7460d2e`.
- Public HTTPS retained the expected unauthenticated Cloudflare Access 302.
