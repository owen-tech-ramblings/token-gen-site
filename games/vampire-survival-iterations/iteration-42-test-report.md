# Vampire Survival Iteration 42 Test Report

Date: 2026-07-15 Australia/Sydney
Status: release candidate passed; publication pending

## Artifact

- Live file and exact archive: 461,813 bytes
- Archive: `games/vampire-survival-iterations/iteration-42-codex.html`
- SHA-256:
  `e591395c1f6efbf71470b48b7e7eb3c00d1b56c283d0b7715e59ab3890df5fe5`
- Two consecutive builds were byte-identical. The generated live file is
  byte-identical to the archive and the source-freshness check passes.
- The 174,956-byte transparent WebP lid is embedded as a data URI, so the
  published game remains a single self-contained HTML file.

## Player-Facing Changes

- The dawn transition now uses an ornate burgundy, black, antique-gold, and
  ruby coffin lid over a velvet-lined coffin base.
- Moonbeams, stars, bats, candles, ground mist, and a gold sealing pulse give
  the scene more depth while keeping the vampire and coffin readable.
- The vampire has a face, glowing eyes, formal shirt, and layered cape instead
  of the previous single flat polygon.
- The hop, disappearance into the coffin, lid close, and sealing pulse are
  synchronized inside the existing four-second skippable transition.
- Mobile layouts use a shorter, centered scene. App and system reduced-motion
  modes show the settled closed coffin with no running animations.

## Generated Asset

- Final source asset:
  `games/vampire-survival-assets/coffin-lid-v42.webp`
- Dimensions: 300 by 480 pixels with transparent corners.
- Generation mode: built-in image generation tool.
- A flat chroma background was removed with the image-generation skill's
  supplied helper, then the result was cropped, resized, and encoded as
  lossless WebP.

## Automated Results

- 58/58 backend, cloud, profile, migration, persistence, Campaign, Hunt,
  progression, Bloodline, loadout, targeting, and hardening tests passed.
- Shared site contracts, source-module syntax checks, generated-source
  freshness, deterministic builds, exact archive equality, WebP signature
  checks, and `git diff --check` passed.
- Static contracts require the embedded WebP and seal effect while rejecting
  unresolved asset markers and external coffin-asset paths.

## Browser Results

- Desktop review captured the open coffin during the hop, the lid in flight,
  the fully closed ornate lid, and the sealing pulse.
- At 375x812, the complete closed coffin, moon, candles, bats, and Skip to Rest
  action remained centered and visible without horizontal overflow.
- Reduced-motion review reported zero running scene animations, a closed lid,
  no exposed vampire, and `animation-name: none` for the vampire and lid.
- A real Night 1 Story victory entered `coffin-transition` with the new
  animation. Skip to Rest moved to `coffin-hub`, retained the committed
  first-clear outcome, restored Blood, and exposed the next-night action.
- The local browser console remained clean.

## Rollback

- Published baseline: Iteration 41 release commit
  `561f3bd3c6d199069a16bda5c6da8779c13c7c4d`.
- Static rollback: `iteration-41-codex.html`.

## Publication Evidence

- Pending release commit, GitHub Pages workflow, exact-origin digest, public
  Access response, and authenticated production smoke.
