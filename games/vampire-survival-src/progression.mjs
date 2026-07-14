export const CAMPAIGN_NIGHTS = Object.freeze({
  1: Object.freeze({
    id: "night-1",
    title: "The First Warding",
    briefing: "Break 3 warding crosses, then survive until dawn.",
    crossQuota: 3,
    pressure: 1,
    eliteBonus: 0,
    enemyHp: 1,
    enemyDamage: 1,
    startingGuards: 3,
    startingHunters: 0,
    crossPoints: Object.freeze([[420, 360], [2760, 420], [1664, 1840]]),
  }),
  2: Object.freeze({
    id: "night-2",
    title: "Lantern Procession",
    briefing: "Break 3 warding crosses and silence the 2 Procession Keepers before dawn.",
    crossQuota: 3,
    lieutenantQuota: 2,
    lieutenantType: "priest",
    lieutenantName: "Procession Keepers",
    encounter: "procession",
    pressure: 1.08,
    eliteBonus: 0.025,
    enemyHp: 1.03,
    enemyDamage: 1.02,
    startingGuards: 4,
    startingHunters: 0,
    crossPoints: Object.freeze([[520, 1720], [1570, 360], [2700, 1680]]),
  }),
  3: Object.freeze({
    id: "night-3",
    title: "Blackwater Fog",
    briefing: "Break 4 warding crosses and hunt down the 2 Fog Stalkers before dawn.",
    crossQuota: 4,
    lieutenantQuota: 2,
    lieutenantType: "hunter",
    lieutenantName: "Fog Stalkers",
    encounter: "fog",
    pressure: 1.16,
    eliteBonus: 0.045,
    enemyHp: 1.07,
    enemyDamage: 1.05,
    startingGuards: 4,
    startingHunters: 2,
    crossPoints: Object.freeze([[380, 420], [1480, 430], [2780, 520], [1760, 1810]]),
  }),
  4: Object.freeze({
    id: "night-4",
    title: "Palace Lockdown",
    briefing: "Break 4 warding crosses and defeat the 3 Ivory Captains before dawn.",
    crossQuota: 4,
    lieutenantQuota: 3,
    lieutenantType: "captain",
    lieutenantName: "Ivory Captains",
    encounter: "lockdown",
    pressure: 1.25,
    eliteBonus: 0.065,
    enemyHp: 1.12,
    enemyDamage: 1.08,
    startingGuards: 7,
    startingHunters: 2,
    crossPoints: Object.freeze([[470, 360], [2600, 390], [620, 1780], [2700, 1770]]),
  }),
  5: Object.freeze({
    id: "night-5",
    title: "The Dawn Marshal",
    briefing: "Break 4 warding crosses and survive until dawn. Captain Voss waits beyond it.",
    crossQuota: 4,
    lieutenantQuota: 0,
    lieutenantType: null,
    lieutenantName: "",
    encounter: "voss",
    bossId: "voss",
    pressure: 1.34,
    eliteBonus: 0.08,
    enemyHp: 1.16,
    enemyDamage: 1.12,
    startingGuards: 8,
    startingHunters: 3,
    crossPoints: Object.freeze([[420, 380], [1570, 350], [2780, 470], [1640, 1840]]),
  }),
  6: Object.freeze({
    id: "night-6", title: "Bellward Streets", briefing: "Break 4 warding crosses and silence the 2 Bell Keepers before dawn.",
    crossQuota: 4, lieutenantQuota: 2, lieutenantType: "bellkeeper", lieutenantName: "Bell Keepers", encounter: "bellward",
    pressure: 1.4, eliteBonus: 0.09, enemyHp: 1.18, enemyDamage: 1.13, startingGuards: 7, startingHunters: 3,
    crossPoints: Object.freeze([[410, 420], [1510, 350], [2790, 430], [1680, 1800]]),
  }),
  7: Object.freeze({
    id: "night-7", title: "The Hollow Choir", briefing: "Break 5 warding crosses and end the 2 Hollow Cantors before dawn.",
    crossQuota: 5, lieutenantQuota: 2, lieutenantType: "priest", lieutenantName: "Hollow Cantors", encounter: "hollow-choir",
    pressure: 1.47, eliteBonus: 0.1, enemyHp: 1.21, enemyDamage: 1.15, startingGuards: 8, startingHunters: 3,
    crossPoints: Object.freeze([[390, 390], [1540, 340], [2790, 470], [560, 1780], [2640, 1790]]),
  }),
  8: Object.freeze({
    id: "night-8", title: "Silver Chase", briefing: "Break 5 warding crosses and outrun the 3 Silver Pursuers before dawn.",
    crossQuota: 5, lieutenantQuota: 3, lieutenantType: "hunter", lieutenantName: "Silver Pursuers", encounter: "silver-chase",
    pressure: 1.55, eliteBonus: 0.115, enemyHp: 1.25, enemyDamage: 1.18, startingGuards: 8, startingHunters: 5,
    crossPoints: Object.freeze([[500, 350], [2700, 370], [430, 1650], [1580, 1870], [2760, 1650]]),
  }),
  9: Object.freeze({
    id: "night-9", title: "The Tolling Lock", briefing: "Break 5 warding crosses and silence the 3 Iron Bell Keepers before dawn.",
    crossQuota: 5, lieutenantQuota: 3, lieutenantType: "bellkeeper", lieutenantName: "Iron Bell Keepers", encounter: "tolling-lock",
    pressure: 1.63, eliteBonus: 0.13, enemyHp: 1.29, enemyDamage: 1.2, startingGuards: 9, startingHunters: 4,
    crossPoints: Object.freeze([[380, 470], [1640, 330], [2810, 540], [520, 1770], [2600, 1800]]),
  }),
  10: Object.freeze({
    id: "night-10", title: "The Last Bell", briefing: "Break 5 warding crosses and survive until dawn. Sister Elowen waits beyond it.",
    crossQuota: 5, lieutenantQuota: 0, lieutenantType: null, lieutenantName: "", encounter: "elowen", bossId: "elowen",
    pressure: 1.72, eliteBonus: 0.145, enemyHp: 1.34, enemyDamage: 1.24, startingGuards: 10, startingHunters: 5,
    crossPoints: Object.freeze([[400, 390], [1570, 330], [2790, 440], [520, 1770], [2670, 1770]]),
  }),
  11: Object.freeze({
    id: "night-11", title: "Ashen Convergence", briefing: "Break 5 warding crosses and end the 3 Convergence Marshals before dawn.",
    crossQuota: 5, lieutenantQuota: 3, lieutenantType: "captain", lieutenantName: "Convergence Marshals", encounter: "mixed-assault",
    pressure: 1.8, eliteBonus: 0.16, enemyHp: 1.38, enemyDamage: 1.26, startingGuards: 10, startingHunters: 5,
    crossPoints: Object.freeze([[370, 360], [1540, 320], [2830, 450], [490, 1810], [2710, 1780]]),
  }),
  12: Object.freeze({
    id: "night-12", title: "Sixfold Ward", briefing: "Break 6 warding crosses and silence the 3 Reliquary Keepers before dawn.",
    crossQuota: 6, lieutenantQuota: 3, lieutenantType: "bellkeeper", lieutenantName: "Reliquary Keepers", encounter: "sixfold",
    pressure: 1.88, eliteBonus: 0.175, enemyHp: 1.42, enemyDamage: 1.29, startingGuards: 11, startingHunters: 5,
    crossPoints: Object.freeze([[370, 350], [1500, 310], [2830, 400], [410, 1730], [1600, 1890], [2790, 1700]]),
  }),
  13: Object.freeze({
    id: "night-13", title: "The Silver Tempest", briefing: "Break 6 warding crosses and defeat the 4 Tempest Riders before dawn.",
    crossQuota: 6, lieutenantQuota: 4, lieutenantType: "hunter", lieutenantName: "Tempest Riders", encounter: "silver-tempest",
    pressure: 1.97, eliteBonus: 0.19, enemyHp: 1.47, enemyDamage: 1.32, startingGuards: 11, startingHunters: 7,
    crossPoints: Object.freeze([[430, 440], [1580, 300], [2800, 510], [360, 1650], [1680, 1870], [2840, 1640]]),
  }),
  14: Object.freeze({
    id: "night-14", title: "Dawn's Gauntlet", briefing: "Break 6 warding crosses and destroy the 4 Dawn Captains before dawn.",
    crossQuota: 6, lieutenantQuota: 4, lieutenantType: "captain", lieutenantName: "Dawn Captains", encounter: "dawn-gauntlet",
    pressure: 2.07, eliteBonus: 0.21, enemyHp: 1.52, enemyDamage: 1.36, startingGuards: 12, startingHunters: 7,
    crossPoints: Object.freeze([[350, 390], [1640, 310], [2860, 430], [390, 1790], [1530, 1900], [2820, 1760]]),
  }),
  15: Object.freeze({
    id: "night-15", title: "The Uncrowned Dawn", briefing: "Break 6 warding crosses and survive until dawn. Archon Sol waits beyond it.",
    crossQuota: 6, lieutenantQuota: 0, lieutenantType: null, lieutenantName: "", encounter: "sol", bossId: "sol",
    pressure: 2.18, eliteBonus: 0.23, enemyHp: 1.58, enemyDamage: 1.4, startingGuards: 13, startingHunters: 8,
    crossPoints: Object.freeze([[360, 340], [1550, 300], [2860, 380], [350, 1760], [1640, 1910], [2860, 1730]]),
  }),
});

export const HUNT_MUTATORS = Object.freeze([
  Object.freeze({ id: "blood-famine", name: "Blood Famine", description: "Roses restore 30% less Blood." }),
  Object.freeze({ id: "silver-rain", name: "Silver Rain", description: "Sanctified zones fall throughout the night." }),
  Object.freeze({ id: "swift-hunters", name: "Swift Hunters", description: "Hostile movement is 12% faster." }),
]);

export function huntMutatorForDepth(depth) {
  if (!Number.isInteger(depth) || depth < 1) throw new Error("Hunt depth must be positive");
  return HUNT_MUTATORS[(depth - 1) % HUNT_MUTATORS.length];
}

const HUNT_CROSS_LAYOUTS = Object.freeze({
  3: Object.freeze([
    Object.freeze([[460, 420], [2680, 460], [1620, 1800]]),
    Object.freeze([[520, 1680], [1580, 360], [2700, 1680]]),
  ]),
  4: Object.freeze([
    Object.freeze([[420, 390], [1560, 360], [2780, 500], [1640, 1840]]),
    Object.freeze([[480, 520], [2700, 420], [520, 1760], [2660, 1780]]),
  ]),
  5: Object.freeze([
    Object.freeze([[380, 410], [1570, 330], [2800, 470], [620, 1800], [2580, 1810]]),
    Object.freeze([[520, 350], [2660, 380], [430, 1670], [1580, 1880], [2760, 1660]]),
  ]),
  6: Object.freeze([
    Object.freeze([[390, 380], [1550, 340], [2790, 430], [450, 1760], [1600, 1880], [2740, 1740]]),
    Object.freeze([[520, 460], [1580, 330], [2700, 520], [390, 1620], [1680, 1820], [2810, 1640]]),
  ]),
});

export function huntCrossQuota(depth) {
  if (!Number.isInteger(depth) || depth < 1) throw new Error("Hunt depth must be positive");
  if (depth <= 2) return 3;
  if (depth <= 5) return 4;
  if (depth <= 7) return 5;
  return 6;
}

export function createHuntDepth(depth) {
  const crossQuota = huntCrossQuota(depth);
  const layouts = HUNT_CROSS_LAYOUTS[crossQuota];
  const crossPoints = layouts[(depth - 1) % layouts.length];
  const tier = Math.floor((depth - 1) / 3);
  const milestoneBoss = depth % 5 === 0 ? (depth % 15 === 0 ? "sol" : depth % 10 === 0 ? "elowen" : "voss") : null;
  return Object.freeze({
    id: `hunt-depth-${depth}`,
    title: `Hunt Depth ${depth}`,
    briefing: `Break ${crossQuota} warding crosses. Pressure and elite patrols intensify while dawn stays fixed.`,
    crossQuota,
    lieutenantQuota: 0,
    lieutenantType: null,
    lieutenantName: "",
    encounter: depth >= 8 ? "chapter-two-hunt" : depth >= 4 ? "escalation" : "hunt",
    bossId: milestoneBoss,
    mutator: huntMutatorForDepth(depth),
    pressure: Math.min(2.35, 1 + (depth - 1) * 0.095),
    eliteBonus: Math.min(0.24, 0.01 + (depth - 1) * 0.022),
    enemyHp: Math.min(1.72, 1 + (depth - 1) * 0.045),
    enemyDamage: Math.min(1.55, 1 + (depth - 1) * 0.035),
    scoreMultiplier: 1 + tier * 0.12,
    startingGuards: Math.min(13, 3 + Math.floor(depth * 0.9)),
    startingHunters: Math.min(8, Math.floor(depth / 2)),
    crossPoints,
  });
}

export const ABILITY_RULES = Object.freeze({
  feed: Object.freeze({ cost: 0, milestone: "Always available" }),
  dash: Object.freeze({ cost: 0, milestone: "Always available" }),
  createThrall: Object.freeze({ cost: 18, milestone: "Survive Campaign Night 1" }),
  mist: Object.freeze({ cost: 10, milestone: "Defeat the Night 5 boss" }),
  swarm: Object.freeze({ cost: 16, milestone: "Defeat the Night 10 boss" }),
});

export function createRunContract({ mode, difficulty, campaignNight = 1, huntDepth = 1 }) {
  if (!difficulty || !Number.isFinite(difficulty.dawn) || !Number.isFinite(difficulty.grace)) {
    throw new Error("A valid difficulty contract is required");
  }
  let authored;
  if (mode === "campaign") {
    authored = CAMPAIGN_NIGHTS[campaignNight];
    if (!authored) throw new Error(`Campaign Night ${campaignNight} is not playable yet`);
  } else if (mode === "hunt") {
    authored = createHuntDepth(huntDepth);
  } else {
    throw new Error(`Unknown run mode ${mode}`);
  }
  return {
    ...authored,
    mode,
    campaignNight: mode === "campaign" ? campaignNight : null,
    huntDepth: mode === "hunt" ? huntDepth : null,
    dawn: difficulty.dawn,
    grace: difficulty.grace,
  };
}

export function campaignClearEventId(night) {
  if (!Number.isInteger(night) || night < 1) throw new Error("Campaign night must be positive");
  return `campaign:night-${String(night).padStart(2, "0")}:first-clear`;
}

export function abilityAvailability(abilityId, { unlocked, equipped = true, busy = false, capacity = true, cooldown = 0, blood = 0, targetAvailable = true } = {}) {
  const rule = ABILITY_RULES[abilityId];
  if (!rule) throw new Error(`Unknown ability ${abilityId}`);
  if (!unlocked) return { state: "locked", label: rule.milestone, ready: false, cost: rule.cost };
  if (!equipped) return { state: "unequipped", label: "Not in loadout", ready: false, cost: rule.cost };
  if (busy) return { state: "casting", label: "Conversion in progress", ready: false, cost: rule.cost };
  if (!capacity) return { state: "capacity", label: "Thrall cap 3/3", ready: false, cost: rule.cost };
  if (cooldown > 0) return { state: "cooldown", label: `${cooldown.toFixed(1)}s`, ready: false, cost: rule.cost };
  if (rule.cost > 0 && blood < rule.cost) return { state: "insufficient", label: `Need ${rule.cost} Blood`, ready: false, cost: rule.cost };
  if (!targetAvailable) return { state: "no-target", label: "No mortal in range", ready: false, cost: rule.cost };
  return { state: "ready", label: "Ready", ready: true, cost: rule.cost };
}

export function stableNearestTarget(candidates, origin, maxDistance = Infinity) {
  let best = null;
  let bestDistance = maxDistance;
  for (const candidate of candidates) {
    if (!candidate || candidate.dead || candidate.converting || candidate.behaviour === "boss" || candidate.objectiveLieutenant) continue;
    const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
    if (distance > maxDistance) continue;
    if (!best || distance < bestDistance - 1e-9 || (Math.abs(distance - bestDistance) <= 1e-9 && String(candidate.id).localeCompare(String(best.id)) < 0)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function gradeRank(grade) {
  return ({ D: 0, "D+": 1, C: 2, B: 3, A: 4, S: 5 })[grade] ?? 0;
}

function scoreEntry(outcome, nowValue) {
  return {
    runId: outcome.runId,
    score: Math.max(0, Math.floor(outcome.score)),
    time: Math.max(0, Math.floor(outcome.time)),
    grade: outcome.grade,
    win: outcome.win,
    difficulty: outcome.difficulty,
    date: nowValue.slice(0, 10),
    mode: outcome.mode,
    depth: outcome.mode === "hunt" ? outcome.huntDepth : outcome.campaignNight,
  };
}

export function recordProfileRunOutcome(draft, outcome, nowValue = new Date().toISOString()) {
  if (!draft || typeof draft !== "object") throw new Error("A profile draft is required");
  if (!outcome || typeof outcome.runId !== "string" || !outcome.runId) throw new Error("A stable run ID is required");
  if (!Number.isFinite(outcome.score) || !Number.isFinite(outcome.time)) throw new Error("Run metrics must be finite");
  if (typeof outcome.win !== "boolean" || typeof outcome.grade !== "string" || typeof outcome.difficulty !== "string") {
    throw new Error("Run result fields are incomplete");
  }
  const runEventId = `run-result:${outcome.runId}`;
  if (draft.appliedEvents[runEventId]) {
    return { recorded: false, firstClear: false, runEventId, coffinOutcome: draft.campaign.pendingCoffinOutcome };
  }

  const entry = scoreEntry(outcome, nowValue);
  draft.totalRuns += 1;
  draft.totalWins += outcome.win ? 1 : 0;
  draft.totalScore += entry.score;
  draft.bestScore = Math.max(draft.bestScore, entry.score);
  if (gradeRank(entry.grade) > gradeRank(draft.bestGrade)) draft.bestGrade = entry.grade;
  draft.scores.push(entry);
  draft.scores.sort((left, right) => right.score - left.score);
  draft.scores = draft.scores.slice(0, 50);

  let firstClear = false;
  let coffinOutcome = null;
  if (outcome.win && outcome.mode === "campaign") {
    const clearId = campaignClearEventId(outcome.campaignNight);
    firstClear = !draft.appliedEvents[clearId];
    if (firstClear) {
      draft.campaign.clears[`night-${outcome.campaignNight}`] = {
        eventId: clearId,
        clearedAt: nowValue,
        grade: entry.grade,
        score: entry.score,
      };
      draft.campaign.unlockedNight = Math.max(draft.campaign.unlockedNight, Math.min(15, outcome.campaignNight + 1));
      draft.economy.events[clearId] = {
        amount: 1,
        source: "first-clear",
        grantedAt: nowValue,
      };
      draft.appliedEvents[clearId] = { appliedAt: nowValue };
      if (outcome.campaignNight === 1) {
        const thrallUnlockId = "campaign:night-01:unlock-create-thrall";
        draft.campaign.abilityUnlocks.createThrall = true;
        draft.appliedEvents[thrallUnlockId] = { appliedAt: nowValue };
        if (!draft.bloodline.loadoutConfigured) {
          draft.bloodline.loadout = ["createThrall"];
          draft.bloodline.loadoutConfigured = true;
        }
      }
      if (outcome.campaignNight === 5) {
        const mistUnlockId = "campaign:night-05:unlock-mist";
        const huntUnlockId = "campaign:night-05:unlock-hunt";
        draft.campaign.abilityUnlocks.mist = true;
        draft.hunt.unlocked = true;
        draft.appliedEvents[mistUnlockId] = { appliedAt: nowValue };
        draft.appliedEvents[huntUnlockId] = { appliedAt: nowValue };
      }
      if (outcome.campaignNight === 10) {
        const swarmUnlockId = "campaign:night-10:unlock-swarm";
        draft.campaign.abilityUnlocks.swarm = true;
        draft.appliedEvents[swarmUnlockId] = { appliedAt: nowValue };
      }
      if (outcome.campaignNight === 15) {
        const endingId = "campaign:night-15:ending";
        const ascensionId = "campaign:night-15:unlock-ascension";
        draft.campaign.endingUnlocked = true;
        draft.hunt.ascensionUnlocked = true;
        draft.appliedEvents[endingId] = { appliedAt: nowValue };
        draft.appliedEvents[ascensionId] = { appliedAt: nowValue };
      }
    }
    coffinOutcome = {
      eventId: runEventId,
      mode: "campaign",
      night: outcome.campaignNight,
      nextNight: outcome.campaignNight < 15 ? outcome.campaignNight + 1 : null,
      mistUnlocked: firstClear && outcome.campaignNight === 5,
      huntUnlocked: firstClear && outcome.campaignNight === 5,
      swarmUnlocked: firstClear && outcome.campaignNight === 10,
      endingUnlocked: firstClear && outcome.campaignNight === 15,
      firstClear,
      bloodPacks: firstClear ? 1 : 0,
      grade: entry.grade,
      score: entry.score,
      clearedAt: nowValue,
    };
  } else if (outcome.win && outcome.mode === "hunt") {
    const depthKey = `depth-${outcome.huntDepth}`;
    draft.hunt.bestDepth = Math.max(draft.hunt.bestDepth, outcome.huntDepth);
    if (!draft.hunt.scores[depthKey] || entry.score > draft.hunt.scores[depthKey].score) {
      draft.hunt.scores[depthKey] = { score: entry.score, grade: entry.grade, clearedAt: nowValue };
    }
    coffinOutcome = {
      eventId: runEventId,
      mode: "hunt",
      depth: outcome.huntDepth,
      nextDepth: outcome.huntDepth + 1,
      firstClear: false,
      bloodPacks: 0,
      grade: entry.grade,
      score: entry.score,
      clearedAt: nowValue,
    };
  }

  if (coffinOutcome) draft.campaign.pendingCoffinOutcome = coffinOutcome;
  draft.appliedEvents[runEventId] = { appliedAt: nowValue };
  return { recorded: true, firstClear, runEventId, coffinOutcome };
}

export function clearPendingCoffinOutcome(draft, eventId) {
  const pending = draft?.campaign?.pendingCoffinOutcome;
  if (!pending || pending.eventId !== eventId) return false;
  draft.campaign.pendingCoffinOutcome = null;
  return true;
}
