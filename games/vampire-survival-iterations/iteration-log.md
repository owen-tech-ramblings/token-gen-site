# Vampire Survival Qwen Iterations

Model: /home/zenfree/token_gen_server/vllm/models/Qwen-Qwen3.6-27B-FP8

Seed: /mnt/c/Users/User/Documents/vampire_game.html

## Iteration 1

Accepted Qwen pass 1. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 20657

## Iteration 2

Accepted Qwen pass 2. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 25698

## Iteration 3

Accepted Qwen pass 3. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 33420

## Iteration 4

Accepted Qwen pass 4. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 41087

## Iteration 5

Accepted Qwen pass 5. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 50412

## Iteration 6

Accepted Qwen pass 6. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 17416

## Iteration 7

Accepted Qwen pass 7. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 25518

## Iteration 8

Accepted Qwen pass 8. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 32902

## Iteration 9

Accepted Qwen pass 9. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 36490

## Iteration 10

Accepted Qwen pass 10. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics.

Bytes: 19728

## Iteration 11

Accepted Qwen pass 11. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 27614

## Iteration 12

Accepted Qwen pass 12. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 31874

## Iteration 13

Accepted Qwen pass 13. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 34224

## Iteration 14

Accepted Qwen pass 14. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 39254

## Iteration 15

Accepted Qwen pass 15. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 23293

## Iteration 16

Accepted Qwen pass 16. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 30772

## Iteration 17

Accepted Qwen pass 17. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 37167

## Iteration 18

Accepted Qwen pass 18. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 18249

## Iteration 19

Accepted Qwen pass 19. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 21027

## Iteration 20

Accepted Qwen pass 20. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.

Bytes: 21355


## Iteration 31

Accepted ChatGPT/Codex pass 31 on 2026-07-10. Published as the current live build and archived as `iteration-31-codex.html`.

Validation focus: syntax extraction, headless start/tick harness, browser smoke, responsive canvas resize, and archive link hygiene. Status/report page added as `iteration-26-31-status.html`; screenshots added as `iteration-31-gameplay.png` and `iteration-31-boss.png`.

Bytes: 64189

## Iteration 32

Accepted and published Codex foundation pass 32 on 2026-07-14 at release
commit `abf7cd3`. The standalone artifact is generated from modular source, uses
profile schema v2 with one-time v31 migration and corrupt-save recovery, and
retains the Iteration 31 gameplay path.

Review also fixed the enemy-cap overflow loop. Automated profile/content tests,
site contracts, deterministic build checks, a real-browser victory path,
responsive checks, persistence migration, and an entity-cap soak passed.

Snapshot: `iteration-32-codex.html`

SHA-256: `0e058d4c0dccf3d63ccaf29371e42846ef8173b5e74ac1cc18d1dea73b36e3dd`

Bytes: 101657

## Iteration 33

Accepted local Codex release candidate 33 on 2026-07-15. Campaign Night 1 now
uses an exact fixed-duration objective contract, Feed/Dash start unlocked, and
Mist/Swarm show their Night 5/Night 10 milestone locks. A successful night
commits the run, one-time reward, next-night unlock, and resumable pending
outcome atomically before the vampire hops into the coffin and closes its lid.

The coffin restores Blood and cooldowns, shows the reward/progression summary,
and offers Rise or Leave. The transition is skippable and has a reduced-motion
path. Hunt Depth 2 keeps Depth 1's duration and three-cross quota while raising
composition, elites, director pressure, health, and damage.

Thirty automated tests, site contracts, a deterministic double-build, browser
Campaign/Hunt/save/reload/accessibility flows, phone layouts, 40 route checks,
and a 180-second 108-enemy soak passed.

Snapshot: `iteration-33-codex.html`

SHA-256: `bb0fc35cb5a7bf8c9dbd1477abf46677c3dfc54e6da195ff08de7f611f0239db`

Bytes: 128322

## Active Roadmap

The experiment is active. Iteration 32 is published, Iteration 33 is locally
release-verified, and Iterations 34-40 are planned. Publication and the
authenticated Iteration 33 production canary are the remaining gate before
Chapter I begins.

- Current live build: `games/vampire-survival.html`
- Snapshot: `games/vampire-survival-iterations/iteration-33-codex.html`
- Roadmap: `games/vampire-survival-iterations/iterations-32-40-roadmap.md`
- Status notes: `games/vampire-survival-iterations/iteration-33-status.html`, `games/vampire-survival-parked.html`, and `games/vampire-survival-parked.md`
