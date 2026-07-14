# Vampire Survival Iteration 35 Test Report

Date: 2026-07-15 Australia/Sydney
Status: published; exact production origin and Access gates passed

## Artifact

- Generated live file: `games/vampire-survival.html`
- Exact archive: `games/vampire-survival-iterations/iteration-35-codex.html`
- Bytes: 158,067
- SHA-256:
  `0a8977e35c21225b11e46dfd5b94e3793470dc2017e6790a17092696587ddab9`
- Two consecutive archive builds produced byte-identical live and archive
  files.

## Automated Results

- 36/36 runtime, progression, profile, migration, concurrency, economy,
  Bloodline, Campaign, Hunt, and entity-cap tests passed.
- Bloodline coverage proves the three three-node branches, prerequisite
  validation, exact purchase debit, duplicate rejection, one-step undo, free
  full respec, immutable base stats, and failed-save currency safety.
- Shared site contracts passed for the exact Iteration 35 archive, all nine
  nodes, transaction helpers, derived run stats, coffin dialog, narrow-layout
  tabs, and eight accessible modal surfaces.
- Every source and test module passed `node --check`; the build-current and
  `git diff --check` gates passed.

## Bloodline Browser Results

Harness: persistent Chromium using the generated standalone artifact with
`?test=1` and an artificial local profile.

- A first Campaign clear banked one Blood Pack and exposed Bloodline only from
  the coffin hub.
- The desktop tree showed Crimson Hunger, Moonstride, and Nightborn Arts at
  once. Each node displayed cost, prerequisite state, current effect, next
  effect, rank, and flavor copy.
- Opening the tree placed keyboard focus on the first purchasable visible node,
  not the desktop-hidden tab strip.
- Buying Crimson Reservoir debited exactly one pack and changed the saved
  allocation, but left the already-finished run at 112 maximum Blood.
- Starting the next night derived a fresh player at 124 maximum Blood with the
  active node listed in the run snapshot. Base definitions remained unchanged.
- After the second first-clear reward, buying Predator's Teeth, undoing it,
  repurchasing it, and performing a free respec returned the exact two-pack
  balance and cleared every active purchase. The immutable economy ledger was
  `+1,-1,+1,-1,+1,-1,+2` across those actions.
- The test-only forced-dawn helper was corrected to clear pending pact/hit-stop
  state, so authored lieutenant clears deterministically reach the coffin.
- No unexpected browser console errors occurred.

## Responsive and Accessibility Matrix

| View | Result | Evidence |
| --- | --- | --- |
| 1280x720 three-branch tree | Pass | `iteration-35-bloodline-desktop.png` |
| 375x812 branch tabs and vertical path | Pass | `iteration-35-bloodline-mobile.png` |

At 375x812 all three tabs fit inside the 337-pixel panel, the panel's scroll
width equals its client width, and only the selected branch is visible. The
tree remains vertically scrollable, the active tab has non-color state, and
the node action retains a visible keyboard focus indicator.

## Performance and Bounded State

- Three Nightmare Hunt Depth 12 simulations each advanced 180 seconds at
  30 Hz while remaining active at the 108-enemy cap.
- Timings were 1,277 ms, 1,130 ms, and 1,018 ms in the persistent browser
  harness. Bloodline logic does not run in the frame loop.
- No run-time collection cap or persistence behavior regressed.

## Release-Blocker Review

- Rejected prerequisites and duplicate purchases do not mutate the draft.
- A failed profile write leaves the stored two-pack balance untouched.
- Undo only reverses the latest active leaf; respec refunds exactly the cost of
  all active nodes and charges no fee.
- Unknown nodes, orphaned purchases, missing prerequisites, duplicate
  transaction IDs, and stale undo/counter state are rejected by normalisation.
- Permanent upgrades are optional: all Chapter I routes and objectives retain
  their validated base-stat path.

## Rollback

- Known-good published gameplay baseline: Iteration 34 commit `dbf837f`.
- Static rollback artifact:
  `games/vampire-survival-iterations/iteration-34-codex.html`.

## Publication Evidence

- Release commit `d59a90783ccdd1aeafc2f4021eeefee564d83bff` was pushed to both public and
  private `master` remotes.
- GitHub Pages build `1095252135` completed successfully for that exact commit.
- A direct Pages-origin request returned HTTP 200, 158,067 bytes, and SHA-256
  `0a8977e35c21225b11e46dfd5b94e3793470dc2017e6790a17092696587ddab9`.
- Unauthenticated public HTTPS returned the expected Cloudflare Access 302.
- The authenticated Windows helper remained unavailable, so no unsafe
  foreground automation or broad cookie copy was attempted. The release used
  exact-origin artifact proof plus the full generated-artifact browser gate;
  no production profile, credentials, mailbox, or Cloudflare state changed.
