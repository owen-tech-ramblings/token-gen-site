# Private generated artifact consumer

The root-reviewed NAS catalogue design is implemented in paired API PR #63.
This consumer work follows the owner's authorization to author directly from
GitHub in the isolated local checkout. Source base is aligned site master/dev
`3b913abce2383fe04dda6d9ffff2bc9a38c6a534`; no managed-worktree receipt is claimed.
The unrelated dirty `/home/zenfree/token-gen-site` checkout is preserved.

Retained image and 3D requests save a stable assistant placeholder before any
generation POST. Capture conversation/message IDs and matching retention once;
job completion stays attached to those IDs even if the visible conversation
changes. A failed private save blocks the request. None retention creates no
server conversation and sends only `artifact_context: {retention: "none"}`.
Every submitted sample retains one Idempotency-Key and body across its transport
choice; an ambiguous private submission never triggers a public fallback.

Extend the existing Access bridge with `artifacts`, authenticated `image` and
Agent `chat`, plus fixed `tts`/`video` job polling resources. Preserve credential stripping, signed assertion forwarding,
streaming, HEAD/ranges, and manual upstream redirects. Browser URLs for saved
artifacts are derived from validated IDs under `/api/private/artifacts`; do not
trust provider URLs, scopes, credentials or physical paths in artifact metadata.

Save minimal typed references and preserve stable existing message IDs. Hydrate
owner-supplied safe manifests from conversation/job reads, merge server-attached
references during optimistic-concurrency retries, and reconcile pending capture
without another generation. Provider completion and archive completion are
distinct. Render pending, saved, temporary, failed, deleted and expired states
honestly. Native video ZIP downloads use browser streaming, not whole-file JS
buffers. MP4 remains a labeled playback copy; audio/video/3D references remain
downloadable from reopened conversations.

The confirmed printer default is Snapmaker A350T, single extrusion with Quick
Swap, PLA and 0.4 mm nozzle, 320×335×310 mm usable volume and 0.08 mm fine layers.
Use the confirmed exact profile ID and verify its paired API availability; do
not invent an identifier or substitute the older non-Quick-Swap profile. The
closed ID is `snapmaker_a350t_quick_swap_single_pla_0_4_fine`, advertised in
TRELLIS.2 model `printer_profiles` and `stl.default_printer_profile`. Default
to that confirmed target even while unavailable. Block STL submission until
its advertised availability returns or the caller explicitly chooses generic
geometry. Repaired geometry is required for that target; explicit generic
geometry permits raw inspection. Never silently drop a selected target when
readiness changes; textured GLB remains usable. Expandable printer reports show
the actual dry-slice result, measured dimensions/build volume, layer/nozzle and
deposited-layer data when reported, plus closed readable printing limitations.
Use textContent and reject arbitrary report payloads/paths/tokens.

Artifact-only refresh hydrates private output metadata without advancing the
conversation revision or acknowledging unapplied remote message/text changes.

Existing chat, Agent, projects, native image conditioning, explicit image
controls, 3D identity/cancellation/verified partial downloads stay functional.
No generation is submitted on load, history, archive refresh or health checks.
No Worker deployment, Pages merge/deploy or paid generation is part of this
candidate. Root independently reviews the exact final source before release.
