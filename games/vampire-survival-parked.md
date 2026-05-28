# Vampire Survival Parked State

Status: parked after Codex iteration 25
Live page: `/games/vampire-survival.html`
Last commit before parking: `71c0ff7 Codex Vampire Survival iteration 25`
Date parked: 2026-05-28

## Current State

Vampire Survival is a standalone HTML canvas game. It is intentionally kept live on the Token Gen games page so it can be tested later without re-deploying.

The current build includes:

- Large city map with camera and procedural districts.
- Story objective: break three Sun Reliquaries before dawn.
- Enemy roles: villagers, guards, hunters, priests, and captains.
- Player abilities: feed, dash, mist form, and Bat Swarm.
- Minimap and objective compass.
- High scores in `localStorage`.
- Dawn timer, blood rose pickups, combo scoring, procedural audio cues, particles, screen shake, relic events, and escalating threat.

## Resume Workflow

To continue the experiment later:

1. Open `games/vampire-survival.html`.
2. Make the next pass as `Codex Iteration 26` or hand it back to Token Gen/Qwen as the current seed.
3. Run the same lightweight validation used during the experiment:

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('games/vampire-survival.html','utf8'); const js=[...html.matchAll(/<script[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]).join('\\n'); new Function(js); console.log('syntax ok', html.length)"
```

4. Run a simulated start/runtime check or browser check.
5. Commit and push each accepted iteration.

## Suggested Next Iterations

- Add a real pause/settings panel with audio toggle and difficulty selection.
- Add a short tutorial overlay for the first run.
- Improve collision with buildings and relic areas.
- Add boss-specific patterns for Captain Voss.
- Add more distinct district biomes, such as Cathedral, Docks, Slums, Gardens, and Palace.
- Add mobile touch controls if the game should be playable on phones.
- Add persistent achievements alongside high scores.
- Tune balance from 2-3 minutes of manual playtesting.

## Notes

The current page is self-contained and uses no remote assets or external libraries. That keeps it easy to archive, fork, or feed into a local VLLM model for future iteration.
