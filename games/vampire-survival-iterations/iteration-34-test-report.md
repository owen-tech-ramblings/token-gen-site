# Vampire Survival Iteration 34 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and Access gates passed

## Artifact

- Generated live file: `games/vampire-survival.html`
- Exact archive: `games/vampire-survival-iterations/iteration-34-codex.html`
- Bytes: 137,476
- SHA-256:
  `442cff973527cdbbafecb05e861720448d5b05648eea45199ba078ff76656f45`
- Two consecutive archive builds produced byte-identical live and archive
  files.

## Automated Results

Commands:

```bash
node --test tools/vampire-survival-profile.test.mjs
node tools/site-contract-tests.mjs
node tools/build-vampire-survival.mjs --check
git diff --check
```

Results:

- 32/32 runtime, progression, profile, migration, concurrency, economy,
  Campaign, milestone-unlock, Hunt, and enemy-cap tests passed.
- Shared site contracts passed, including exact live/archive equality, the
  Hunt quota cadence, protected objective enemies, Voss's post-dawn phase,
  atomic Mist/Hunt unlocks, immediate boss-HUD refresh, and responsive boss
  message spacing.
- All source modules and build/test tools passed `node --check`.
- The generated artifact was current and the diff check passed.

## Chapter I Browser Results

Harness: persistent Chromium using the generated standalone artifact with
`?test=1`.

- The Campaign map exposes five authored nights with distinct names,
  objectives, enemy composition, and progression states.
- Night 2 starts with three warding crosses and two Procession Keepers. Dawn
  with the crosses broken but a keeper alive records the specific
  `dawn-lieutenants` loss.
- Nights 3 and 4 raise the cross quota and change their lieutenant and patrol
  compositions without changing the selected difficulty's night duration.
- Night 5 requires four crosses, then enters a separate post-dawn
  `boss-active` phase. It cannot record a clear before Captain Voss dies.
- Voss victory atomically records the Night 5 clear, one first-clear Blood
  Pack, Mist, and full Hunt exactly once. Replaying cannot duplicate the
  reward or milestone events.
- The coffin transition and hub show the Night 5 reward, restored abilities,
  Mist unlock, Hunt unlock, and the next progression choice.
- No unexpected console errors occurred.

## Full Hunt Browser Results

- Hunt is unavailable on a fresh profile and cannot be bypassed by an older
  pending coffin outcome. It unlocks only from the recorded Night 5 clear.
- Cross quotas follow the approved spaced cadence:
  `3,3,4,4,4,5,5,6,6,6...` while the selected night length stays fixed.
- Difficulty continues past the quota cap through bounded pressure, elite
  chance, health, damage, hunters, guards, and score multipliers.
- Hunt Depth 8 starts with six crosses and 32 enemies. The generated layout was
  unique and collision-free; its greedy base-speed route cost was 6,543
  against a 48,360 travel budget.
- A Nightmare Hunt Depth 12 simulation advanced 180 seconds at 30 Hz in 878 ms
  while holding the configured 108-enemy cap. The run remained active and
  bounded.

## Responsive and Visual Matrix

| View | Result | Evidence |
| --- | --- | --- |
| Desktop title | Pass | `iteration-34-menu.png` |
| Desktop Chapter I map | Pass | `iteration-34-campaign-map.png` |
| Desktop Voss phase | Pass | `iteration-34-voss-after.png` |
| Desktop coffin hub | Pass | `iteration-34-coffin-hub.png` |
| 375x812 Chapter I map | Pass; vertical scroll, no horizontal overflow | `iteration-34-mobile-map.png` |
| 375x812 Voss phase | Pass; mission, stats, boss bar, and toast do not overlap | `iteration-34-voss-mobile.png` |

The earlier `iteration-34-voss.png` and `iteration-34-hunt-depth-12.png`
captures are retained as QA evidence from before the final boss-HUD fixes and
the successful non-lethal soak configuration.

## Review Findings Fixed

- Objective lieutenants could previously be selected by the 108-enemy overflow
  trimmer, silently making a night unwinnable. Bosses and all required
  lieutenants are now protected from removal.
- An Iteration 33 pending Hunt coffin outcome could have bypassed the Night 5
  milestone. Locked Hunt continuations now return to Campaign.
- The first post-dawn boss frame showed stale time/objective HUD data. Voss's
  transition now refreshes the HUD immediately.
- The boss transition toast overlapped Voss's health bar on desktop and the
  stacked HUD on phones. Boss-active layout rules now reserve separate space.

## Rollback

- Known-good published gameplay baseline: Iteration 33 commit `5b1fe99`.
- Static rollback artifact:
  `games/vampire-survival-iterations/iteration-33-codex.html`.

## Publication Evidence

- Final Iteration 34 gameplay/QA commit
  `dbf837f5b15afbeed4ba96ffa0982a5de2c52ffb` was pushed to both public and
  private `master` remotes.
- GitHub Pages build `1095212527` completed successfully for that exact commit.
- A direct Pages-origin request returned HTTP 200, 137,476 bytes, and SHA-256
  `442cff973527cdbbafecb05e861720448d5b05648eea45199ba078ff76656f45`.
- Unauthenticated public HTTPS returned the expected Cloudflare Access 302.
- The authenticated Windows-control helper did not receive its required
  sandbox context, and Chrome's current app-bound cookie encryption prevented
  a safely scoped cookie copy into the headless browser while Chrome remained
  open. No credential, mailbox, Cloudflare, or protected-browser state was
  changed. The release therefore relies on the exact-origin artifact proof and
  the complete local generated-artifact browser gate above; a protected-session
  smoke can be repeated when the Windows helper is available.
