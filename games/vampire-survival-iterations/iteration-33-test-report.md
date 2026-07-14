# Vampire Survival Iteration 33 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production artifact and authenticated Campaign/coffin
canary passed

## Artifact

- Generated live file: `games/vampire-survival.html`
- Exact archive: `games/vampire-survival-iterations/iteration-33-codex.html`
- Bytes: 128,322
- SHA-256:
  `bb0fc35cb5a7bf8c9dbd1477abf46677c3dfc54e6da195ff08de7f611f0239db`
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

- 30/30 profile, migration, concurrency, economy, content, objective-contract,
  ability-state, Campaign-clear, Hunt-depth, and enemy-cap tests passed.
- All source modules and build/test tools passed `node --check`.
- Shared site contracts passed, including the exact Iteration 33 archive,
  objective wording, cross quota, coffin phases, atomic commit, milestone lock
  copy, animation, dialog semantics, and mobile objective visibility.
- The generated artifact was current and the diff check passed.

## Campaign and Coffin Browser Results

Harness: persistent Chromium using the generated standalone artifact with
`?test=1`.

- Fresh Campaign Night 1 starts with 21 enemies, exactly three unique,
  collision-free warding crosses, Feed/Dash available, Mist locked behind
  Night 5, and Swarm locked behind Night 10.
- Reaching dawn with all three crosses intact produces `Dawn Claimed the
  Crosses`, reports that three remain, and records a loss without entering
  the coffin.
- The first clear atomically records the run, immutable
  `campaign:night-01:first-clear`, one Blood Pack, Night 2 unlock,
  and pending coffin result before the transition appears.
- The normal four-second animation visibly moves the vampire into the open
  coffin and closes the lid. `Skip to Rest` enters the hub
  immediately.
- The hub shows restoration, cooldown readiness, first-clear reward, balance,
  Bloodline entry point, Rise, and Leave.
- Rise acknowledges the pending outcome and returns to the Campaign map, where
  Night 1 is Cleared and Night 2 is Unlocked but correctly marked as arriving
  with Chapter I.
- Replaying Night 1 records the win without granting a second Blood Pack.
- A forced storage failure leaves the player at `Progress Not Saved`,
  sets the clear-commit failure state, and never exposes the coffin.
- A committed pending coffin outcome survives page reload;
  `Continue in Coffin` resumes the correct hub and reward summary.
- Reduced motion settles the closed coffin and reaches the hub in 650 ms.
- No unexpected console errors occurred in the normal Campaign/coffin flows.

## Hunt Progression Browser Results

- Hunt Depths 1 and 2 use the same selected difficulty duration and the same
  three-cross preview quota.
- Depth 2 starts with 26 enemies versus Depth 1's 21 and raises director
  pressure, elite chance, enemy health, enemy damage, guards, and hunters.
- Clearing Depth 1 offers Depth 2 from the coffin. Clearing Depth 2 records
  best depth and score, offers preview replay, and grants no Campaign currency.
- Ability priority passed: milestone lock first, then cooldown, insufficient
  Blood, and Ready. Mist showed `Need 10 Blood`, then Ready, then an
  8.5-second cooldown after use; Swarm remained Night 10 locked.
- Zero-cost Feed and Dash never report an insufficient-Blood state, including
  the depleted-Blood result edge case found during the protected canary.
- Forty generated route checks across both Hunt depths produced unique,
  collision-free layouts within the base-speed route budget.

## Responsive and Visual Matrix

| View | Result | Evidence |
| --- | --- | --- |
| Desktop title | Pass | `iteration-33-menu.png` |
| Desktop Campaign map | Pass | `iteration-33-campaign-map.png` |
| Desktop gameplay | Pass | `iteration-33-gameplay.png` |
| Coffin hop/close | Pass | `iteration-33-coffin-animation.png` |
| Desktop coffin hub | Pass | `iteration-33-coffin-hub.png` |
| 375x812 title | Pass | `iteration-33-responsive-mobile.png` |
| 375x812 gameplay | Pass; objective visible | `iteration-33-gameplay-mobile.png` |

At 375x812, the mission panel is visible at the top of gameplay, the page has
no horizontal overflow, enabled controls meet a 45-pixel minimum height, and
the Campaign map and coffin hub remain vertically scrollable.

## Performance and Bounded State

- A Nightmare Hunt Depth 2 simulation advanced 180 seconds at 30 Hz in 740 ms
  in the browser harness.
- The director reached and held the configured 108-enemy cap without ending
  the run or overflowing the collection.
- At the end of the soak, one live projectile and no stale particles remained.
- The run did not write profile data from the frame loop.

## Release-Blocker Review

- Cross layouts are unique, collision-free, and comfortably inside the
  base-speed route-distance budget.
- First-clear currency and Night 2 unlock are idempotent.
- The mobile objective is visible.
- A save failure cannot bypass to rewards or the coffin.
- Normal, skipped, reduced-motion, and reload-resumed coffin flows can all
  continue.
- Hunt difficulty rises while night duration stays fixed. The broader spaced
  cross-quota cadence is reserved for Iteration 34's full Hunt.

## Rollback

- Known-good published baseline: Iteration 32 release commit `abf7cd3`.
- Static rollback artifact:
  `games/vampire-survival-iterations/iteration-32-codex.html`.

## Publication Evidence

- Final gameplay commit `5b1fe9949fac90e50ea584a9b6dc5055cfa0b02d`
  was pushed to both public and private `master__ remotes.
- GitHub Pages build `1095141113` completed successfully for that
  exact commit.
- A direct Pages-origin request returned HTTP 200, 128,322 bytes, and SHA-256
  `bb0fc35cb5a7bf8c9dbd1477abf46677c3dfc54e6da195ff08de7f611f0239db`.
- Unauthenticated public HTTPS returned the expected Cloudflare Access 302.
- The existing authenticated Windows Chrome session hard-refreshed to the
  final Iteration 33 build, opened Campaign, entered Night 1, and showed the
  live three-cross objective plus Feed/Dash Ready and Mist/Swarm milestone
  locks.
- The safe `?test=1` adapter completed all three crosses and dawn.
  Production showed the normal coffin transition, first-clear reward, restored
  cooldowns, one Blood Pack, Rise for Night 2, and the map's Night 2
  Unlocked/arrives-with-Chapter-I state.
- The protected browser was returned to the title screen. No Cloudflare,
  mailbox, DNS, Worker, or Access settings were changed.
