# Vampire Survival Iteration 32 Test Report

Date: 2026-07-14 Australia/Sydney
Status: local release candidate passed; authenticated production canary pending
publication

## Artifact

- Generated live file: `games/vampire-survival.html`
- Exact archive: `games/vampire-survival-iterations/iteration-32-codex.html`
- Bytes: 101,657
- SHA-256:
  `0e058d4c0dccf3d63ccaf29371e42846ef8173b5e74ac1cc18d1dea73b36e3dd`
- Two consecutive builds and both live/archive hashes were byte-identical.

## Automated Results

Commands:

```bash
node --test tools/vampire-survival-profile.test.mjs
node tools/site-contract-tests.mjs
node tools/build-vampire-survival.mjs --check
git diff --check
```

Results:

- 26/26 profile, migration, rollback reconciliation, cross-tab revision,
  recovery/clear, enemy-cap, economy, content, and deterministic PRNG tests
  passed.
- Shared site contracts passed, including exact archive/live equality and the
  enemy-cap regression guard.
- Generated artifact was current.
- Diff check passed; Git emitted only the repository's existing Windows/WSL
  line-ending notices.

Profile cases covered:

- Fresh v2 defaults.
- Full v31 score/achievement/aggregate/settings migration.
- One-time migration and v2 precedence.
- Read-only pre-lease previews cannot create, migrate, reconcile, or recover
  storage.
- Partial-field normalization.
- Corrupt v2 fallback to v31 with exact raw recovery preservation.
- Parseable-invalid and unreadable v2 recovery before safe active fallback.
- Strict legacy aggregate validation, recovery-copy failure containment, and
  duplicate legacy-score reconciliation. Failed fresh-profile persistence is
  explicitly diagnosed as volatile.
- Rollback play followed by Iteration 32 redeploy reconciliation.
- Atomic write failure behavior.
- Stale-revision rejection plus additive two-tab run/settings rebase.
- Equal-revision profile-identity replacement rejection.
- Bounded 50-entry score history and explicit concurrent Bloodline conflict.
- Stable run IDs preserve identical-metric concurrent scores; incompatible
  pending-coffin outcomes require explicit resolution.
- Negative currency and Bloodline-rank rejection.
- Idempotent event application and derived balance.
- Export/import semantic equivalence.

## Real-Browser Results

Harness: persistent headless Chromium using the generated standalone artifact
with `?test=1`.

Gameplay path passed:

1. Start a run.
2. Move right and observe position/time/score changes.
3. Force Dominion level-up, open the pact choice, and select one pact.
4. Trigger Blood Moon.
5. Destroy all three warding crosses.
6. Spawn Captain Voss and reach phases II and III.
7. Defeat Voss and verify victory, achievements, score history, and v2 profile
   persistence.

Additional checks:

- No console errors after menu, gameplay, migration, victory, responsive, or
  soak flows.
- Only the local HTML document was requested; no runtime network or external
  asset requests occurred.
- Daily mode generated the same seed and city signature twice on 2026-07-14.
- Standard mode generated different seeds and city signatures.
- Nightmare selection produced the expected 195-second dawn timer.
- Actual Begin Hunt click and Escape pause/resume keyboard flow passed.
- Reloading did not increment the profile revision; only a real setting change
  produced one save.
- A second tab remained play-disabled while the first owned the exclusive
  writer lease. After back/forward-cache restoration, the old page stayed
  paused and its simulation clock remained frozen while the second tab owned
  the new lease. Once ownership returned, the run advanced only after an
  explicit Resume action.
- A forced profile-identity replacement produced a visible, nonfatal save
  error; restoring the valid slot and making a real setting change saved and
  cleared that error.
- Gameplay continued to victory with Web Audio constructors unavailable.
- Space activates the focused Begin Hunt button and pause checkboxes without
  firing gameplay shortcuts.
- Tutorial and pause dialogs receive focus, contain keyboard focus, and restore
  it to the opener/game canvas on close.
- A parseable-invalid active profile was preserved exactly in recovery, then
  replaced with a playable safe profile without console errors.
- Migrated high-contrast and reduced-motion settings applied to the body.
- Five touch action buttons remain present.
- At 375x812, Begin Hunt is fully visible at the initial zero-scroll position
  (`y=448`, bottom `493`) and the explanatory cards continue below it.
- Final local document load: 131 ms in the test environment.

## Responsive and Visual Matrix

| View | Result | Evidence |
| --- | --- | --- |
| 1280x720 desktop menu | Pass | `iteration-32-menu.png` |
| 1280x720 Voss phase III | Pass | `iteration-32-gameplay.png` |
| 375x812 portrait | Pass; primary action visible before scroll | `iteration-32-responsive-mobile.png` |
| 768x1024 tablet | Pass | `iteration-32-responsive-tablet.png` |
| 1280x720 responsive capture | Pass | `iteration-32-responsive-desktop.png` |

The Iteration 31 dark-city visual language remains intact. The removed
Skybridge override leaves one coherent local typographic system, and no player
surface contains Codex/build/requirements wording.

## Performance and Bounded-State Baseline

- 60 simulated seconds at 30 Hz completed in 263 ms in Chromium.
- At 60 seconds the director held 97 enemies; at 70 seconds it reached exactly
  the configured 108 cap and remained running.
- Review found and fixed the inherited cap loop that previously marked nearly
  every removable enemy dead after overflow.
- At the 108-enemy cap, 300 update+draw samples recorded p50 1.0 ms and p95
  3.2 ms. Long-tail harness/GC outliers are retained in raw session evidence
  and are not used as a frame-budget claim.
- A 30-second simulated run produced zero `localStorage.setItem` calls inside
  the frame loop.
- Representative migrated profile payload: 1,193 bytes, below the 250 KB
  budget.
- Entity collections use an explicit enemy cap; particles/projectiles retain
  existing lifecycle cleanup.

## Review Findings Fixed

- Strictly reject malformed required progress fields, preserve the exact raw
  profile, and only then install a safe active fallback.
- Reconcile progress earned during an Iteration 31 rollback by comparing the
  retained legacy fingerprint and snapshot.
- Added optimistic revision checks plus additive two-tab rebase so ordinary
  concurrent runs/settings do not freeze or disappear.
- Added stable per-run score IDs, active-profile identity checks, and explicit
  conflict handling for future pending-coffin outcomes.
- Added a read-only startup preview plus an exclusive Web Lock writer lease on
  supported browsers, including safe release and reacquisition across
  back/forward-cache lifecycle transitions.
- Made storage and Web Audio failures visible/nonfatal, with successful later
  saves clearing the transient warning.
- Rejected negative derived currency and invalid Bloodline ranks.
- Corrected enemy overflow trimming to mark only the excess entities dead.
- Derived the active cross quota from run state and unified score retention at
  50 entries for future Campaign/Hunt scaling.
- Wired named game phases and content-authored enemy behavior into runtime state
  so the Iteration 33 coffin transition and new encounter content have stable
  extension points.
- Removed the no-change startup save, protected focused controls from gameplay
  shortcuts, added modal semantics/focus handling, and moved the mobile start
  controls ahead of explanatory cards.
- Split state, world/objectives, gameplay, rendering, input, and test adapter
  code out of the HTML template while retaining a self-contained build.

## Known Non-Blocking Scope

- Physical touch hardware was not available; responsive layout, scrollability,
  touch-control DOM/actions, and desktop pointer/keyboard behavior were tested
  in Chromium.
- Browsers without Web Locks cannot serialize tabs. The game stays playable
  with an explicit instruction to keep exactly one Vampire Survival tab open.
- Gamepad gameplay polling remains in source. Full focus navigation for menus,
  modals, the future coffin, Bloodline, and loadout is explicitly deferred to
  the next UI iteration and is not claimed complete.
- The authenticated public route and production `?test=1` canary must pass
  after publication before Iteration 33 starts.

## Rollback

- Known-good published baseline before this release: Iteration 31 at commit
  `8375ed8` (game feature commit `93e55c8`).
- Static rollback artifact:
  `games/vampire-survival-iterations/iteration-31-codex.html`.
