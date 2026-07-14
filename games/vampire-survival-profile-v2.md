# Vampire Survival Profile v2 Contract

Status: local contract implemented in Iteration 32; cloud attachment reserved
for Iteration 39

## Local Storage Keys

- Active profile: `vampire_survival_profile_v2`
- Untouched migration source: `vampire_survival_profile_v31`
- Latest corrupt active value preserved for recovery:
  `vampire_survival_profile_v2_recovery`

The active profile is the gameplay source of truth after a successful v31
migration. During the Iteration 31 rollback window, the retained legacy
fingerprint is checked so progress made on a rolled-back build can be
reconciled once when Iteration 32 returns.

## Schema

Profile v2 contains:

- `schemaVersion`, stable local `profileId`, monotonic `revision`, and
  `updatedAt`.
- Existing totals, best score/grade, score history, achievements, and settings.
- Campaign progress, per-night clears, ability unlocks, ending state, and any
  pending coffin outcome.
- Economy events, Bloodline allocation/purchases, and active talent loadout.
- Hunt unlock, best depth, and score records.
- Applied idempotency events and migration provenance.

Currency is derived from the sum of immutable economy events. It is never a
second mutable balance field. Negative derived balance and negative Bloodline
ranks are invalid.

## Load and Migration

The page first performs a read-only preview load. It does not create, migrate,
reconcile, or recover storage until the page owns the profile writer lease.

1. Load and normalize valid v2 when present.
2. If v2 is unreadable or violates invariants, preserve its exact raw text in
   the recovery key before fallback.
3. If valid v31 exists, migrate every aggregate, score, achievement, and
   setting, record a source fingerprint, write v2, and retain the untouched v31
   raw value.
4. Otherwise write a safe fresh active profile only after the exact corrupt raw
   value has been copied to the recovery key.

Migration is one-time unless the retained v31 fingerprint changes after a
rollback. In that case, deltas from the recorded legacy snapshot are merged
into v2 and the fingerprint/snapshot advance. Missing future nested fields are
filled from defaults; missing or invalid required progression fields are
rejected and recovered rather than silently reset.

## Transactions

- On browsers with Web Locks, the public game acquires the exclusive
  `vampire-survival-profile-writer` lease before any mutating load or save. A
  page hidden for navigation pauses and freezes its run. A page restored from
  the back/forward cache must acquire a new lease before Resume is enabled.
- Browsers without Web Locks cannot guarantee cross-tab serialization. The
  game remains available with a visible instruction to keep exactly one
  Vampire Survival tab open.
- Whole-profile saves compare the caller's expected revision with the stored
  revision and profile identity before writing.
- A successful save increments the revision once and updates the timestamp.
- On supported browsers, a stale tab cannot overwrite a newer profile because
  only the lease owner can play or write. Revision and profile-identity checks
  provide a second guard. Additive run/score/achievement progress and
  per-field setting changes can be rebased onto the latest revision;
  incompatible concurrent Bloodline or pending-coffin changes require explicit
  resolution.
- Every new score record has a stable per-run ID, so visually identical runs
  from separate tabs remain separate history entries.
- An unreadable active slot cannot be silently overwritten by an ordinary save.
- Reward and unlock mutations use stable event IDs. Applying an existing ID is
  a no-op and does not write or change currency.
- The caller object is normalized into a new value. A failed storage write does
  not mutate the caller's revision.

## Export, Import, and Clear

- Export returns normalized, human-readable JSON.
- Import accepts only a valid v2 profile and writes it as a whole value.
- A full user clear removes v2, v31, and recovery data before creating a fresh
  profile.
- Recovery data must never contain mailbox credentials, Cloudflare tokens, or
  one-time access codes.

## Future Cloud Contract

Cloud sync attaches behind the repository boundary; gameplay continues to read
and commit locally first.

Identity:

- The origin validates the Cloudflare Access assertion, issuer, audience,
  expiry, and signature.
- Account identity is derived server-side from issuer plus stable subject.
- Browser-supplied email is display metadata only and can never select another
  account.

Transport and concurrency:

- `GET` returns the whole profile with revision/ETag.
- `PUT` requires `If-Match` or an equivalent expected revision and an
  idempotency key.
- Stale revisions return a conflict; they are not last-write-wins.
- Retries of the same idempotency key return the original result.

Merge rules:

- Union immutable grant/unlock IDs and scores by stable run ID.
- Merge settings only with explicit per-field timestamps.
- Do not sum or take the maximum of currency balances. Recompute from validated
  event IDs.
- Do not silently union incompatible Bloodline allocations/loadouts. Present a
  deliberate local/cloud choice or a server-validated respec transaction.
- Never infer a clear, purchase, or reward from aggregate totals.

Offline behavior:

- A night starts and finishes against the local profile.
- Local clear commit is authoritative for continuation; cloud failure becomes a
  visible retryable sync state.
- Reconnect replay uses the original transaction/event IDs.
- Cloud downtime cannot block local play, export, or deletion of local data.

Privacy and lifecycle:

- Provide account profile export and deletion.
- Document retention, backup, restoration, and server-log redaction.
- Never store Access assertions, mailbox passwords, login links, or one-time
  codes in the profile or browser diagnostics.
- Private score history is in scope. A cheat-resistant public leaderboard is
  not part of this roadmap.
