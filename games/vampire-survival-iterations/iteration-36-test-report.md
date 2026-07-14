# Vampire Survival Iteration 36 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and Access gates passed

## Artifact

- Generated live file: `games/vampire-survival.html`
- Exact archive: `games/vampire-survival-iterations/iteration-36-codex.html`
- Bytes: 175,359
- SHA-256:
  `b460366aacc7d1e63b1774943081ff57c862787255a8954bd20a4c026075d09e`
- Two consecutive builds were byte-identical.

## Automated Results

- 38/38 runtime, progression, profile, migration, economy, Bloodline,
  loadout, targeting, Campaign, Hunt, and entity-cap tests passed.
- Site contracts passed against the exact Iteration 36 archive and all nine
  accessible modal surfaces.
- `git diff --check` passed.

## Browser Results

- A fresh profile showed Create Thrall locked behind the exact Night 1
  prerequisite. The same atomic first clear unlocked and selected it once.
- The coffin loadout showed selected, owned, locked, and prerequisite states.
  Desktop exposed all three techniques; the 390x844 layout remained vertically
  scrollable and kept the 45px Confirm action reachable.
- Ability feedback proved locked, unequipped, casting, cap, cooldown,
  insufficient-Blood, no-target, and ready states in priority order.
- Create Thrall used range-bounded stable-ID targeting. Three conversions
  produced stable `thrall-enemy-*` identities; a fourth was blocked at 3/3.
- Only one conversion could run at once. Conversion targets were frozen,
  protected from damage and entity trimming, then removed without hostile
  residue when converted.
- Thralls retargeted at most every 0.35 seconds, expired through the centralized
  cleanup path, and never attacked the player. An in-progress dawn transition
  cancelled cleanly, refunded Blood, reset cooldown, and left no stale target.
- No browser console errors occurred.

## Responsive Evidence

- `iteration-36-loadout-desktop.png`
- `iteration-36-loadout-mobile.png`
- `iteration-36-thrall-gameplay.png`

## Performance Gate

- Archived Iteration 35 baseline, seven identical 180-second Nightmare Hunt
  Depth 12 simulations at 30 Hz: 1,050, 903, 1,143, 984, 936, 868, 858 ms.
- Iteration 36 candidate: 1,186, 1,006, 1,066, 954, 942, 991, 980 ms.
- Accepted p95 moved from 1,143 to 1,186 ms, a 3.8% increase. This is below the
  roadmap's 10% release blocker.

## Rollback

- Known-good published gameplay baseline: Iteration 35 commit `d59a907`.
- Static rollback artifact:
  `games/vampire-survival-iterations/iteration-35-codex.html`.

## Publication Evidence

- Release commit `806e110269f55ed42a78e9f312f9dc5126d5c42f` was pushed to
  both public and private `master` remotes.
- GitHub Pages workflow `29350408386` completed successfully for that exact
  commit.
- A direct Pages-origin request returned HTTP 200, 175,359 bytes, and SHA-256
  `b460366aacc7d1e63b1774943081ff57c862787255a8954bd20a4c026075d09e`.
- Unauthenticated public HTTPS returned the expected Cloudflare Access 302.
- The authenticated Windows helper remained unavailable, so no unsafe
  foreground automation or broad cookie copy was attempted. No production
  profile, credentials, mailbox, or Cloudflare state changed.
