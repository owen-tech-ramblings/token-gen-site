# Vampire Survival Development State

Status: active; Iteration 32 locally complete and awaiting publication
Live page: `/games/vampire-survival.html`
Previous published build: Iteration 31, 2026-07-10
Current archive candidate: `games/vampire-survival-iterations/iteration-32-codex.html`

## Current State

Vampire Survival remains a self-contained HTML canvas game, but its editable
source now lives in `games/vampire-survival-src/`. The deterministic build
inlines that source into the live HTML and the matching iteration archive.

Iteration 32 preserves the current vertical slice:

- A large procedural city with five districts, camera, minimap, and compass.
- Three warding crosses followed by the three-phase Captain Voss encounter.
- Villagers, guards, hunters, priests, captains, and elite variants.
- Feed, Dash, Mist, Bat Swarm, Blood Pacts, Blood Moon, pickups, combos,
  difficulty modes, and Daily Hunt.
- Desktop keyboard/mouse, touch controls, gamepad gameplay polling, reduced
  motion, high contrast, settings, local scores, and achievements.

It also adds the extension foundation:

- Modular source for runtime, content, profile, state, world/objectives,
  gameplay, rendering, input, and the `?test=1` adapter.
- Profile schema v2 for future Campaign, Bloodline, loadout, Hunt, and cloud
  synchronization.
- One-time v31 migration, revision checks, idempotent events, balance
  invariants, corrupt-save preservation, export/import, and local deletion.
- Regression tests and exact generated/archive equality checks.

## Development Workflow

1. Edit `games/vampire-survival-src/`.
2. Build and archive the current iteration:

   ```bash
   node tools/build-vampire-survival.mjs --archive
   ```

3. Run the local release suite:

   ```bash
   node --test tools/vampire-survival-profile.test.mjs
   node tools/site-contract-tests.mjs
   node tools/build-vampire-survival.mjs --check
   git diff --check
   ```

4. Exercise the `?test=1` browser adapter and responsive views.
5. Update the iteration archive, report, log, `CURRENT_STATE.md`, and
   `HANDOFF.md`.
6. Publish only from the canonical WSL repository and verify the authenticated
   public route before starting the next iteration.

## Next Iteration

Iteration 33 adds Campaign Night 1 and the connective loop:

- Feed and Dash available; Mist and Swarm visibly locked.
- Fixed night duration with a validated, clearly briefed cross quota.
- Atomic clear commit before rewards or progression can be shown.
- Vampire hop into the coffin, lid close, full restoration, reward summary,
  and preparation hub.
- Skippable repeat animation and a restrained reduced-motion transition.
- Two-depth Hunt preview proving difficulty can rise while night length stays
  fixed.

The full Iterations 32-40 sequence is recorded in
`games/vampire-survival-iterations/iterations-32-40-roadmap.md`.

## Known Scope Boundary

Gamepad movement/action polling is preserved. Full controller focus navigation
for the title menu, pause, future coffin, Bloodline, loadout, and modal surfaces
is scoped into the next UI work and is not claimed complete in Iteration 32.
