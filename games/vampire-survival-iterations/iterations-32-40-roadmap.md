# Vampire Survival Iterations 32-40 Roadmap

Status: approved direction; publish and verify one iteration before starting
the next

## Product Direction

The current single-night hunt becomes a fifteen-night Campaign with milestone
bosses on Nights 5, 10, and 15. Hunt becomes an open-ended mastery mode. Both
modes keep ordinary night length fixed while difficulty rises through warding
cross quotas, route pressure, encounter combinations, elites, mutators, and
bounded scaling.

Every survived night ends with the vampire hopping into a coffin and closing
the lid before daylight. The coffin restores blood, health, and cooldowns and
acts as the progression hub for rewards, the Bloodline tree, talent loadout,
and the next-night decision. Repeat transitions are skippable; reduced motion
uses a short restrained cut/fade.

## Shared Rules

- A normal night never becomes longer just because the level is harder.
- Clearing requires the authored cross quota and survival until dawn.
- Milestone bosses begin in a clearly separate post-dawn phase after the quota
  is complete. Boss victory, not merely reaching dawn, clears that night.
- Campaign cross quotas are authored. Hunt quotas rise on a spaced cadence,
  initially cap at six, and never increase on the same depth that introduces a
  milestone boss.
- Cross layouts must be unique, collision-free, visible, and achievable within
  a tested route-distance budget at base movement speed.
- Hunt pressure must also grow through composition, elites, mutators, boss
  cadence, and faster decisions. It cannot become only larger health numbers.
- First clears and one-time challenges award finite Blood Packs. Replays do not
  become a required farming loop.
- Clear rewards and unlocks use immutable idempotent event IDs and an atomic
  profile commit before the coffin result appears.
- Local play always works. Later cloud failure may not block starting or
  finishing a locally committed run.

## Iteration 32 - Foundation and Profile v2

Purpose: make the successful vertical slice safe to extend.

- Generate the same standalone HTML from modular vanilla-JS source.
- Add profile schema v2, v31 migration, revision checking, recovery, export,
  and idempotent economy/unlock scaffolding.
- Remove internal build language and the conflicting injected style override.
- Preserve Standard, Daily, difficulty, touch, accessibility, boss, Blood
  Moon, and victory behavior.
- Establish deterministic unit, contract, browser, persistence, responsive,
  performance, and entity-cap evidence.

Status: published and authenticated production gameplay canary passed.

## Iteration 33 - Night 1, Coffin Loop, and Objective Contract

Purpose: prove the new connective loop before producing a full chapter.

- Add a Campaign map with only Night 1 playable.
- Start with Feed and Dash. Show Mist and Swarm locked with milestone text.
- Add exact cross briefing/HUD/minimap/route diagnostics and a specific failure
  when dawn arrives with crosses remaining.
- Commit a clear atomically, play a three-to-five-second coffin close, restore,
  show compact rewards, and enter a coffin hub with Rise for Night 2 or Leave.
- Keep routine coffin visits under twenty seconds and add the reduced-motion
  alternative.
- Add ready, cooldown, insufficient-blood, and locked ability states.
- Add a two-depth Hunt preview using the same night duration and a harder second
  depth.

Release blockers: unreachable layouts, duplicate rewards, hidden mobile
objective, save-failure bypass, or a coffin flow that cannot continue.

## Iteration 34 - Chapter I, Voss, Mist, and Full Hunt

Purpose: deliver Nights 2-5 and validate the first milestone.

- Give Nights 2-5 distinct encounter/objective identities.
- Use lieutenants or objective finishes on Nights 2-4 and Voss on Night 5.
- Unlock Mist exactly once after Voss.
- Launch full Hunt after Night 5 with fixed-duration nights, escalating
  composition, score pressure, personal-best depth, coffin intermissions, and
  an initial cross cadence of `3,3,4,4,4,5,5,6,6,6...`.

Release blockers: Mist bypass, impossible base-speed route, boss clear without
victory, duplicate reward, or indistinguishable authored nights.

## Iteration 35 - Bloodline v1

Purpose: establish permanent build identity with an economy small enough to
tune.

- Launch three branches with three nodes each: Crimson Hunger, Moonstride, and
  Nightborn Arts.
- Show cost, prerequisite, current/next effect, and concise flavor copy.
- Support atomic purchase, one-step Undo, and free full respec during roadmap
  validation.
- Use a branching desktop layout and branch tabs with vertical paths on narrow
  screens.
- Derive run stats from purchases at night start; never mutate base definitions.

Release blockers: currency loss/duplication, invalid allocation, inaccessible
nodes, or permanent upgrades becoming mandatory for Chapter I.

## Iteration 36 - Loadout, Cooldowns, and Create Thrall

Purpose: complete talent decisions and add the signature conversion power.

- Add the coffin/pre-night talent loadout with owned, locked, selected, and
  prerequisite states.
- Show the highest-priority blocking reason for every ability and synchronize
  fill/numeric cooldown feedback with real availability.
- Add Create Thrall with deterministic nearby targeting, one conversion in
  progress, a cap of three active thralls, stable-ID ties, bounded retargeting,
  and centralized cleanup.

Release blockers: hostile/stale thralls, entity leaks, contradictory ability
states, inaccessible targeting, or more than a ten-percent accepted p95
performance regression.

## Iteration 37 - Chapter II and Swarm

Purpose: deepen mastery through Nights 6-10.

- Add a new enemy family or encounter rule and a movement/timing-focused boss.
- Add two nodes to each Bloodline branch.
- Unlock Swarm exactly once after the Night 10 boss.
- Add Chapter II content to Hunt without breaking duration, quota, or boss
  cadence rules.

Entry requires distinct Chapter I nights, achievable base-speed routes, no
mandatory farming, and meaningful coffin choices.

## Iteration 38 - Chapter III, Ending, and Endgame

Purpose: complete Nights 11-15 and deliver a real endpoint.

- Add the hardest validated cross routes and mixed encounters.
- Add the final two nodes per Bloodline branch, reaching seven each.
- Add the Night 15 final boss, ending, and an endgame unlock such as Ascension
  modifiers or Endless Hunt.
- Extend Hunt with bosses every five depths, rotating mutators, and visible
  personal-best/reward context.

Release blockers: required grinding, ending duplication/loss, recycled quota
inflation, or unfair final routes/boss states.

## Iteration 39 - Cloud Identity and Saves

Purpose: synchronize the already-local-first profile safely.

- Verify the active Python ServerDetailsAPI and Cloudflare Access route first.
- Derive identity server-side from a valid Access assertion. Never trust a
  browser-supplied email as account identity.
- Add GET/ETag and revision-checked PUT/If-Match with idempotency keys,
  deliberate conflict choices, offline queue replay, export, and deletion.
- Keep the Hostinger mailbox outside source, tests, logs, and profile data.

Release blockers: spoofable identity, silent overwrite, balance duplication,
secret exposure, or network-dependent play.

## Iteration 40 - Release Hardening

Purpose: validate the full product as one system.

- Run fresh, v31-migrated, mid-Campaign, completed, corrupt, offline,
  cloud-conflict, and large-history profiles.
- Exercise Campaign 1-15 and representative deep Hunt.
- Cover desktop, portrait/landscape phone, tablet, keyboard, touch, controller,
  high contrast, and reduced motion.
- Enforce performance, entity, save-size, load, focus, target-size, label, and
  non-color state budgets.
- Complete fresh-profile pacing, economy, boss, milestone, coffin, ending, and
  teen-facing-copy review.

## Per-Iteration Publish Gate

1. Confirm canonical root, remote, branch, and scoped status.
2. Build twice and prove the live/archive artifact is deterministic.
3. Run iteration unit, simulation, contract, and browser suites.
4. Fix release blockers and rerun affected plus regression checks.
5. Archive the exact artifact and update the test report, iteration log,
   `CURRENT_STATE.md`, and `HANDOFF.md`.
6. Review the diff, commit, and push only the intended iteration.
7. Verify the authenticated public route, safe `?test=1` canary, rollback
   artifact, and deployment report.
8. Revise the next iteration from observed evidence before implementation.
