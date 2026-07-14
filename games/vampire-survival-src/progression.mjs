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
});

export const HUNT_PREVIEW_DEPTHS = Object.freeze({
  1: Object.freeze({
    id: "hunt-depth-1",
    title: "Hunt Depth 1",
    briefing: "Break 3 warding crosses, then survive until dawn.",
    crossQuota: 3,
    pressure: 1,
    eliteBonus: 0.01,
    enemyHp: 1,
    enemyDamage: 1,
    startingGuards: 3,
    startingHunters: 0,
    crossPoints: Object.freeze([[460, 420], [2680, 460], [1620, 1800]]),
  }),
  2: Object.freeze({
    id: "hunt-depth-2",
    title: "Hunt Depth 2",
    briefing: "Break 3 warding crosses. Patrols are faster and elites gather sooner.",
    crossQuota: 3,
    pressure: 1.24,
    eliteBonus: 0.09,
    enemyHp: 1.12,
    enemyDamage: 1.08,
    startingGuards: 6,
    startingHunters: 2,
    crossPoints: Object.freeze([[520, 1680], [1580, 360], [2700, 1680]]),
  }),
});

export const ABILITY_RULES = Object.freeze({
  feed: Object.freeze({ cost: 0, milestone: "Always available" }),
  dash: Object.freeze({ cost: 0, milestone: "Always available" }),
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
    authored = HUNT_PREVIEW_DEPTHS[huntDepth];
    if (!authored) throw new Error(`Hunt Depth ${huntDepth} is outside the preview`);
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

export function abilityAvailability(abilityId, { unlocked, cooldown = 0, blood = 0 } = {}) {
  const rule = ABILITY_RULES[abilityId];
  if (!rule) throw new Error(`Unknown ability ${abilityId}`);
  if (!unlocked) return { state: "locked", label: rule.milestone, ready: false, cost: rule.cost };
  if (cooldown > 0) return { state: "cooldown", label: `${cooldown.toFixed(1)}s`, ready: false, cost: rule.cost };
  if (blood < rule.cost) return { state: "insufficient", label: `Need ${rule.cost} Blood`, ready: false, cost: rule.cost };
  return { state: "ready", label: "Ready", ready: true, cost: rule.cost };
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
      draft.campaign.unlockedNight = Math.max(draft.campaign.unlockedNight, outcome.campaignNight + 1);
      draft.economy.events[clearId] = {
        amount: 1,
        source: "first-clear",
        grantedAt: nowValue,
      };
      draft.appliedEvents[clearId] = { appliedAt: nowValue };
    }
    coffinOutcome = {
      eventId: runEventId,
      mode: "campaign",
      night: outcome.campaignNight,
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
      nextDepth: outcome.huntDepth < 2 ? outcome.huntDepth + 1 : null,
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
