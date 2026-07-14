import assert from "node:assert/strict";
import test from "node:test";

import { BUILD, createRunSeed, hashText, mulberry32, trimEntityOverflow } from "../games/vampire-survival-src/runtime.mjs";
import { ACHIEVEMENTS, DIFFICULTIES, DISTRICTS, ENEMY_TYPES, PACTS, WORLD } from "../games/vampire-survival-src/content.mjs";
import {
  ABILITY_RULES,
  CAMPAIGN_NIGHTS,
  HUNT_MUTATORS,
  abilityAvailability,
  campaignClearEventId,
  clearPendingCoffinOutcome,
  createHuntDepth,
  createRunContract,
  huntCrossQuota,
  huntMutatorForDepth,
  recordProfileRunOutcome,
  stableNearestTarget,
} from "../games/vampire-survival-src/progression.mjs";
import {
  BASE_RUN_STATS,
  BLOODLINE_BRANCHES,
  LEGACY_PROFILE_STORAGE_KEY,
  MAX_TALENT_SLOTS,
  MAX_SCORE_HISTORY,
  PROFILE_RECOVERY_STORAGE_KEY,
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  createProfileRepository,
  deriveBloodlineRunStats,
  freshProfileV2,
  migrateLegacyProfile,
  mergeConcurrentProfiles,
  normaliseProfileV2,
  profileBalance,
  purchaseBloodlineNode,
  reconcileLegacyRollback,
  respecBloodline,
  undoBloodlinePurchase,
  validateBloodlineState,
  validateTalentLoadout,
  toggleTalentTechnique,
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

test("iteration 40 runtime and content contracts remain complete", () => {
  assert.equal(BUILD.iteration, 40);
  assert.equal(BUILD.profileSchema, 2);
  assert.equal(PROFILE_SCHEMA_VERSION, 2);
  assert.equal(Object.keys(DIFFICULTIES).length, 3);
  assert.equal(DISTRICTS.length, 5);
  assert.equal(Object.keys(ENEMY_TYPES).length, 9);
  assert.equal(PACTS.length, 12);
  assert.equal(Object.keys(ACHIEVEMENTS).length, 9);
  assert.deepEqual(WORLD, { w: 3200, h: 2200 });
  const first = mulberry32(hashText("stable-seed"));
  const second = mulberry32(hashText("stable-seed"));
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  const clock = { now: () => new Date("2026-07-14T23:59:59.000Z"), timestamp: () => 1234, entropy: () => 0.25 };
  assert.equal(createRunSeed("daily", clock), "daily:2026-07-14");
  assert.equal(createRunSeed("standard", clock), "standard:1234:0.25");
  assert.notEqual(createRunSeed("daily", { now: () => new Date("2026-07-15T00:00:00.000Z") }), createRunSeed("daily", clock));
});

test("Bloodline v2 defines three complete seven-node branches", () => {
  assert.equal(BLOODLINE_BRANCHES.length, 3);
  assert.deepEqual(BLOODLINE_BRANCHES.map((branch) => branch.name), ["Crimson Hunger", "Moonstride", "Nightborn Arts"]);
  assert.ok(BLOODLINE_BRANCHES.every((branch) => branch.nodes.length === 7));
  const nodes = BLOODLINE_BRANCHES.flatMap((branch) => branch.nodes);
  assert.equal(new Set(nodes.map((node) => node.id)).size, 21);
  assert.ok(nodes.every((node) => node.cost > 0 && node.effect && node.flavor));
  assert.ok(BLOODLINE_BRANCHES.every((branch) => branch.nodes[0].prerequisite === null
    && branch.nodes.slice(1).every((node, index) => node.prerequisite === branch.nodes[index].id)));
});

test("Bloodline purchase, one-step undo, and free respec conserve currency atomically", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  profile.economy.events.seed = { amount: 5, source: "test" };
  const beforeRejected = structuredClone(profile);
  assert.throws(() => purchaseBloodlineNode(profile, "predator-teeth", fixedNow()), /first/);
  assert.deepEqual(profile, beforeRejected);

  const first = purchaseBloodlineNode(profile, "crimson-reservoir", fixedNow());
  assert.equal(first.balance, 4);
  assert.equal(profile.bloodline.allocation["crimson-reservoir"], 1);
  const beforeDuplicate = structuredClone(profile);
  assert.throws(() => purchaseBloodlineNode(profile, "crimson-reservoir", fixedNow()), /already owned/);
  assert.deepEqual(profile, beforeDuplicate);

  purchaseBloodlineNode(profile, "predator-teeth", fixedNow());
  assert.equal(profileBalance(profile), 3);
  const undone = undoBloodlinePurchase(profile, fixedNow());
  assert.equal(undone.node.id, "predator-teeth");
  assert.equal(profileBalance(profile), 4);
  assert.equal(profile.bloodline.lastPurchaseId, "crimson-reservoir");
  assert.equal(profile.bloodline.allocation["predator-teeth"], undefined);

  const reset = respecBloodline(profile, fixedNow());
  assert.equal(reset.refunded, 1);
  assert.equal(profileBalance(profile), 5);
  assert.deepEqual(profile.bloodline.allocation, {});
  assert.deepEqual(profile.bloodline.purchases, {});
  assert.equal(profile.bloodline.lastPurchaseId, null);
  assert.equal(validateBloodlineState(profile.bloodline), true);
});

test("Bloodline run stats are derived from immutable base definitions", () => {
  const baseBefore = structuredClone(BASE_RUN_STATS);
  const stats = deriveBloodlineRunStats({
    "crimson-reservoir": 1,
    "fleet-shadow": 1,
    "spectral-step": 1,
    "long-fangs": 1,
  });
  assert.equal(stats.maxBlood, 124);
  assert.equal(stats.speed, BASE_RUN_STATS.speed * 1.04);
  assert.equal(stats.dashCooldown, 2.1);
  assert.equal(stats.range, 82);
  stats.maxBlood = 999;
  assert.deepEqual(BASE_RUN_STATS, baseBefore);
});

test("a failed Bloodline save cannot debit the stored profile", () => {
  const storage = new MemoryStorage();
  const repository = createProfileRepository(storage, { now: fixedNow, makeId: fixedId });
  const loaded = repository.load();
  loaded.economy.events.seed = { amount: 2, source: "test" };
  const funded = repository.save(loaded);
  const draft = normaliseProfileV2(funded);
  purchaseBloodlineNode(draft, "crimson-reservoir", fixedNow());
  const storedBeforeFailure = storage.getItem(PROFILE_STORAGE_KEY);
  storage.failWrites = true;
  assert.throws(() => repository.save(draft), /storage denied/);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), storedBeforeFailure);
  assert.equal(profileBalance(JSON.parse(storedBeforeFailure)), 2);
});

test("the complete Campaign and Hunt keep fixed-duration contracts while objectives and quotas escalate", () => {
  assert.equal(Object.keys(CAMPAIGN_NIGHTS).length, 15);
  const campaign = createRunContract({ mode: "campaign", campaignNight: 1, difficulty: DIFFICULTIES.night });
  const nightTwo = createRunContract({ mode: "campaign", campaignNight: 2, difficulty: DIFFICULTIES.night });
  const nightThree = createRunContract({ mode: "campaign", campaignNight: 3, difficulty: DIFFICULTIES.night });
  const nightFour = createRunContract({ mode: "campaign", campaignNight: 4, difficulty: DIFFICULTIES.night });
  const nightFive = createRunContract({ mode: "campaign", campaignNight: 5, difficulty: DIFFICULTIES.night });
  const nightSix = createRunContract({ mode: "campaign", campaignNight: 6, difficulty: DIFFICULTIES.night });
  const nightSeven = createRunContract({ mode: "campaign", campaignNight: 7, difficulty: DIFFICULTIES.night });
  const nightEight = createRunContract({ mode: "campaign", campaignNight: 8, difficulty: DIFFICULTIES.night });
  const nightNine = createRunContract({ mode: "campaign", campaignNight: 9, difficulty: DIFFICULTIES.night });
  const nightTen = createRunContract({ mode: "campaign", campaignNight: 10, difficulty: DIFFICULTIES.night });
  const nightEleven = createRunContract({ mode: "campaign", campaignNight: 11, difficulty: DIFFICULTIES.night });
  const nightTwelve = createRunContract({ mode: "campaign", campaignNight: 12, difficulty: DIFFICULTIES.night });
  const nightThirteen = createRunContract({ mode: "campaign", campaignNight: 13, difficulty: DIFFICULTIES.night });
  const nightFourteen = createRunContract({ mode: "campaign", campaignNight: 14, difficulty: DIFFICULTIES.night });
  const nightFifteen = createRunContract({ mode: "campaign", campaignNight: 15, difficulty: DIFFICULTIES.night });
  const depthOne = createRunContract({ mode: "hunt", huntDepth: 1, difficulty: DIFFICULTIES.night });
  const depthTwo = createRunContract({ mode: "hunt", huntDepth: 2, difficulty: DIFFICULTIES.night });
  const depthTen = createRunContract({ mode: "hunt", huntDepth: 10, difficulty: DIFFICULTIES.night });
  assert.equal(campaign.crossQuota, 3);
  assert.equal(campaign.crossPoints.length, campaign.crossQuota);
  assert.equal(new Set(campaign.crossPoints.map((point) => point.join(":"))).size, campaign.crossQuota);
  assert.equal(depthOne.dawn, depthTwo.dawn);
  assert.equal(depthOne.crossQuota, depthTwo.crossQuota);
  assert.ok(depthTwo.pressure > depthOne.pressure);
  assert.ok(depthTwo.enemyHp > depthOne.enemyHp);
  assert.ok(depthTwo.eliteBonus > depthOne.eliteBonus);
  assert.deepEqual([nightTwo.encounter, nightThree.encounter, nightFour.encounter, nightFive.encounter], ["procession", "fog", "lockdown", "voss"]);
  assert.deepEqual([nightTwo.lieutenantQuota, nightThree.lieutenantQuota, nightFour.lieutenantQuota], [2, 2, 3]);
  assert.equal(nightFive.bossId, "voss");
  assert.deepEqual([nightSix.encounter, nightSeven.encounter, nightEight.encounter, nightNine.encounter, nightTen.encounter], ["bellward", "hollow-choir", "silver-chase", "tolling-lock", "elowen"]);
  assert.equal(nightTen.bossId, "elowen");
  assert.deepEqual([nightEleven.encounter, nightTwelve.encounter, nightThirteen.encounter, nightFourteen.encounter, nightFifteen.encounter], ["mixed-assault", "sixfold", "silver-tempest", "dawn-gauntlet", "sol"]);
  assert.equal(nightTwelve.crossQuota, 6);
  assert.equal(nightFifteen.bossId, "sol");
  assert.ok([campaign, nightTwo, nightThree, nightFour, nightFive, nightSix, nightSeven, nightEight, nightNine, nightTen, nightEleven, nightTwelve, nightThirteen, nightFourteen, nightFifteen, depthOne, depthTen].every((contract) => contract.dawn === DIFFICULTIES.night.dawn));
  assert.deepEqual(Array.from({ length: 10 }, (_, index) => huntCrossQuota(index + 1)), [3, 3, 4, 4, 4, 5, 5, 6, 6, 6]);
  assert.equal(depthTen.crossQuota, 6);
  assert.equal(createHuntDepth(31).crossQuota, 6);
  assert.ok(createHuntDepth(31).pressure > depthTen.pressure);
  assert.equal(depthTen.encounter, "chapter-two-hunt");
  assert.deepEqual(HUNT_MUTATORS.map((mutator) => mutator.id), ["blood-famine", "silver-rain", "swift-hunters"]);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => huntMutatorForDepth(index + 1).id), ["blood-famine", "silver-rain", "swift-hunters", "blood-famine", "silver-rain", "swift-hunters"]);
  assert.deepEqual([5, 10, 15, 20].map((depth) => createHuntDepth(depth).bossId), ["voss", "elowen", "sol", "elowen"]);
  assert.equal(createHuntDepth(14).bossId, null);
  assert.throws(() => createRunContract({ mode: "campaign", campaignNight: 16, difficulty: DIFFICULTIES.night }), /not playable/);
  assert.throws(() => createRunContract({ mode: "hunt", huntDepth: 0, difficulty: DIFFICULTIES.night }), /positive/);
});

test("ability states expose exactly one highest-priority blocking reason", () => {
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
  assert.deepEqual(abilityAvailability("createThrall", { unlocked: false, equipped: false, busy: true, capacity: false, cooldown: 8, blood: 0, targetAvailable: false }), {
    state: "locked", label: "Survive Campaign Night 1", ready: false, cost: 18,
  });
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: false, busy: true }).state, "unequipped");
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: true, busy: true, capacity: false }).state, "casting");
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: true, capacity: false, cooldown: 8 }).state, "capacity");
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: true, cooldown: 8, blood: 0, targetAvailable: false }).state, "cooldown");
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: true, blood: 0, targetAvailable: false }).state, "insufficient");
  assert.equal(abilityAvailability("createThrall", { unlocked: true, equipped: true, blood: 18, targetAvailable: false }).state, "no-target");
});

test("talent loadout enforces unlock authority, unique choices, and two slots", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  assert.equal(MAX_TALENT_SLOTS, 2);
  assert.throws(() => toggleTalentTechnique(profile, "createThrall"), /locked/);
  profile.campaign.clears["night-1"] = { test: true };
  profile.campaign.clears["night-5"] = { test: true };
  profile.campaign.clears["night-10"] = { test: true };
  toggleTalentTechnique(profile, "createThrall");
  toggleTalentTechnique(profile, "mist");
  assert.deepEqual(profile.bloodline.loadout, ["createThrall", "mist"]);
  assert.throws(() => toggleTalentTechnique(profile, "swarm"), /occupied/);
  toggleTalentTechnique(profile, "createThrall");
  toggleTalentTechnique(profile, "swarm");
  assert.deepEqual(profile.bloodline.loadout, ["mist", "swarm"]);
  assert.equal(validateTalentLoadout(profile), true);
  profile.bloodline.loadout.push("swarm");
  assert.throws(() => validateTalentLoadout(profile), /slots|duplicates/);
});

test("Create Thrall targeting is deterministic, range-bounded, and excludes protected enemies", () => {
  const origin = { x: 0, y: 0 };
  const candidates = [
    { id: "enemy-z", x: 10, y: 0 },
    { id: "enemy-a", x: -10, y: 0 },
    { id: "enemy-boss", x: 1, y: 0, type: "elowen", behaviour: "boss" },
    { id: "enemy-lieutenant", x: 2, y: 0, objectiveLieutenant: true },
    { id: "enemy-converting", x: 3, y: 0, converting: true },
  ];
  assert.equal(stableNearestTarget(candidates, origin, 20).id, "enemy-a");
  assert.equal(stableNearestTarget(candidates, origin, 9), null);
  assert.equal(stableNearestTarget([...candidates].reverse(), origin, 20).id, "enemy-a");
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

test("Night 5 victory atomically unlocks Mist and full Hunt exactly once", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  const outcome = {
    runId: "run:voss-first", mode: "campaign", campaignNight: 5, huntDepth: null,
    score: 9200, time: 225, grade: "A", win: true, difficulty: "night",
  };
  const first = recordProfileRunOutcome(profile, outcome, fixedNow());
  assert.equal(first.firstClear, true);
  assert.equal(first.coffinOutcome.mistUnlocked, true);
  assert.equal(first.coffinOutcome.huntUnlocked, true);
  assert.equal(profile.campaign.abilityUnlocks.mist, true);
  assert.equal(profile.hunt.unlocked, true);
  assert.equal(profileBalance(profile), 1);
  assert.ok(profile.appliedEvents["campaign:night-05:unlock-mist"]);
  assert.ok(profile.appliedEvents["campaign:night-05:unlock-hunt"]);

  const replay = recordProfileRunOutcome(profile, { ...outcome, runId: "run:voss-replay" }, fixedNow());
  assert.equal(replay.firstClear, false);
  assert.equal(replay.coffinOutcome.mistUnlocked, false);
  assert.equal(profileBalance(profile), 1);
});

test("Night 10 victory atomically unlocks Swarm exactly once", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  const outcome = {
    runId: "run:elowen-first", mode: "campaign", campaignNight: 10, huntDepth: null,
    score: 14200, time: 225, grade: "A", win: true, difficulty: "night",
  };
  const first = recordProfileRunOutcome(profile, outcome, fixedNow());
  assert.equal(first.firstClear, true);
  assert.equal(first.coffinOutcome.swarmUnlocked, true);
  assert.equal(profile.campaign.abilityUnlocks.swarm, true);
  assert.equal(profile.campaign.unlockedNight, 11);
  assert.equal(profileBalance(profile), 1);
  assert.ok(profile.appliedEvents["campaign:night-10:unlock-swarm"]);
  const replay = recordProfileRunOutcome(profile, { ...outcome, runId: "run:elowen-replay" }, fixedNow());
  assert.equal(replay.firstClear, false);
  assert.equal(replay.coffinOutcome.swarmUnlocked, false);
  assert.equal(profileBalance(profile), 1);
});

test("Night 15 victory atomically unlocks the ending and Ascension exactly once", () => {
  const profile = freshProfileV2({ profileId: fixedId() });
  const outcome = {
    runId: "run:sol-first", mode: "campaign", campaignNight: 15, huntDepth: null,
    score: 22000, time: 225, grade: "S", win: true, difficulty: "night",
  };
  const first = recordProfileRunOutcome(profile, outcome, fixedNow());
  assert.equal(first.firstClear, true);
  assert.equal(first.coffinOutcome.endingUnlocked, true);
  assert.equal(first.coffinOutcome.nextNight, null);
  assert.equal(profile.campaign.unlockedNight, 15);
  assert.equal(profile.campaign.endingUnlocked, true);
  assert.equal(profile.campaign.endingSeen, false);
  assert.equal(profile.hunt.ascensionUnlocked, true);
  assert.ok(profile.appliedEvents["campaign:night-15:ending"]);
  assert.ok(profile.appliedEvents["campaign:night-15:unlock-ascension"]);
  assert.equal(profileBalance(profile), 1);

  const replay = recordProfileRunOutcome(profile, { ...outcome, runId: "run:sol-replay" }, fixedNow());
  assert.equal(replay.firstClear, false);
  assert.equal(replay.coffinOutcome.endingUnlocked, false);
  assert.equal(profileBalance(profile), 1);
});

test("Hunt outcomes continue to the next depth and never award Campaign currency", () => {
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
  assert.equal(second.coffinOutcome.nextDepth, 3);
  assert.equal(profile.hunt.bestDepth, 2);
  assert.equal(profile.hunt.scores["depth-2"].score, 2800);
  assert.equal(profileBalance(profile), 0);
});

test("enemy overflow trimming removes only the farthest live excess and preserves objective entities", () => {
  const boss = { id: "boss", x: 1000, y: 1000, dead: false };
  const lieutenant = { id: "lieutenant", x: 40, y: 0, dead: false };
  const alreadyDead = { id: "dead", x: 2000, y: 2000, dead: true };
  const enemies = [
    boss,
    { id: "near", x: 10, y: 0, dead: false },
    { id: "middle", x: 20, y: 0, dead: false },
    { id: "far", x: 30, y: 0, dead: false },
    lieutenant,
    alreadyDead,
  ];
  const removed = trimEntityOverflow(enemies, 3, { x: 0, y: 0 }, [boss, lieutenant]);
  assert.equal(removed, 2);
  assert.equal(enemies.filter((enemy) => !enemy.dead).length, 3);
  assert.equal(enemies.find((enemy) => enemy.id === "far").dead, true);
  assert.equal(enemies.find((enemy) => enemy.id === "middle").dead, true);
  assert.equal(enemies.find((enemy) => enemy.id === "near").dead, false);
  assert.equal(boss.dead, false);
  assert.equal(lieutenant.dead, false);
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
  assert.equal(profile.hunt.unlocked, false);
  assert.equal(profile.hunt.ascensionUnlocked, false);
  assert.equal(profile.campaign.endingUnlocked, false);
  assert.equal(profile.campaign.endingSeen, false);
  assert.equal(profile.revision, 0);
  assert.equal(profileBalance(profile), 0);
});

test("normalisation derives Mist and Hunt access from the Night 5 clear", () => {
  const forged = freshProfileV2({ profileId: fixedId() });
  forged.campaign.abilityUnlocks.mist = true;
  forged.hunt.unlocked = true;
  const locked = normaliseProfileV2(forged);
  assert.equal(locked.campaign.abilityUnlocks.mist, false);
  assert.equal(locked.hunt.unlocked, false);

  forged.campaign.clears["night-5"] = { eventId: campaignClearEventId(5), clearedAt: fixedNow(), grade: "A", score: 9000 };
  const unlocked = normaliseProfileV2(forged);
  assert.equal(unlocked.campaign.abilityUnlocks.mist, true);
  assert.equal(unlocked.hunt.unlocked, true);
});

test("normalisation derives the finale and Ascension only from the Night 15 clear", () => {
  const forged = freshProfileV2({ profileId: fixedId() });
  forged.campaign.endingUnlocked = true;
  forged.hunt.ascensionUnlocked = true;
  let normalised = normaliseProfileV2(forged);
  assert.equal(normalised.campaign.endingUnlocked, false);
  assert.equal(normalised.hunt.ascensionUnlocked, false);

  forged.campaign.clears["night-15"] = { eventId: campaignClearEventId(15), clearedAt: fixedNow(), grade: "S", score: 22000 };
  forged.campaign.endingSeen = true;
  normalised = normaliseProfileV2(forged);
  assert.equal(normalised.campaign.endingUnlocked, true);
  assert.equal(normalised.campaign.endingSeen, true);
  assert.equal(normalised.hunt.ascensionUnlocked, true);
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
  base.economy.events.seed = { amount: 10, source: "test" };
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

  purchaseBloodlineNode(local, "crimson-reservoir", fixedNow());
  purchaseBloodlineNode(latest, "fleet-shadow", fixedNow());
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

  const missingPrerequisite = freshProfileV2({ profileId: fixedId() });
  missingPrerequisite.bloodline.allocation["predator-teeth"] = 1;
  missingPrerequisite.bloodline.purchases["predator-teeth"] = { transactionId: "bad", sequence: 1, cost: 1, purchasedAt: fixedNow() };
  missingPrerequisite.bloodline.nextTransaction = 2;
  missingPrerequisite.bloodline.lastPurchaseId = "predator-teeth";
  assert.throws(() => normaliseProfileV2(missingPrerequisite), /prerequisite missing/);

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
