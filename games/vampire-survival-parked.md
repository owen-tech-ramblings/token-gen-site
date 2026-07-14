# Vampire Survival Development State

Status: active; Iteration 33 locally verified and entering publication
Live page: `/games/vampire-survival.html`
Previous published build: Iteration 32, 2026-07-14
Current archive candidate: `games/vampire-survival-iterations/iteration-33-codex.html`

## Current State

Vampire Survival remains a self-contained HTML canvas game, but its editable
source now lives in `games/vampire-survival-src/`. The deterministic build
inlines that source into the live HTML and the matching iteration archive.

Iteration 33 turns the vertical slice into the first connected progression
loop:

- A large procedural city with five districts, camera, minimap, and compass.
- Campaign Night 1 with an exact three-cross objective and specific failure if
  dawn arrives before every cross is broken.
- Hunt Depths 1 and 2 with the same night length and quota, but a materially
  harder second depth through patrol composition, elites, pressure, health, and
  damage.
- Villagers, guards, hunters, priests, captains, and elite variants.
- Feed and Dash at the start, with Mist and Swarm shown as milestone-locked.
- A vampire hop into the coffin, closing lid, full restoration, reward summary,
  progression entry point, Rise, and Leave choices.
- Desktop keyboard/mouse, touch controls, gamepad gameplay polling, reduced
  motion, high contrast, settings, local scores, and achievements.

The profile and objective contract enforce:

- One atomic commit for the run result, first-clear reward, Night 2 unlock, and
  resumable pending coffin outcome.
- Exactly one finite first-clear Blood Pack and no replay farming.
- No coffin bypass after a save failure.
- A pending coffin result that resumes after reload.
- A skippable four-second transition and a short reduced-motion alternative.

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

Iteration 34 delivers Chapter I:

- Distinct Nights 2-5 encounters and objectives.
- Lieutenant finishes followed by the Night 5 Captain Voss milestone.
- Mist unlocked exactly once after Voss.
- Full escalating Hunt with fixed-duration nights, coffin intermissions, score
  pressure, personal-best depth, bosses, and the initial cross cadence
  `3,3,4,4,4,5,5,6,6,6...`.

The full Iterations 32-40 sequence is recorded in
`games/vampire-survival-iterations/iterations-32-40-roadmap.md`.

## Known Scope Boundary

Gamepad movement/action polling is preserved. Full controller focus navigation
for the title menu, pause, coffin, future Bloodline/loadout, and modal surfaces
is not yet claimed complete.
