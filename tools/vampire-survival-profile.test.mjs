import assert from "node:assert/strict";
import test from "node:test";

import { BUILD, createRunSeed, hashText, mulberry32, trimEntityOverflow } from "../games/vampire-survival-src/runtime.mjs";
import { ACHIEVEMENTS, DIFFICULTIES, DISTRICTS, ENEMY_TYPES, PACTS, WORLD } from "../games/vampire-survival-src/content.mjs";
import {
  ABILITY_RULES,
  CAMPAIGN_NIGHTS,
  HUNT_PREVIEW_DEPTHS,
  abilityAvailability,
  campaignClearEventId,
  clearPendingCoffinOutcome,
  createRunContract,
  recordProfileRunOutcome,
} from "../games/vampire-survival-src/progression.mjs";
import {
  LEGACY_PROFILE_STORAGE_KEY,
  MAX_SCORE_HISTORY,
  PROFILE_RECOVERY_STORAGE_KEY,
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  createProfileRepository,
  freshProfileV2,
  migrateLegacyProfile,
  mergeConcurrentProfiles,
  normaliseProfileV2,
  profileBalance,
  reconcileLegacyRollback,
} from "../games/vampire-survival-src/profile.mjs";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.failWrites = false;
    this.failKeys = new Set();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites || this.failKeys.has(key)) throw new Error("storage denied");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const fixedNow = () => "2026-07-14T09:00:00.000Z";
const fixedId = () => "local:test-profile";

function legacyProfile(overrides = {}) {
  return {
    version: 1,
    totalRuns: 7,
    totalWins: 3,
    totalScore: 9876,
    bestScore: 4321,
    bestGrade: "A",
    achievements: ["first_blood", "voss"],
    scores: [{ score: 4321, time: 180, grade: "A", win: true, difficulty: "night", date: "2026-07-13" }],
    settings: { audio: false, shake: true, particles: false, contrast: true, reducedMotion: true },
    ...overrides,
  };
}

test("iteration 33 runtime and content contracts remain complete", () => {
  assert.equal(BUILD.iteration, 33);
  assert.equal(BUILD.profileSchema, 2);
  assert.equal(PROFILE_SCHEMA_VERSION, 2);
  assert.equal(Object.keys(DIFFICULTIES).length, 3);
  assert.equal(DISTRICTS.length, 5);
  assert.equal(Object.keys(ENEMY_TYPES).length, 6);
  assert.equal(PACTS.length, 12);
  assert.equal(Object.keys(ACHIEVEMENTS).length, 7);
  assert.deepEqual(WORLD, { w: 3200, h: 2200 });
  const first = mulberry32(hashText("stable-seed"));
  const second = mulberry32(hashText("stable-seed"));
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  const clock = { now: () => new Date("2026-07-14T23:59:59.000Z"), timestamp: () => 1234, entropy: () => 0.25 };
  assert.equal(createRunSeed("daily", clock), "daily:2026-07-14");
  assert.equal(createRunSeed("standard", clock), "standard:1234:0.25");
  assert.notEqual(createRunSeed("daily", { now: () => new Date("2026-07-15T00:00:00.000Z") }), createRunSeed("daily", clock));
});

test("Campaign Night 1 and both Hunt preview depths keep authored fixed-duration contracts", () => {
  assert.equal(Object.keys(CAMPAIGN_NIGHTS).length, 1);
  assert.equal(Object.keys(HUNT_PREVIEW_DEPTHS).length, 2);
  const campaign = createRunContract({ mode: "campaign", campaignNight: 1, difficulty: DIFFICULTIES.night });
  const depthOne = createRunContract({ mode: "hunt", huntDepth: 1, difficulty: DIFFICULTIES.night });
  const depthTwo = createRunContract({ mode: "hunt", huntDepth: 2, difficulty: DIFFICULTIES.night });
  assert.equal(campaign.crossQuota, 3);
  assert.equal(campaign.crossPoints.length, campaign.crossQuota);
  assert.equal(new Set(campaign.crossPoints.map((point) => point.join(":"))).size, campaign.crossQuota);
  assert.equal(depthOne.dawn, depthTwo.dawn);
  assert.equal(depthOne.crossQuota, depthTwo.crossQuota);
  assert.ok(depthTwo.pressure > depthOne.pressure);
  assert.ok(depthTwo.enemyHp > depthOne.enemyHp);
  assert.ok(depthTwo.eliteBonus > depthOne.eliteBonus);
  assert.throws(() => createRunContract({ mode: "campaign", campaignNight: 2, difficulty: DIFFICULTIES.night }), /not playable/);
  assert.throws(() => createRunContract({ mode: "hunt", huntDepth: 3, difficulty: DIFFICULTIES.night }), /outside the preview/);
});

test("ability states prioritize milestone locks, cooldowns, Blood costs, then readiness", () => {
  assert.equal(ABILITY_RULES.mist.cost, 10);
  assert.deepEqual(abilityAvailability("mist", { unlocked: false, cooldown: 4, blood: 0 }), {
    state: "locked", label: "Defeat the Night 5 boss", ready: false, cost: 10,
  });
  assert.deepEqual(abilityAvailability("mist", { unlocked: true, cooldown: 4.25, blood: 100 }), {
    state: "cooldown", label: "4.3s", ready: false, cost: 10,
  });
  assert.deepEqual(abilityAvailability("swarm", { unlocked: true, cooldown: 0, blood: 15 }), {
    state: "insufficient", label: "Need 16 Blood", ready: false, cost: 16,
  });
  assert.deepEqual(abilityAvailability("dash", { unlocked: true, cooldown: 0, blood: 0 }), {
    state: "ready", label: "Ready", ready: true, cost: 0,
  });
  assert.deepEqual(abilityAvailability("feed", { unlocked: true, cooldown: 0.18, blood: 0 }), {
    state: "cooldown", label: "0.2s", ready: false, cost: 0,
  });
  assert.deepEqual(abilityAvailability("dash", { unlocked: true, cooldown: 0, blood: -1 }), {
    state: "ready", label: "Ready", ready: true, cost: 0,
  });
});

test("Campaign clear outcome grants one finite reward and creates a resumable coffin outcome", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  const firstOutcome = {
    runId: "run:first", mode: "campaign", campaignNight: 1, huntDepth: null,
    score: 2500, time: 225, grade: "A", win: true, difficulty: "night",
  };
  const first = recordProfileRunOutcome(profile, firstOutcome, fixedNow());
  assert.equal(first.recorded, true);
  assert.equal(first.firstClear, true);
  assert.equal(profile.totalRuns, 1);
  assert.equal(profile.totalWins, 1);
  assert.equal(profile.campaign.unlockedNight, 2);
  assert.equal(profileBalance(profile), 1);
  assert.equal(profile.campaign.pendingCoffinOutcome.bloodPacks, 1);
  assert.ok(profile.appliedEvents[campaignClearEventId(1)]);

  const duplicate = recordProfileRunOutcome(profile, firstOutcome, fixedNow());
  assert.equal(duplicate.recorded, false);
  assert.equal(profile.totalRuns, 1);
  assert.equal(profileBalance(profile), 1);

  const replay = recordProfileRunOutcome(profile, { ...firstOutcome, runId: "run:replay", score: 3000 }, fixedNow());
  assert.equal(replay.recorded, true);
  assert.equal(replay.firstClear, false);
  assert.equal(profile.totalRuns, 2);
  assert.equal(profileBalance(profile), 1);
  assert.equal(profile.campaign.pendingCoffinOutcome.bloodPacks, 0);
  assert.equal(clearPendingCoffinOutcome(profile, replay.runEventId), true);
  assert.equal(profile.campaign.pendingCoffinOutcome, null);
  assert.equal(clearPendingCoffinOutcome(profile, replay.runEventId), false);
});

test("Hunt outcomes advance only the cleared preview depth and never award Campaign currency", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  const first = recordProfileRunOutcome(profile, {
    runId: "run:hunt-1", mode: "hunt", campaignNight: null, huntDepth: 1,
    score: 1900, time: 225, grade: "B", win: true, difficulty: "night",
  }, fixedNow());
  assert.equal(first.coffinOutcome.nextDepth, 2);
  assert.equal(profile.hunt.bestDepth, 1);
  assert.equal(profileBalance(profile), 0);
  const second = recordProfileRunOutcome(profile, {
    runId: "run:hunt-2", mode: "hunt", campaignNight: null, huntDepth: 2,
    score: 2800, time: 225, grade: "A", win: true, difficulty: "night",
  }, fixedNow());
  assert.equal(second.coffinOutcome.nextDepth, null);
  assert.equal(profile.hunt.bestDepth, 2);
  assert.equal(profile.hunt.scores["depth-2"].score, 2800);
  assert.equal(profileBalance(profile), 0);
});

test("enemy overflow trimming removes only the farthest live excess and preserves the boss", () => {
  const boss = { id: "boss", x: 1000, y: 1000, dead: false };
  const alreadyDead = { id: "dead", x: 2000, y: 2000, dead: true };
  const enemies = [
    boss,
    { id: "near", x: 10, y: 0, dead: false },
    { id: "middle", x: 20, y: 0, dead: false },
    { id: "far", x: 30, y: 0, dead: false },
    alreadyDead,
  ];
  const removed = trimEntityOverflow(enemies, 3, { x: 0, y: 0 }, boss);
  assert.equal(removed, 1);
  assert.equal(enemies.filter((enemy) => !enemy.dead).length, 3);
  assert.equal(enemies.find((enemy) => enemy.id === "far").dead, true);
  assert.equal(enemies.find((enemy) => enemy.id === "middle").dead, false);
  assert.equal(boss.dead, false);
  assert.equal(alreadyDead.dead, true);
});

test("fresh profile starts Campaign with milestone abilities locked", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  assert.equal(profile.schemaVersion, 2);
  assert.equal(profile.profileId, fixedId());
  assert.equal(profile.campaign.unlockedNight, 1);
  assert.equal(profile.campaign.abilityUnlocks.mist, false);
  assert.equal(profile.campaign.abilityUnlocks.swarm, false);
  assert.deepEqual(profile.bloodline.loadout, []);
  assert.equal(profile.hunt.unlocked, true);
  assert.equal(profile.revision, 0);
  assert.equal(profileBalance(profile), 0);
});

test("v31 migration preserves scores, achievements, totals and settings", () => {
  const raw = JSON.stringify(legacyProfile());
  const migrated = migrateLegacyProfile(raw, { profileId: fixedId(), now: fixedNow() });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.totalRuns, 7);
  assert.equal(migrated.totalWins, 3);
  assert.equal(migrated.totalScore, 9876);
  assert.equal(migrated.bestScore, 4321);
  assert.equal(migrated.bestGrade, "A");
  assert.deepEqual(migrated.achievements, ["first_blood", "voss"]);
  assert.deepEqual(migrated.scores, legacyProfile().scores);
  assert.equal(migrated.settings.audio, false);
  assert.equal(migrated.settings.contrast, true);
  assert.equal(migrated.migration.sourceVersion, 1);
  assert.match(migrated.migration.sourceFingerprint, /^[0-9a-f]{8}$/);
  assert.equal(migrated.migration.sourceSnapshot.totalRuns, 7);
});

test("repository migrates legacy once and retains the untouched v31 raw value", () => {
  const raw = JSON.stringify(legacyProfile());
  const storage = new MemoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: raw });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const first = repository.load();
  const storedV2 = storage.getItem(PROFILE_STORAGE_KEY);
  assert.equal(storage.getItem(LEGACY_PROFILE_STORAGE_KEY), raw);
  assert.equal(repository.diagnostics().source, "v31");
  assert.equal(repository.diagnostics().migrated, true);
  assert.ok(storedV2);

  const secondRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const second = secondRepository.load();
  assert.equal(secondRepository.diagnostics().source, "v2");
  assert.deepEqual(second, first);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), storedV2);
});

test("read-only preview loads never create, migrate, reconcile, or recover storage", () => {
  const emptyStorage = new MemoryStorage();
  const emptyRepository = createProfileRepository(emptyStorage, { now: fixedNow, makeId: fixedId });
  const freshPreview = emptyRepository.load({ readOnly: true });
  assert.equal(freshPreview.profileId, fixedId());
  assert.equal(emptyStorage.getItem(PROFILE_STORAGE_KEY), null);

  const rawLegacy = JSON.stringify(legacyProfile());
  const legacyStorage = new MemoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: rawLegacy });
  const legacyRepository = createProfileRepository(legacyStorage, { now: fixedNow, makeId: fixedId });
  const migrationPreview = legacyRepository.load({ readOnly: true });
  assert.equal(migrationPreview.totalRuns, 7);
  assert.equal(legacyStorage.getItem(PROFILE_STORAGE_KEY), null);

  const corruptRaw = "{broken";
  const corruptStorage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: corruptRaw,
    [LEGACY_PROFILE_STORAGE_KEY]: rawLegacy,
  });
  const corruptRepository = createProfileRepository(corruptStorage, { now: fixedNow, makeId: fixedId });
  corruptRepository.load({ readOnly: true });
  assert.equal(corruptStorage.getItem(PROFILE_STORAGE_KEY), corruptRaw);
  assert.equal(corruptStorage.getItem(PROFILE_RECOVERY_STORAGE_KEY), null);

  const active = migrateLegacyProfile(rawLegacy, { profileId: fixedId(), now: fixedNow() });
  const rollbackRaw = JSON.stringify(legacyProfile({ totalRuns: 9 }));
  const rollbackStorage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify(active),
    [LEGACY_PROFILE_STORAGE_KEY]: rollbackRaw,
  });
  const rollbackRepository = createProfileRepository(rollbackStorage, { now: fixedNow, makeId: fixedId });
  const rollbackPreview = rollbackRepository.load({ readOnly: true });
  assert.equal(rollbackPreview.totalRuns, 9);
  assert.equal(rollbackStorage.getItem(PROFILE_STORAGE_KEY), JSON.stringify(active));
});

test("first load persists one revision-zero identity for every newly opened tab", () => {
  const storage = new MemoryStorage();
  const first = createProfileRepository(storage, { now: fixedNow, makeId: () => "local:first" }).load();
  const second = createProfileRepository(storage, { now: fixedNow, makeId: () => "local:second" }).load();
  assert.equal(first.profileId, "local:first");
  assert.equal(second.profileId, "local:first");
  assert.equal(second.revision, 0);
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).profileId, "local:first");
});

test("valid v2 takes precedence over legacy and missing nested fields are normalised", () => {
  const v2 = freshProfileV2({ profileId: fixedId() });
  delete v2.campaign.abilityUnlocks.createThrall;
  const storage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify(v2),
    [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify(legacyProfile({ totalRuns: 99 })),
  });
  const loaded = createProfileRepository(storage, { now: fixedNow, makeId: fixedId }).load();
  assert.equal(loaded.totalRuns, 0);
  assert.equal(loaded.campaign.abilityUnlocks.createThrall, false);
});

test("corrupt v2 falls back to valid v31 without deleting either raw value", () => {
  const rawV2 = "{broken";
  const rawLegacy = JSON.stringify(legacyProfile());
  const storage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: rawV2,
    [LEGACY_PROFILE_STORAGE_KEY]: rawLegacy,
  });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.totalRuns, 7);
  assert.equal(storage.getItem(LEGACY_PROFILE_STORAGE_KEY), rawLegacy);
  assert.equal(JSON.parse(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY)).raw, rawV2);
  assert.equal(repository.diagnostics().source, "v31");
  assert.match(repository.diagnostics().recoverableError, /JSON/);
});

test("corrupt inputs produce a safe fresh profile while raw recovery data remains", () => {
  const storage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: "not-json",
    [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify({ version: 1, achievements: null, scores: null }),
  });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.schemaVersion, 2);
  assert.equal(loaded.totalRuns, 0);
  assert.equal(JSON.parse(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY)).raw, "not-json");
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).schemaVersion, 2);
  assert.ok(storage.getItem(LEGACY_PROFILE_STORAGE_KEY));
});

test("invalid required v31 aggregates are retained instead of silently reset", () => {
  const invalidLegacy = JSON.stringify(legacyProfile({ totalRuns: "7" }));
  const storage = new MemoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: invalidLegacy });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.totalRuns, 0);
  assert.equal(storage.getItem(LEGACY_PROFILE_STORAGE_KEY), invalidLegacy);
  assert.match(repository.diagnostics().recoverableError, /totalRuns/);
});

test("failed corrupt-v2 recovery copy prevents legacy migration from overwriting the raw slot", () => {
  const rawV2 = "{broken";
  const storage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: rawV2,
    [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify(legacyProfile()),
  });
  storage.failKeys.add(PROFILE_RECOVERY_STORAGE_KEY);
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.totalRuns, 7);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), rawV2);
  assert.equal(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY), null);
  assert.equal(repository.diagnostics().source, "v31-volatile");
});

test("failed fresh-profile persistence is diagnosed as volatile", () => {
  const rawV2 = "{broken";
  const storage = new MemoryStorage({ [PROFILE_STORAGE_KEY]: rawV2 });
  storage.failKeys.add(PROFILE_RECOVERY_STORAGE_KEY);
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.schemaVersion, 2);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), rawV2);
  assert.equal(repository.diagnostics().source, "fresh-volatile");
  assert.match(repository.diagnostics().recoverableError, /recovery copy could not be written/);
});

test("parseable malformed v2 is preserved before a safe active profile replaces it", () => {
  const malformed = freshProfileV2({ profileId: fixedId() });
  malformed.totalRuns = "7";
  const raw = JSON.stringify(malformed);
  const storage = new MemoryStorage({ [PROFILE_STORAGE_KEY]: raw });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  assert.equal(loaded.totalRuns, 0);
  assert.equal(JSON.parse(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY)).raw, raw);
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).totalRuns, 0);
  assert.match(repository.diagnostics().recoverableError, /totalRuns/);
});

test("rollback play is reconciled when the retained v31 fingerprint changes", () => {
  const storage = new MemoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify(legacyProfile()) });
  const firstRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const v2Progress = firstRepository.load();
  v2Progress.totalRuns += 1;
  v2Progress.totalWins += 1;
  v2Progress.totalScore += 1000;
  firstRepository.save(v2Progress);

  const rollbackProgress = legacyProfile({
    totalRuns: 8,
    totalWins: 4,
    totalScore: 10076,
    achievements: ["first_blood", "voss", "daily"],
  });
  storage.setItem(LEGACY_PROFILE_STORAGE_KEY, JSON.stringify(rollbackProgress));
  const reloaded = createProfileRepository(storage, { now: fixedNow, makeId: fixedId }).load();
  assert.equal(reloaded.totalRuns, 9);
  assert.equal(reloaded.totalWins, 5);
  assert.equal(reloaded.totalScore, 11076);
  assert.ok(reloaded.achievements.includes("daily"));
  assert.equal(reloaded.migration.sourceSnapshot.totalRuns, 8);
});

test("save increments revision atomically and leaves the caller unchanged on failure", () => {
  const storage = new MemoryStorage();
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const original = freshProfileV2({ profileId: fixedId() });
  const saved = repository.save(original);
  assert.equal(original.revision, 0);
  assert.equal(saved.revision, 1);
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).revision, 1);

  storage.failWrites = true;
  assert.throws(() => repository.save(saved), /storage denied/);
  assert.equal(saved.revision, 1);
});

test("save rejects stale revisions instead of overwriting a newer profile", () => {
  const storage = new MemoryStorage();
  const firstRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const firstTab = firstRepository.load();
  const saved = firstRepository.save(firstTab);
  const secondRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const secondTab = secondRepository.load();
  saved.totalRuns = 1;
  firstRepository.save(saved);
  secondTab.totalRuns = 2;
  assert.throws(() => secondRepository.save(secondTab), /Stale profile revision/);
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).totalRuns, 1);
});

test("save rejects a different profile identity even when revisions match", () => {
  const stored = freshProfileV2({ profileId: "local:new", revision: 0 });
  const stale = freshProfileV2({ profileId: "local:old", revision: 0 });
  const storage = new MemoryStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify(stored) });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  assert.throws(() => repository.save(stale), /Profile identity changed/);
  assert.equal(JSON.parse(storage.getItem(PROFILE_STORAGE_KEY)).profileId, "local:new");
});

test("saveMerged rebases independent tab progress without losing either run", () => {
  const storage = new MemoryStorage();
  const firstRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const secondRepository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const firstTab = firstRepository.load();
  const secondTab = secondRepository.load();
  firstTab.totalRuns = 1;
  firstTab.settings.audio = false;
  firstRepository.save(firstTab);
  secondTab.totalRuns = 1;
  secondTab.achievements.push("first_blood");
  assert.throws(() => secondRepository.save(secondTab), /Stale profile revision/);
  const merged = secondRepository.saveMerged(secondTab);
  assert.equal(merged.totalRuns, 2);
  assert.equal(merged.settings.audio, false);
  assert.ok(merged.achievements.includes("first_blood"));
});

test("concurrent merge keeps score history bounded and refuses conflicting Bloodline changes", () => {
  const base = freshProfileV2({ profileId: fixedId() });
  base.scores = Array.from({ length: MAX_SCORE_HISTORY }, (_, index) => ({ score: index, time: index, grade: "D", win: false, difficulty: "story", date: "2026-07-14" }));
  const local = normaliseProfileV2(base);
  const latest = normaliseProfileV2(base);
  local.scores.push({ score: 1000, time: 1, grade: "S", win: true, difficulty: "night", date: "2026-07-14" });
  latest.scores.push({ score: 900, time: 2, grade: "A", win: true, difficulty: "night", date: "2026-07-14" });
  const merged = mergeConcurrentProfiles(base, local, latest);
  assert.equal(merged.scores.length, MAX_SCORE_HISTORY);
  assert.equal(merged.scores[0].score, 1000);
  assert.equal(merged.scores[1].score, 900);

  const identicalBase = freshProfileV2({ profileId: fixedId() });
  const identicalLocal = normaliseProfileV2(identicalBase);
  const identicalLatest = normaliseProfileV2(identicalBase);
  const visibleMetrics = { score: 500, time: 50, grade: "A", win: true, difficulty: "night", date: "2026-07-14" };
  identicalLocal.scores.push({ runId: "run:local", ...visibleMetrics });
  identicalLatest.scores.push({ runId: "run:latest", ...visibleMetrics });
  const identicalMerged = mergeConcurrentProfiles(identicalBase, identicalLocal, identicalLatest);
  assert.deepEqual(new Set(identicalMerged.scores.map((score) => score.runId)), new Set(["run:local", "run:latest"]));

  local.bloodline.allocation.hunger = 1;
  latest.bloodline.allocation.moonstride = 1;
  assert.throws(() => mergeConcurrentProfiles(base, local, latest), /explicit resolution/);

  const coffinLocal = normaliseProfileV2(identicalBase);
  const coffinLatest = normaliseProfileV2(identicalBase);
  coffinLocal.campaign.pendingCoffinOutcome = { eventId: "night:2", reward: "a" };
  coffinLatest.campaign.pendingCoffinOutcome = { eventId: "night:3", reward: "b" };
  assert.throws(() => mergeConcurrentProfiles(identicalBase, coffinLocal, coffinLatest), /coffin outcomes require explicit resolution/);
});

test("legacy reconciliation helper is deterministic for the same inputs", () => {
  const current = migrateLegacyProfile(JSON.stringify(legacyProfile()), { profileId: fixedId(), now: fixedNow() });
  const rollback = JSON.stringify(legacyProfile({ totalRuns: 8 }));
  assert.deepEqual(
    reconcileLegacyRollback(current, rollback, fixedNow()),
    reconcileLegacyRollback(current, rollback, fixedNow()),
  );

  const duplicateScore = { score: 100, time: 20, grade: "B", win: true, difficulty: "night", date: "2026-07-14" };
  const duplicateBase = legacyProfile({ scores: [duplicateScore] });
  const duplicateCurrent = migrateLegacyProfile(JSON.stringify(duplicateBase), { profileId: fixedId(), now: fixedNow() });
  const duplicateRollback = JSON.stringify(legacyProfile({ totalRuns: 8, scores: [duplicateScore, duplicateScore] }));
  assert.equal(reconcileLegacyRollback(duplicateCurrent, duplicateRollback, fixedNow()).scores.length, 2);
});

test("save refuses to overwrite an unreadable active profile", () => {
  const raw = "{broken";
  const storage = new MemoryStorage({ [PROFILE_STORAGE_KEY]: raw });
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const profile = freshProfileV2({ profileId: fixedId() });
  assert.throws(() => repository.save(profile), /unreadable active profile/);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), raw);
});

test("normalisation rejects negative currency and Bloodline allocation states", () => {
  const negativeBalance = freshProfileV2({ profileId: fixedId() });
  negativeBalance.economy.events.invalid = { amount: -1 };
  assert.throws(() => normaliseProfileV2(negativeBalance), /balance cannot be negative/);

  const invalidAllocation = freshProfileV2({ profileId: fixedId() });
  invalidAllocation.bloodline.allocation.hunger = -1;
  assert.throws(() => normaliseProfileV2(invalidAllocation), /Invalid Bloodline rank/);

  const invalidScore = freshProfileV2({ profileId: fixedId() });
  invalidScore.scores.push({ score: "100", time: 10, grade: "A", win: true, difficulty: "night", date: "2026-07-14" });
  assert.throws(() => normaliseProfileV2(invalidScore), /Invalid score entry/);
});

test("applyOnce records a stable event once and derives the balance from events", () => {
  const storage = new MemoryStorage();
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const original = freshProfileV2({ profileId: fixedId() });
  const first = repository.applyOnce(original, "campaign:night-05:first-clear", (draft) => {
    draft.economy.events["campaign:night-05:first-clear"] = { amount: 3, source: "first-clear", grantedAt: fixedNow() };
  });
  assert.equal(first.applied, true);
  assert.equal(profileBalance(first.profile), 3);
  const storedAfterFirst = storage.getItem(PROFILE_STORAGE_KEY);

  const second = repository.applyOnce(first.profile, "campaign:night-05:first-clear", () => {
    throw new Error("duplicate mutation should not run");
  });
  assert.equal(second.applied, false);
  assert.equal(profileBalance(second.profile), 3);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), storedAfterFirst);
});

test("export and import preserve a normalised profile", () => {
  const storage = new MemoryStorage();
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const profile = normaliseProfileV2(freshProfileV2({ profileId: fixedId() }));
  profile.achievements.push("first_blood");
  const exported = repository.export(profile);
  const imported = repository.import(exported);
  assert.deepEqual(imported, normaliseProfileV2(profile));
});

test("clear retains recovery sources by default and full clear removes all profile keys", () => {
  const entries = {
    [PROFILE_STORAGE_KEY]: JSON.stringify(freshProfileV2({ profileId: fixedId() })),
    [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify(legacyProfile()),
    [PROFILE_RECOVERY_STORAGE_KEY]: JSON.stringify({ raw: "recover-me" }),
  };
  const storage = new MemoryStorage(entries);
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  repository.clear();
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), null);
  assert.ok(storage.getItem(LEGACY_PROFILE_STORAGE_KEY));
  assert.ok(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY));

  storage.setItem(PROFILE_STORAGE_KEY, entries[PROFILE_STORAGE_KEY]);
  repository.clear({ includeLegacy: true });
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_PROFILE_STORAGE_KEY), null);
  assert.equal(storage.getItem(PROFILE_RECOVERY_STORAGE_KEY), null);
});
