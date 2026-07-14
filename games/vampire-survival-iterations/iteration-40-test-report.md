# Vampire Survival Iteration 40 Test Report

Date: 2026-07-15 Australia/Sydney
Status: release candidate complete; publication verification pending

## Artifact

- Live file and exact archive: 218,870 bytes
- Archive: `games/vampire-survival-iterations/iteration-40-codex.html`
- SHA-256:
  `480c642170cbe2e69599d00e87409a84e0059782a7e8df2a159796cdab7fafb4`
- Two consecutive builds were byte-identical, and the generated live file is
  byte-identical to the archive.

## Final Hardening

- Controller support now covers menu focus, select changes, dialog dismissal,
  left-stick movement, right-stick aim, Feed, Dash, Swarm, Mist, Create Thrall,
  and pause. Button actions are edge-triggered while Feed remains holdable.
- Open dialogs isolate background content with `inert` and `aria-hidden`, trap
  Tab/Shift+Tab focus, and restore earlier attributes and focus on close.
- Keyboard focus uses a visible three-pixel outline. Buttons, selects, range
  controls, and setting labels meet a 44px target; coarse-pointer targets use
  48px. Mobile touch actions remain bounded and visible.
- App and system reduced-motion preferences settle the vampire inside the
  closed coffin without playing the hop/lid animations. High-contrast mode
  remains available from pause.
- Player-facing Bloodline text no longer exposes roadmap/development language.

## Campaign, Hunt, Profile, and Cloud Matrix

- Browser checks started every Campaign night from 1 through 15. Cross routes
  were unique, collision-free, and reachable within the fixed night budget;
  quotas rose from three to six while the night length stayed fixed.
- Hunt Depths 1, 5, 10, 15, 25, 100, 1,000, and 10,000 produced finite,
  reachable contracts. Pressure continues to rise while the cross quota caps
  at six and duration remains fixed.
- Fresh, migrated, corrupt, completed, concurrent, failed-save, and large valid
  profiles are covered. A stress profile with 1,500 economy events, 3,000 Hunt
  records, and oversized score history normalised below the cloud envelope.
- Cloud payloads are preflighted locally against 512 KiB. Oversized profiles
  stay local, keep their replay queue, and direct the player to Export.
- The backend returns 413 while safely consuming an oversized request stream;
  it does not destroy the connection or persist a partial profile.
- The exact backend source was copied to the runtime and restarted. The source
  and runtime SHA-256 are both
  `bef21820977609098cb25ff1f5df7234ef5b32e1fbb45ba9a8dbeae2796a4fbd`.

## Automated and Browser Results

- 58/58 backend, cloud client, profile, migration, persistence, concurrency,
  Campaign, Hunt, boss, ending, Bloodline, loadout, targeting, entity-cap, and
  hardening tests passed.
- Shared site contracts, all 12 source syntax checks, deterministic builds,
  generated-source freshness, exact archive equality, and `git diff --check`
  passed.
- Emulated controller results: menu focus and mode selection passed; B closed
  the cloud dialog; gameplay movement was 0.8, right-stick aim was correct,
  Dash triggered, and Start paused.
- A 180-second Nightmare Hunt simulation remained below the 108-enemy cap.
  Under the same warmed seven-sample harness, Iteration 40 measured a 67 ms
  p95 versus Iteration 39's 146 ms.
- Desktop, 768x1024, and 375x812 layouts passed visual inspection. The
  high-contrast pause dialog, visible focus, 44px setting target, background
  isolation, reduced-motion coffin path, and a clean local console passed.

## Authenticated Runtime Canaries

- A disposable production canary passed initial 404, create 201, idempotent
  replay 200, stale write 412, strong-ETag read 200, delete 200, and final 404.
- A separate 512 KiB-plus request returned 413 and the final read remained 404.
- Both canaries left the authenticated cloud account empty.

## Screenshots

- `iteration-40-hardening-mobile.png`
- `iteration-40-hardening-tablet.png`
- `iteration-40-hardening-desktop.png`
- `iteration-40-high-contrast.png`

## Rollback

- Published baseline: Iteration 39 release commit `77bb6d5`.
- Static rollback: `iteration-39-codex.html`.

## Publication Evidence

- Pending release commit, Pages workflow, exact-origin digest, Access check,
  and authenticated production smoke.
