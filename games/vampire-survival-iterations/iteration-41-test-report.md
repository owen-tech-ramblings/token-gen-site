# Vampire Survival Iteration 41 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and authenticated Access gates passed

## Artifact

- Live file and exact archive: 218,810 bytes
- Archive: `games/vampire-survival-iterations/iteration-41-codex.html`
- SHA-256:
  `1cfea85374e95166362b7dcc0208a773b875e7ad36bc3cb94560e29ecb67306b`
- Two consecutive builds were byte-identical. The generated live file is
  byte-identical to the archive and the source-freshness check passes.

## Player-Facing Changes

- Basic Hunt is available on a fresh profile. Mist, Swarm, and Ascension still
  require their Campaign milestones.
- The Hunt button names the exact next unbeaten depth. Clearing Depth 1,
  sleeping in the coffin, and returning to the title produces an enabled
  `Begin Hunt · Depth 2` action instead of restarting at Depth 1.
- The title now explains the selected mode, current Hunt mutator, next depth,
  and next ruler milestone before the player starts.
- Requirements, validation, implementation, and roadmap language was removed
  from the title, tutorial, Cloud Save, Campaign map, pact, coffin, Bloodline,
  loadout, result, and ending surfaces.
- While the title or Campaign map is open, the background HUD and game canvas
  are removed from the accessibility tree. They become focusable and exposed
  again only when a night starts.

## Automated Results

- 58/58 backend, cloud, profile, migration, persistence, Campaign, Hunt,
  progression, Bloodline, loadout, targeting, and hardening tests passed.
- Shared site contracts, all source-module syntax checks, generated-source
  freshness, deterministic builds, exact archive equality, and
  `git diff --check` passed.
- Static contracts reject the removed design phrases and require fresh Hunt
  access, next-depth selection, the visible Hunt briefing, and title-screen
  accessibility isolation.

## Browser Results

- A cleared profile showed an enabled `Begin Hunt · Depth 1` button and a
  briefing for Blood Famine, Depth 2, and the Depth 5 ruler.
- Hunt Depth 1 started with three crosses and the expected Blood Famine
  mutator. Its Campaign milestone techniques remained visibly locked.
- Forced dawn completed the coffin transition and restoration, recorded best
  depth 1, then exposed and started Hunt Depth 2 with Silver Rain.
- A rendered-copy audit opened the title, tutorial, Cloud Save, Campaign map,
  pact, coffin, Bloodline, and loadout. No banned design/spec phrases were
  present.
- The fresh Hunt title passed desktop, 768x1024, and 375x812 visual review. The
  start action remained prominent and usable at every size.
- The title accessibility snapshot contained only player-facing menu content;
  gameplay restored the HUD/canvas accessibility state and canvas focus.
- Local browser console remained clean.

## Rollback

- Published baseline: Iteration 40 release commit `540c4188d36a6eadf79a7f04734491e5e7eee3ce`.
- Static rollback: `iteration-40-codex.html`.

## Publication Evidence

- Release commit `561f3bd3c6d199069a16bda5c6da8779c13c7c4d` was pushed to
  both public and private `master` remotes.
- GitHub Pages workflow `29373432079` completed successfully for that exact
  commit.
- Direct GitHub Pages origin returned HTTP 200, 218,810 bytes, and SHA-256
  `1cfea85374e95166362b7dcc0208a773b875e7ad36bc3cb94560e29ecb67306b`.
- Public HTTPS retained the expected unauthenticated Cloudflare Access 302.
- Authenticated production reported Iteration 41, showed an enabled fresh
  `Begin Hunt · Depth 1` action and its full briefing, then started Hunt Depth
  1 with Blood Famine and three crosses.
- The production title hid the background HUD/canvas from assistive
  technology; starting Hunt restored both and focused the canvas. Cloud Save
  remained local-only, no remote profile was written, and the cleared
  production console remained error-free after reload and smoke.
