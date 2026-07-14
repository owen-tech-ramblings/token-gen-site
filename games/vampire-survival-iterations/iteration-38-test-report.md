# Vampire Survival Iteration 38 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and Access gates passed

## Artifact

- Live file and exact archive: 194,447 bytes
- Archive: `games/vampire-survival-iterations/iteration-38-codex.html`
- SHA-256:
  `5ccc09d85ac522fd9e0f636672ca5e2d198e77da6a685ba90bce28752ddb38b0`
- Two consecutive builds were byte-identical.

## Automated Results

- 41/41 runtime, Campaign, Hunt, boss, ending, Ascension, Bloodline,
  migration, persistence, concurrency, loadout, targeting, and entity-cap
  tests passed.
- Exact Iteration 38 archive and shared site contracts passed.
- All 15 Campaign contracts use the selected difficulty's fixed dawn value.
  Every authored cross layout was unique and collision-free.
- `git diff --check` passed.

## Chapter III and Ending Browser Results

- Nights 11-15 expose distinct mixed-assault, sixfold, Silver Tempest, Dawn's
  Gauntlet, and Uncrowned Dawn contracts.
- Night 15 required six crosses before entering a separate `boss-active`
  phase. Archon Sol used a stable identity, three phases, sunfall zones,
  corona volleys, twin charge lanes, and mixed summons.
- Sol's first defeat committed one finite Blood Pack, the ending event, and
  Ascension unlock before the ending appeared. The ending marked itself seen
  atomically on continuation; replay produced no duplicate reward or ending.
- Ascension Hunt applied its pressure/damage premium and 30% score modifier.
  Hunt Depths 5, 10, and 15 selected Voss, Elowen, and Sol respectively.
- Blood Famine, Silver Rain, and Swift Hunters rotate every depth.

## Route, Responsive, and Performance Evidence

- Night 11-15 greedy base-speed routes measured 6,871, 6,912, 6,706, 7,218,
  and 7,204 world units against a 55,800-unit fixed-night travel budget.
- The 390x844 ending remained scrollable and kept the endgame action visible.
  Desktop Campaign, Bloodline, HUD, boss bar, and telegraphs remained clear.
- After one identical warm-up simulation, archived Iteration 37's seven
  180-second Nightmare Hunt Depth 12 runs measured 205, 169, 157, 175, 174,
  161, and 176 ms (accepted p95 205 ms). Iteration 38 measured 154, 165, 169,
  142, 163, 175, and 164 ms (accepted p95 175 ms).

## Screenshots

- `iteration-38-sol.png`
- `iteration-38-ending.png`
- `iteration-38-campaign-map.png`
- `iteration-38-bloodline-v3.png`

## Rollback

- Published baseline: Iteration 37 commit `99ef258`.
- Static rollback: `iteration-37-codex.html`.

## Publication Evidence

- Release commit `8c08107e611055d50860e338d61d6138d8cbbe9d` was pushed to
  both public and private `master` remotes.
- GitHub Pages workflow `29352718906` completed successfully for that exact
  commit.
- Direct Pages origin returned HTTP 200, 194,447 bytes, and the expected
  SHA-256 `5ccc09d85ac522fd9e0f636672ca5e2d198e77da6a685ba90bce28752ddb38b0`.
- Public HTTPS retained the expected unauthenticated Cloudflare Access 302.
