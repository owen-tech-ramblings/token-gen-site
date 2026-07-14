export const PROFILE_SCHEMA_VERSION = 2;
export const PROFILE_STORAGE_KEY = "vampire_survival_profile_v2";
export const LEGACY_PROFILE_STORAGE_KEY = "vampire_survival_profile_v31";
export const PROFILE_RECOVERY_STORAGE_KEY = "vampire_survival_profile_v2_recovery";
export const MAX_SCORE_HISTORY = 50;

const DEFAULT_SETTINGS = Object.freeze({
  audio: true,
  shake: true,
  particles: true,
  contrast: false,
  reducedMotion: false,
});

const bloodlineNode = (node) => Object.freeze({ maxRank: 1, ...node });
const bloodlineBranch = (branch) => Object.freeze({ ...branch, nodes: Object.freeze(branch.nodes.map(bloodlineNode)) });

export const BLOODLINE_BRANCHES = Object.freeze([
  bloodlineBranch({
    id: "hunger",
    name: "Crimson Hunger",
    theme: "Blood, feeding, and recovery",
    nodes: [
      { id: "crimson-reservoir", name: "Crimson Reservoir", cost: 1, prerequisite: null, stat: "maxBlood", operation: "add", amount: 12, effect: "+12 maximum Blood", flavor: "A deeper thirst survives a longer night." },
      { id: "predator-teeth", name: "Predator's Teeth", cost: 1, prerequisite: "crimson-reservoir", stat: "feedDamage", operation: "add", amount: 4, effect: "+4 Feed damage", flavor: "The first bite teaches the second." },
      { id: "red-harvest", name: "Red Harvest", cost: 2, prerequisite: "predator-teeth", stat: "roseHeal", operation: "add", amount: 4, effect: "+4 Blood from roses", flavor: "Even fallen petals remember the vein." },
      { id: "blood-feast", name: "Blood Feast", cost: 2, prerequisite: "red-harvest", stat: "feedDamage", operation: "add", amount: 5, effect: "+5 Feed damage", flavor: "A city is only a banquet that learned to build walls." },
      { id: "undying-thirst", name: "Undying Thirst", cost: 3, prerequisite: "blood-feast", stat: "maxBlood", operation: "add", amount: 16, effect: "+16 maximum Blood", flavor: "Dawn finds the ancient hunger still awake." },
      { id: "crimson-eternity", name: "Crimson Eternity", cost: 3, prerequisite: "undying-thirst", stat: "feedDamage", operation: "add", amount: 6, effect: "+6 Feed damage", flavor: "Centuries refine hunger into an art." },
      { id: "heart-of-night", name: "Heart of Night", cost: 4, prerequisite: "crimson-eternity", stat: "maxBlood", operation: "add", amount: 20, effect: "+20 maximum Blood", flavor: "Night itself keeps time inside the chest." },
    ],
  }),
  bloodlineBranch({
    id: "moonstride",
    name: "Moonstride",
    theme: "Movement, escape, and Mist",
    nodes: [
      { id: "fleet-shadow", name: "Fleet Shadow", cost: 1, prerequisite: null, stat: "speed", operation: "multiply", amount: 1.04, effect: "+4% movement speed", flavor: "Moonlight arrives after the shadow has gone." },
      { id: "spectral-step", name: "Spectral Step", cost: 1, prerequisite: "fleet-shadow", stat: "dashCooldown", operation: "add", amount: -0.25, effect: "-0.25s Dash cooldown", flavor: "Stone forgets the foot that never landed." },
      { id: "lingering-mist", name: "Lingering Mist", cost: 2, prerequisite: "spectral-step", stat: "mistDuration", operation: "add", amount: 0.3, effect: "+0.30s Mist duration", flavor: "The fog remains after the hunter looks away." },
      { id: "veil-runner", name: "Veil Runner", cost: 2, prerequisite: "lingering-mist", stat: "mistBase", operation: "multiply", amount: 0.9, effect: "-10% Mist cooldown", flavor: "Every veil is a road to those without breath." },
      { id: "moonless-flight", name: "Moonless Flight", cost: 3, prerequisite: "veil-runner", stat: "speed", operation: "multiply", amount: 1.04, effect: "+4% movement speed", flavor: "No moon is needed when shadow remembers the way." },
      { id: "mist-sovereign", name: "Mist Sovereign", cost: 3, prerequisite: "moonless-flight", stat: "mistDuration", operation: "add", amount: 0.3, effect: "+0.30s Mist duration", flavor: "The body becomes a rumour the wind repeats." },
      { id: "eclipse-step", name: "Eclipse Step", cost: 4, prerequisite: "mist-sovereign", stat: "dashCooldown", operation: "add", amount: -0.3, effect: "-0.30s Dash cooldown", flavor: "Move in the instant when sun and moon disagree." },
    ],
  }),
  bloodlineBranch({
    id: "nightborn",
    name: "Nightborn Arts",
    theme: "Reach, wards, and frenzy",
    nodes: [
      { id: "long-fangs", name: "Long Fangs", cost: 1, prerequisite: null, stat: "range", operation: "add", amount: 8, effect: "+8 attack range", flavor: "Distance is only another superstition." },
      { id: "wardbreaker", name: "Wardbreaker", cost: 1, prerequisite: "long-fangs", stat: "relicDamage", operation: "add", amount: 10, effect: "+10 warding-cross damage", flavor: "Faith cracks where patience keeps striking." },
      { id: "midnight-fervor", name: "Midnight Fervor", cost: 2, prerequisite: "wardbreaker", stat: "frenzyGain", operation: "multiply", amount: 1.12, effect: "+12% frenzy gain", flavor: "The darkest hour beats like a second heart." },
      { id: "thrall-mastery", name: "Thrall Mastery", cost: 2, prerequisite: "midnight-fervor", stat: "thrallLifetime", operation: "add", amount: 6, effect: "+6s Thrall lifetime", flavor: "Obedience outlives the voice that ordered it." },
      { id: "swarm-crown", name: "Swarm Crown", cost: 3, prerequisite: "thrall-mastery", stat: "swarmDamage", operation: "add", amount: 8, effect: "+8 Swarm damage", flavor: "A thousand wings make one royal shadow." },
      { id: "legion-command", name: "Legion Command", cost: 3, prerequisite: "swarm-crown", stat: "thrallDamage", operation: "add", amount: 5, effect: "+5 Thrall damage", flavor: "One glance sends the dead to war." },
      { id: "nightfall-wings", name: "Nightfall Wings", cost: 4, prerequisite: "legion-command", stat: "swarmRadius", operation: "add", amount: 30, effect: "+30 Swarm radius", flavor: "The horizon darkens beneath obedient wings." },
    ],
  }),
]);

export const BASE_RUN_STATS = Object.freeze({
  maxBlood: 112,
  speed: 248,
  range: 74,
  feedDamage: 25,
  dashCooldown: 2.35,
  mistBase: 8.5,
  mistDuration: 2.15,
  swarmDamage: 34,
  swarmRadius: 215,
  thrallLifetime: 28,
  thrallDamage: 16,
  relicDamage: 48,
  comboWindow: 3.2,
  magnet: 28,
  roseHeal: 18,
  frenzyGain: 1,
});

export const TALENT_TECHNIQUES = Object.freeze([
  Object.freeze({ id: "createThrall", name: "Create Thrall", key: "Q", prerequisite: "Survive Campaign Night 1", description: "Convert the nearest marked mortal into a temporary ally." }),
  Object.freeze({ id: "mist", name: "Mist Form", key: "F", prerequisite: "Defeat Captain Voss on Night 5", description: "Become untouchable and surge through the hunters." }),
  Object.freeze({ id: "swarm", name: "Bat Swarm", key: "E", prerequisite: "Defeat the Night 10 boss", description: "Unleash a damaging swarm around the vampire." }),
]);
export const MAX_TALENT_SLOTS = 2;
const TALENT_TECHNIQUE_IDS = new Set(TALENT_TECHNIQUES.map((technique) => technique.id));

export function isTechniqueUnlocked(profile, techniqueId) {
  if (!TALENT_TECHNIQUE_IDS.has(techniqueId)) return false;
  if (techniqueId === "createThrall") return Boolean(profile.campaign.clears["night-1"]);
  if (techniqueId === "mist") return Boolean(profile.campaign.clears["night-5"]);
  if (techniqueId === "swarm") return Boolean(profile.campaign.clears["night-10"]);
  return false;
}

export function validateTalentLoadout(profile) {
  const loadout = profile?.bloodline?.loadout;
  if (!Array.isArray(loadout) || loadout.length > MAX_TALENT_SLOTS) throw new Error(`Talent loadout supports ${MAX_TALENT_SLOTS} slots`);
  if (new Set(loadout).size !== loadout.length) throw new Error("Talent loadout cannot contain duplicates");
  for (const techniqueId of loadout) {
    if (!TALENT_TECHNIQUE_IDS.has(techniqueId)) throw new Error(`Unknown talent technique ${techniqueId}`);
    if (!isTechniqueUnlocked(profile, techniqueId)) throw new Error(`${techniqueId} is not unlocked`);
  }
  return true;
}

export function toggleTalentTechnique(profile, techniqueId) {
  if (!TALENT_TECHNIQUE_IDS.has(techniqueId)) throw new Error(`Unknown talent technique ${techniqueId}`);
  if (!isTechniqueUnlocked(profile, techniqueId)) throw new Error(`${techniqueId} is still locked`);
  const current = [...profile.bloodline.loadout];
  const index = current.indexOf(techniqueId);
  if (index >= 0) current.splice(index, 1);
  else {
    if (current.length >= MAX_TALENT_SLOTS) throw new Error(`Both talent slots are occupied`);
    current.push(techniqueId);
  }
  profile.bloodline.loadout = current;
  profile.bloodline.loadoutConfigured = true;
  validateTalentLoadout(profile);
  return { selected: index < 0, loadout: [...current] };
}

const BLOODLINE_NODES = Object.freeze(BLOODLINE_BRANCHES.flatMap((branch) => branch.nodes));
const BLOODLINE_NODE_MAP = new Map(BLOODLINE_NODES.map((node) => [node.id, node]));

export function bloodlineNodeById(nodeId) {
  return BLOODLINE_NODE_MAP.get(nodeId) || null;
}

function activeBloodlinePurchases(bloodline) {
  return Object.entries(bloodline.purchases || {})
    .map(([nodeId, purchase]) => ({ nodeId, ...purchase }))
    .sort((left, right) => left.sequence - right.sequence);
}

export function validateBloodlineState(bloodline) {
  if (!isRecord(bloodline) || !isRecord(bloodline.allocation) || !isRecord(bloodline.purchases)) {
    throw new Error("Invalid Bloodline state");
  }
  if (!Number.isInteger(bloodline.nextTransaction) || bloodline.nextTransaction < 1) {
    throw new Error("Invalid Bloodline transaction counter");
  }
  if (bloodline.lastPurchaseId !== null && typeof bloodline.lastPurchaseId !== "string") {
    throw new Error("Invalid Bloodline undo state");
  }
  const seenTransactions = new Set();
  let latest = null;
  for (const [nodeId, rank] of Object.entries(bloodline.allocation)) {
    const node = bloodlineNodeById(nodeId);
    if (!node || rank !== 1) throw new Error(`Invalid Bloodline rank for ${nodeId}`);
    if (node.prerequisite && bloodline.allocation[node.prerequisite] !== 1) {
      throw new Error(`Bloodline prerequisite missing for ${nodeId}`);
    }
    const purchase = bloodline.purchases[nodeId];
    if (!isRecord(purchase) || typeof purchase.transactionId !== "string" || !purchase.transactionId
      || !Number.isInteger(purchase.sequence) || purchase.sequence < 1 || purchase.cost !== node.cost) {
      throw new Error(`Invalid Bloodline purchase for ${nodeId}`);
    }
    if (seenTransactions.has(purchase.transactionId)) throw new Error("Duplicate Bloodline transaction");
    seenTransactions.add(purchase.transactionId);
    if (!latest || purchase.sequence > latest.sequence) latest = { nodeId, sequence: purchase.sequence };
  }
  for (const nodeId of Object.keys(bloodline.purchases)) {
    if (bloodline.allocation[nodeId] !== 1) throw new Error(`Orphaned Bloodline purchase for ${nodeId}`);
  }
  if (latest && bloodline.nextTransaction <= latest.sequence) throw new Error("Bloodline transaction counter is stale");
  if ((latest?.nodeId || null) !== bloodline.lastPurchaseId) throw new Error("Bloodline undo state is stale");
  return true;
}

export function bloodlineNodeStatus(profile, nodeId) {
  const node = bloodlineNodeById(nodeId);
  if (!node) throw new Error(`Unknown Bloodline node ${nodeId}`);
  const owned = profile.bloodline.allocation[nodeId] === 1;
  const prerequisiteMet = !node.prerequisite || profile.bloodline.allocation[node.prerequisite] === 1;
  const balance = profileBalance(profile);
  return { node, owned, prerequisiteMet, affordable: balance >= node.cost, available: !owned && prerequisiteMet && balance >= node.cost, balance };
}

export function purchaseBloodlineNode(profile, nodeId, nowValue = new Date().toISOString()) {
  validateBloodlineState(profile.bloodline);
  const status = bloodlineNodeStatus(profile, nodeId);
  if (status.owned) throw new Error(`${status.node.name} is already owned`);
  if (!status.prerequisiteMet) throw new Error(`Purchase ${bloodlineNodeById(status.node.prerequisite).name} first`);
  if (!status.affordable) throw new Error(`Need ${status.node.cost} Blood Pack${status.node.cost === 1 ? "" : "s"}`);
  const sequence = profile.bloodline.nextTransaction;
  const transactionId = `bloodline:purchase:${sequence}:${nodeId}`;
  profile.economy.events[transactionId] = { amount: -status.node.cost, source: "bloodline-purchase", nodeId, appliedAt: nowValue };
  profile.bloodline.allocation[nodeId] = 1;
  profile.bloodline.purchases[nodeId] = { transactionId, sequence, cost: status.node.cost, purchasedAt: nowValue };
  profile.bloodline.nextTransaction = sequence + 1;
  profile.bloodline.lastPurchaseId = nodeId;
  validateBloodlineState(profile.bloodline);
  if (profileBalance(profile) < 0) throw new Error("Bloodline purchase produced a negative balance");
  return { applied: true, node: status.node, transactionId, balance: profileBalance(profile) };
}

export function undoBloodlinePurchase(profile, nowValue = new Date().toISOString()) {
  validateBloodlineState(profile.bloodline);
  const nodeId = profile.bloodline.lastPurchaseId;
  if (!nodeId) return { applied: false, reason: "Nothing to undo", balance: profileBalance(profile) };
  const dependent = BLOODLINE_NODES.find((node) => node.prerequisite === nodeId && profile.bloodline.allocation[node.id] === 1);
  if (dependent) throw new Error(`${bloodlineNodeById(nodeId).name} is required by ${dependent.name}`);
  const purchase = profile.bloodline.purchases[nodeId];
  const sequence = profile.bloodline.nextTransaction;
  const transactionId = `bloodline:undo:${sequence}:${purchase.transactionId}`;
  profile.economy.events[transactionId] = { amount: purchase.cost, source: "bloodline-undo", nodeId, appliedAt: nowValue };
  delete profile.bloodline.allocation[nodeId];
  delete profile.bloodline.purchases[nodeId];
  profile.bloodline.nextTransaction = sequence + 1;
  const remaining = activeBloodlinePurchases(profile.bloodline);
  profile.bloodline.lastPurchaseId = remaining.at(-1)?.nodeId || null;
  validateBloodlineState(profile.bloodline);
  return { applied: true, node: bloodlineNodeById(nodeId), transactionId, balance: profileBalance(profile) };
}

export function respecBloodline(profile, nowValue = new Date().toISOString()) {
  validateBloodlineState(profile.bloodline);
  const purchases = activeBloodlinePurchases(profile.bloodline);
  if (!purchases.length) return { applied: false, reason: "No Bloodline nodes to respec", refunded: 0, balance: profileBalance(profile) };
  const refunded = purchases.reduce((total, purchase) => total + purchase.cost, 0);
  const sequence = profile.bloodline.nextTransaction;
  const transactionId = `bloodline:respec:${sequence}`;
  profile.economy.events[transactionId] = { amount: refunded, source: "bloodline-respec", nodes: purchases.map((purchase) => purchase.nodeId), appliedAt: nowValue };
  profile.bloodline.allocation = {};
  profile.bloodline.purchases = {};
  profile.bloodline.nextTransaction = sequence + 1;
  profile.bloodline.lastPurchaseId = null;
  validateBloodlineState(profile.bloodline);
  return { applied: true, transactionId, refunded, balance: profileBalance(profile) };
}

export function deriveBloodlineRunStats(allocation = {}, baseStats = BASE_RUN_STATS) {
  const stats = { ...baseStats };
  const activeNodes = [];
  for (const node of BLOODLINE_NODES) {
    if (allocation[node.id] !== 1) continue;
    activeNodes.push(node.id);
    if (node.operation === "add") stats[node.stat] += node.amount;
    else if (node.operation === "multiply") stats[node.stat] *= node.amount;
    else throw new Error(`Unknown Bloodline effect operation ${node.operation}`);
  }
  stats.activeNodes = activeNodes;
  return stats;
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requireProfileShape(candidate) {
  const required = [
    "profileId", "revision", "updatedAt", "totalRuns", "totalWins", "totalScore",
    "bestScore", "bestGrade", "achievements", "scores", "settings", "campaign",
    "economy", "bloodline", "hunt", "appliedEvents", "migration",
  ];
  for (const key of required) if (!has(candidate, key)) throw new Error(`Missing profile field ${key}`);
  if (typeof candidate.profileId !== "string" || !candidate.profileId) throw new Error("Invalid profile ID");
  if (!Number.isInteger(candidate.revision) || candidate.revision < 0) throw new Error("Invalid profile revision");
  if (candidate.updatedAt !== null && typeof candidate.updatedAt !== "string") throw new Error("Invalid profile update timestamp");
  for (const key of ["totalRuns", "totalWins"]) {
    if (!Number.isInteger(candidate[key]) || candidate[key] < 0) throw new Error(`Invalid profile field ${key}`);
  }
  for (const key of ["totalScore", "bestScore"]) {
    if (!Number.isFinite(candidate[key]) || candidate[key] < 0) throw new Error(`Invalid profile field ${key}`);
  }
  if (typeof candidate.bestGrade !== "string") throw new Error("Invalid best grade");
  if (!Array.isArray(candidate.achievements) || candidate.achievements.some((item) => typeof item !== "string")) {
    throw new Error("Invalid achievement history");
  }
  if (!Array.isArray(candidate.scores) || candidate.scores.some((score) => !isRecord(score))) {
    throw new Error("Invalid score history");
  }
  for (const score of candidate.scores) {
    if (!Number.isFinite(score.score) || score.score < 0 || !Number.isFinite(score.time) || score.time < 0
      || typeof score.grade !== "string" || typeof score.win !== "boolean"
      || typeof score.difficulty !== "string" || typeof score.date !== "string") {
      throw new Error("Invalid score entry");
    }
    if (has(score, "runId") && (typeof score.runId !== "string" || !score.runId)) throw new Error("Invalid score run ID");
  }
  for (const key of ["settings", "campaign", "economy", "bloodline", "hunt", "appliedEvents", "migration"]) {
    if (!isRecord(candidate[key])) throw new Error(`Invalid profile section ${key}`);
  }
  if (has(candidate.settings, "audio") && typeof candidate.settings.audio !== "boolean") throw new Error("Invalid audio setting");
  if (has(candidate.settings, "shake") && typeof candidate.settings.shake !== "boolean") throw new Error("Invalid shake setting");
  if (has(candidate.settings, "particles") && typeof candidate.settings.particles !== "boolean") throw new Error("Invalid particles setting");
  if (has(candidate.settings, "contrast") && typeof candidate.settings.contrast !== "boolean") throw new Error("Invalid contrast setting");
  if (has(candidate.settings, "reducedMotion") && typeof candidate.settings.reducedMotion !== "boolean") throw new Error("Invalid reduced-motion setting");
  if (has(candidate.campaign, "clears") && !isRecord(candidate.campaign.clears)) throw new Error("Invalid campaign clears");
  if (has(candidate.campaign, "abilityUnlocks") && !isRecord(candidate.campaign.abilityUnlocks)) throw new Error("Invalid ability unlocks");
  if (isRecord(candidate.campaign.abilityUnlocks)) {
    for (const [ability, unlocked] of Object.entries(candidate.campaign.abilityUnlocks)) {
      if (typeof unlocked !== "boolean") throw new Error(`Invalid ability unlock ${ability}`);
    }
  }
  if (has(candidate.economy, "events") && !isRecord(candidate.economy.events)) throw new Error("Invalid economy events");
  if (has(candidate.bloodline, "allocation") && !isRecord(candidate.bloodline.allocation)) throw new Error("Invalid Bloodline allocation");
  if (has(candidate.bloodline, "purchases") && !isRecord(candidate.bloodline.purchases)) throw new Error("Invalid Bloodline purchases");
  if (has(candidate.bloodline, "loadout") && (!Array.isArray(candidate.bloodline.loadout) || candidate.bloodline.loadout.some((item) => typeof item !== "string"))) {
    throw new Error("Invalid Bloodline loadout");
  }
  if (has(candidate.hunt, "scores") && !isRecord(candidate.hunt.scores)) throw new Error("Invalid Hunt scores");
  if (has(candidate.migration, "sourceSnapshot") && candidate.migration.sourceSnapshot !== null && !isRecord(candidate.migration.sourceSnapshot)) {
    throw new Error("Invalid migration source snapshot");
  }
}

function textFingerprint(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function localProfileId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `local:${globalThis.crypto.randomUUID()}`;
  }
  return `local:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function freshProfileV2(options = {}) {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profileId: options.profileId || localProfileId(),
    revision: nonNegativeInteger(options.revision, 0),
    updatedAt: options.updatedAt || null,
    totalRuns: 0,
    totalWins: 0,
    totalScore: 0,
    bestScore: 0,
    bestGrade: "D",
    achievements: [],
    scores: [],
    settings: { ...DEFAULT_SETTINGS },
    campaign: {
      unlockedNight: 1,
      clears: {},
      abilityUnlocks: { feed: true, dash: true, mist: false, swarm: false, createThrall: false },
      endingUnlocked: false,
      endingSeen: false,
      pendingCoffinOutcome: null,
    },
    economy: { events: {} },
    bloodline: { allocation: {}, purchases: {}, loadout: [], loadoutConfigured: false, nextTransaction: 1, lastPurchaseId: null },
    hunt: { unlocked: false, ascensionUnlocked: false, bestDepth: 0, scores: {} },
    appliedEvents: {},
    migration: { sourceVersion: null, sourceFingerprint: null, sourceSnapshot: null, migratedAt: null },
  };
}

export function normaliseProfileV2(candidate) {
  if (!isRecord(candidate) || candidate.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error("Unsupported Vampire Survival profile schema");
  }
  requireProfileShape(candidate);
  const base = freshProfileV2({ profileId: candidate.profileId, revision: candidate.revision, updatedAt: candidate.updatedAt });
  const profile = {
    ...base,
    ...clone(candidate),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    profileId: typeof candidate.profileId === "string" && candidate.profileId ? candidate.profileId : base.profileId,
    revision: nonNegativeInteger(candidate.revision, 0),
    updatedAt: typeof candidate.updatedAt === "string" || candidate.updatedAt === null ? candidate.updatedAt : null,
    totalRuns: nonNegativeInteger(candidate.totalRuns, 0),
    totalWins: nonNegativeInteger(candidate.totalWins, 0),
    totalScore: Math.max(0, finiteNumber(candidate.totalScore, 0)),
    bestScore: Math.max(0, finiteNumber(candidate.bestScore, 0)),
    bestGrade: typeof candidate.bestGrade === "string" ? candidate.bestGrade : "D",
    achievements: Array.isArray(candidate.achievements) ? [...new Set(candidate.achievements.filter((item) => typeof item === "string"))] : [],
    scores: clone(candidate.scores).sort((left, right) => finiteNumber(right.score) - finiteNumber(left.score)).slice(0, MAX_SCORE_HISTORY),
    settings: { ...DEFAULT_SETTINGS, ...(candidate.settings || {}) },
    campaign: { ...base.campaign, ...(candidate.campaign || {}), abilityUnlocks: { ...base.campaign.abilityUnlocks, ...(candidate.campaign?.abilityUnlocks || {}) }, clears: { ...(candidate.campaign?.clears || {}) } },
    economy: { events: { ...(candidate.economy?.events || {}) } },
    bloodline: { ...base.bloodline, ...(candidate.bloodline || {}), allocation: { ...(candidate.bloodline?.allocation || {}) }, purchases: { ...(candidate.bloodline?.purchases || {}) }, loadout: Array.isArray(candidate.bloodline?.loadout) ? [...candidate.bloodline.loadout] : [...base.bloodline.loadout], loadoutConfigured: Boolean(candidate.bloodline?.loadoutConfigured), nextTransaction: Number.isInteger(candidate.bloodline?.nextTransaction) ? candidate.bloodline.nextTransaction : base.bloodline.nextTransaction, lastPurchaseId: typeof candidate.bloodline?.lastPurchaseId === "string" ? candidate.bloodline.lastPurchaseId : null },
    hunt: { ...base.hunt, ...(candidate.hunt || {}), scores: { ...(candidate.hunt?.scores || {}) } },
    appliedEvents: { ...(candidate.appliedEvents || {}) },
    migration: { ...base.migration, ...(candidate.migration || {}) },
  };
  Object.keys(DEFAULT_SETTINGS).forEach((key) => { profile.settings[key] = Boolean(profile.settings[key]); });
  if (!Number.isInteger(profile.campaign.unlockedNight) || profile.campaign.unlockedNight < 1) {
    throw new Error("Campaign night must be a positive integer");
  }
  if (!Number.isInteger(profile.hunt.bestDepth) || profile.hunt.bestDepth < 0) {
    throw new Error("Hunt depth must be a non-negative integer");
  }
  profile.campaign.abilityUnlocks.mist = Boolean(profile.campaign.clears["night-5"]);
  profile.campaign.abilityUnlocks.swarm = Boolean(profile.campaign.clears["night-10"]);
  profile.campaign.abilityUnlocks.createThrall = Boolean(profile.campaign.clears["night-1"]);
  if (!profile.bloodline.loadoutConfigured && profile.campaign.abilityUnlocks.createThrall) {
    profile.bloodline.loadout = ["createThrall", ...(profile.campaign.abilityUnlocks.mist ? ["mist"] : [])].slice(0, MAX_TALENT_SLOTS);
    profile.bloodline.loadoutConfigured = true;
  }
  profile.hunt.unlocked = Boolean(profile.campaign.clears["night-5"]);
  profile.campaign.endingUnlocked = Boolean(profile.campaign.clears["night-15"]);
  profile.campaign.endingSeen = Boolean(profile.campaign.endingSeen);
  profile.hunt.ascensionUnlocked = Boolean(profile.campaign.clears["night-15"]);
  validateBloodlineState(profile.bloodline);
  validateTalentLoadout(profile);
  for (const [eventId, event] of Object.entries(profile.economy.events)) {
    if (!event || !Number.isFinite(event.amount)) throw new Error(`Invalid economy event ${eventId}`);
  }
  if (profileBalance(profile) < 0) throw new Error("Profile currency balance cannot be negative");
  return profile;
}

export function migrateLegacyProfile(rawLegacy, options = {}) {
  const legacy = typeof rawLegacy === "string" ? JSON.parse(rawLegacy) : clone(rawLegacy);
  if (!isRecord(legacy) || legacy.version !== 1 || !Array.isArray(legacy.achievements)
    || legacy.achievements.some((item) => typeof item !== "string")
    || !Array.isArray(legacy.scores) || legacy.scores.some((score) => !isRecord(score))) {
    throw new Error("Invalid Vampire Survival v31 profile");
  }
  for (const key of ["totalRuns", "totalWins"]) {
    if (!Number.isInteger(legacy[key]) || legacy[key] < 0) throw new Error(`Invalid v31 field ${key}`);
  }
  for (const key of ["totalScore", "bestScore"]) {
    if (!Number.isFinite(legacy[key]) || legacy[key] < 0) throw new Error(`Invalid v31 field ${key}`);
  }
  if (typeof legacy.bestGrade !== "string") throw new Error("Invalid v31 best grade");
  if (!isRecord(legacy.settings)) throw new Error("Invalid v31 settings");
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (has(legacy.settings, key) && typeof legacy.settings[key] !== "boolean") throw new Error(`Invalid v31 setting ${key}`);
  }
  for (const score of legacy.scores) {
    if (!Number.isFinite(score.score) || score.score < 0 || !Number.isFinite(score.time) || score.time < 0
      || typeof score.grade !== "string" || typeof score.win !== "boolean"
      || typeof score.difficulty !== "string" || typeof score.date !== "string") {
      throw new Error("Invalid v31 score entry");
    }
  }
  const rawText = typeof rawLegacy === "string" ? rawLegacy : JSON.stringify(rawLegacy);
  const migrated = freshProfileV2({
    profileId: options.profileId,
    revision: 1,
    updatedAt: options.now || new Date().toISOString(),
  });
  migrated.totalRuns = legacy.totalRuns;
  migrated.totalWins = legacy.totalWins;
  migrated.totalScore = legacy.totalScore;
  migrated.bestScore = legacy.bestScore;
  migrated.bestGrade = legacy.bestGrade;
  migrated.achievements = [...new Set(legacy.achievements)];
  migrated.scores = clone(legacy.scores).slice(0, MAX_SCORE_HISTORY);
  migrated.settings = { ...DEFAULT_SETTINGS, ...legacy.settings };
  migrated.migration = {
    sourceVersion: 1,
    sourceFingerprint: textFingerprint(rawText),
    sourceSnapshot: {
      totalRuns: migrated.totalRuns,
      totalWins: migrated.totalWins,
      totalScore: migrated.totalScore,
      bestScore: migrated.bestScore,
      bestGrade: migrated.bestGrade,
      achievements: clone(migrated.achievements),
      scores: clone(migrated.scores),
      settings: clone(migrated.settings),
    },
    migratedAt: migrated.updatedAt,
  };
  return normaliseProfileV2(migrated);
}

export function profileBalance(profile) {
  return Object.values(profile.economy?.events || {}).reduce((total, event) => total + finiteNumber(event?.amount, 0), 0);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function scoreIdentity(score) {
  if (score.runId) return `run:${score.runId}`;
  return `legacy:${[score.score, score.time, score.grade, score.win, score.difficulty, score.date].join("\u001f")}`;
}

function mergeScoreAdditions(baseScores, localScores, latestScores) {
  const merged = clone(latestScores);
  const count = (scores) => scores.reduce((counts, score) => {
    const identity = scoreIdentity(score);
    counts.set(identity, (counts.get(identity) || 0) + 1);
    return counts;
  }, new Map());
  const baseCounts = count(baseScores);
  const localCounts = count(localScores);
  const mergedCounts = count(merged);
  const localSamples = new Map(localScores.map((score) => [scoreIdentity(score), score]));
  for (const [identity, localCount] of localCounts) {
    const baseCount = baseCounts.get(identity) || 0;
    const latestCount = mergedCounts.get(identity) || 0;
    const targetCount = identity.startsWith("run:")
      ? Math.max(latestCount, localCount)
      : latestCount + Math.max(0, localCount - baseCount);
    for (let occurrence = latestCount; occurrence < targetCount; occurrence += 1) {
      merged.push(clone(localSamples.get(identity)));
    }
  }
  return merged.sort((left, right) => finiteNumber(right.score) - finiteNumber(left.score)).slice(0, MAX_SCORE_HISTORY);
}

function mergeRecordAdditions(baseRecord, localRecord, latestRecord, label) {
  const merged = clone(latestRecord);
  for (const [key, localValue] of Object.entries(localRecord)) {
    if (has(baseRecord, key) && sameValue(baseRecord[key], localValue)) continue;
    if (has(merged, key) && !sameValue(merged[key], localValue) && (!has(baseRecord, key) || !sameValue(baseRecord[key], merged[key]))) {
      throw new Error(`Concurrent ${label} conflict for ${key}`);
    }
    merged[key] = clone(localValue);
  }
  return merged;
}

function counterWithLocalDelta(baseValue, localValue, latestValue, label) {
  const delta = localValue - baseValue;
  if (delta < 0) throw new Error(`Concurrent ${label} cannot decrease`);
  return latestValue + delta;
}

export function mergeConcurrentProfiles(baseCandidate, localCandidate, latestCandidate) {
  const base = normaliseProfileV2(baseCandidate);
  const local = normaliseProfileV2(localCandidate);
  const latest = normaliseProfileV2(latestCandidate);
  if (base.profileId !== local.profileId || base.profileId !== latest.profileId) {
    throw new Error("Cannot merge profiles with different identities");
  }
  const merged = clone(latest);
  merged.totalRuns = counterWithLocalDelta(base.totalRuns, local.totalRuns, latest.totalRuns, "run count");
  merged.totalWins = counterWithLocalDelta(base.totalWins, local.totalWins, latest.totalWins, "win count");
  merged.totalScore = counterWithLocalDelta(base.totalScore, local.totalScore, latest.totalScore, "total score");
  merged.bestScore = Math.max(local.bestScore, latest.bestScore);
  const gradeOrder = { D: 0, "D+": 1, C: 2, B: 3, A: 4, S: 5 };
  merged.bestGrade = (gradeOrder[local.bestGrade] || 0) > (gradeOrder[latest.bestGrade] || 0) ? local.bestGrade : latest.bestGrade;
  merged.achievements = [...new Set([...latest.achievements, ...local.achievements])];
  merged.scores = mergeScoreAdditions(base.scores, local.scores, latest.scores);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    merged.settings[key] = local.settings[key] !== base.settings[key] ? local.settings[key] : latest.settings[key];
  }
  merged.campaign.unlockedNight = Math.max(local.campaign.unlockedNight, latest.campaign.unlockedNight);
  merged.campaign.clears = mergeRecordAdditions(base.campaign.clears, local.campaign.clears, latest.campaign.clears, "campaign clear");
  for (const [ability, unlocked] of Object.entries(local.campaign.abilityUnlocks)) {
    merged.campaign.abilityUnlocks[ability] = Boolean(latest.campaign.abilityUnlocks[ability] || unlocked);
  }
  merged.campaign.endingUnlocked = Boolean(local.campaign.endingUnlocked || latest.campaign.endingUnlocked);
  const localCoffinChanged = !sameValue(local.campaign.pendingCoffinOutcome, base.campaign.pendingCoffinOutcome);
  const latestCoffinChanged = !sameValue(latest.campaign.pendingCoffinOutcome, base.campaign.pendingCoffinOutcome);
  if (localCoffinChanged && latestCoffinChanged && !sameValue(local.campaign.pendingCoffinOutcome, latest.campaign.pendingCoffinOutcome)) {
    throw new Error("Concurrent coffin outcomes require explicit resolution");
  }
  if (localCoffinChanged) {
    merged.campaign.pendingCoffinOutcome = clone(local.campaign.pendingCoffinOutcome);
  }
  merged.economy.events = mergeRecordAdditions(base.economy.events, local.economy.events, latest.economy.events, "economy event");
  const localBloodlineChanged = !sameValue(base.bloodline, local.bloodline);
  const latestBloodlineChanged = !sameValue(base.bloodline, latest.bloodline);
  if (localBloodlineChanged && latestBloodlineChanged && !sameValue(local.bloodline, latest.bloodline)) {
    throw new Error("Concurrent Bloodline changes require explicit resolution");
  }
  if (localBloodlineChanged) merged.bloodline = clone(local.bloodline);
  merged.hunt.unlocked = Boolean(local.hunt.unlocked || latest.hunt.unlocked);
  merged.hunt.bestDepth = Math.max(local.hunt.bestDepth, latest.hunt.bestDepth);
  merged.hunt.scores = mergeRecordAdditions(base.hunt.scores, local.hunt.scores, latest.hunt.scores, "Hunt score");
  merged.appliedEvents = mergeRecordAdditions(base.appliedEvents, local.appliedEvents, latest.appliedEvents, "profile event");
  merged.revision = latest.revision;
  merged.updatedAt = latest.updatedAt;
  return normaliseProfileV2(merged);
}

function profileFromLegacySnapshot(profileId, snapshot) {
  const baseline = freshProfileV2({ profileId, revision: 1 });
  if (!isRecord(snapshot)) return baseline;
  for (const key of ["totalRuns", "totalWins", "totalScore", "bestScore", "bestGrade", "achievements", "scores", "settings"]) {
    if (has(snapshot, key)) baseline[key] = clone(snapshot[key]);
  }
  return normaliseProfileV2(baseline);
}

export function reconcileLegacyRollback(currentCandidate, rawLegacy, nowValue = new Date().toISOString()) {
  const current = normaliseProfileV2(currentCandidate);
  const legacy = migrateLegacyProfile(rawLegacy, { profileId: current.profileId, now: nowValue });
  const baseline = profileFromLegacySnapshot(current.profileId, current.migration.sourceSnapshot);
  const reconciled = current.migration.sourceSnapshot
    ? mergeConcurrentProfiles(baseline, legacy, current)
    : {
        ...current,
        totalRuns: Math.max(current.totalRuns, legacy.totalRuns),
        totalWins: Math.max(current.totalWins, legacy.totalWins),
        totalScore: Math.max(current.totalScore, legacy.totalScore),
        bestScore: Math.max(current.bestScore, legacy.bestScore),
        achievements: [...new Set([...current.achievements, ...legacy.achievements])],
        scores: mergeScoreAdditions([], legacy.scores, current.scores),
        settings: clone(legacy.settings),
      };
  reconciled.migration = clone(legacy.migration);
  reconciled.revision = current.revision + 1;
  reconciled.updatedAt = nowValue;
  return normaliseProfileV2(reconciled);
}

export function createProfileRepository(storage, options = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("A Web Storage-compatible profile store is required");
  }
  const now = options.now || (() => new Date().toISOString());
  const makeId = options.makeId || localProfileId;
  let lastLoad = { source: "uninitialised", migrated: false, recoverableError: null };
  let baseline = null;

  function remember(profile) {
    baseline = clone(profile);
    return profile;
  }

  function preserveCorruptV2(raw) {
    try {
      storage.setItem(PROFILE_RECOVERY_STORAGE_KEY, JSON.stringify({
        sourceKey: PROFILE_STORAGE_KEY,
        preservedAt: now(),
        raw,
      }));
      return true;
    } catch {
      // Recovery is best effort. Loading must still fall back safely if storage is unavailable.
      return false;
    }
  }

  function write(profile) {
    const normalised = normaliseProfileV2(profile);
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalised));
    return remember(normalised);
  }

  return {
    load(loadOptions = {}) {
      const readOnly = loadOptions.readOnly === true;
      const rawV2 = storage.getItem(PROFILE_STORAGE_KEY);
      const rawLegacy = storage.getItem(LEGACY_PROFILE_STORAGE_KEY);
      let corruptV2Preserved = false;
      if (rawV2 !== null) {
        let loaded = null;
        try {
          loaded = normaliseProfileV2(JSON.parse(rawV2));
        } catch (error) {
          corruptV2Preserved = readOnly ? false : preserveCorruptV2(rawV2);
          lastLoad = { source: "v2-corrupt", migrated: false, recoverableError: String(error?.message || error) };
        }
        if (loaded) {
          const legacyChanged = rawLegacy !== null
            && loaded.migration.sourceVersion === 1
            && loaded.migration.sourceFingerprint !== textFingerprint(rawLegacy);
          if (legacyChanged) {
            try {
              const reconciled = reconcileLegacyRollback(loaded, rawLegacy, now());
              if (readOnly) {
                lastLoad = { source: "v31-rollback-pending", migrated: false, recoverableError: null };
                return remember(reconciled);
              }
              const written = write(reconciled);
              lastLoad = { source: "v31-rollback", migrated: true, recoverableError: null };
              return written;
            } catch (error) {
              lastLoad = { source: "v2", migrated: false, recoverableError: `Legacy rollback reconciliation failed: ${String(error?.message || error)}` };
            }
          } else {
            lastLoad = { source: "v2", migrated: false, recoverableError: null };
          }
          return remember(loaded);
        }
      }

      if (rawLegacy !== null) {
        try {
          const migrated = migrateLegacyProfile(rawLegacy, { profileId: makeId(), now: now() });
          if (readOnly) {
            lastLoad = { source: "v31-pending", migrated: false, recoverableError: lastLoad.recoverableError };
            return remember(migrated);
          }
          if (rawV2 !== null && !corruptV2Preserved) {
            lastLoad = { source: "v31-volatile", migrated: false, recoverableError: `${lastLoad.recoverableError}; corrupt v2 recovery copy could not be written` };
            return remember(migrated);
          }
          const written = write(migrated);
          lastLoad = { source: "v31", migrated: true, recoverableError: lastLoad.recoverableError };
          return written;
        } catch (error) {
          lastLoad = { source: "v31-corrupt", migrated: false, recoverableError: String(error?.message || error) };
        }
      }

      const fresh = freshProfileV2({ profileId: makeId() });
      lastLoad = { source: "fresh", migrated: false, recoverableError: lastLoad.recoverableError };
      if (readOnly) return remember(fresh);
      if (rawV2 === null || corruptV2Preserved) {
        try {
          return write(fresh);
        } catch (error) {
          lastLoad.source = "fresh-volatile";
          lastLoad.recoverableError = `${lastLoad.recoverableError}; fresh profile remained volatile: ${String(error?.message || error)}`;
        }
      } else {
        lastLoad.source = "fresh-volatile";
        lastLoad.recoverableError = `${lastLoad.recoverableError}; corrupt v2 recovery copy could not be written`;
      }
      return remember(fresh);
    },

    save(current, saveOptions = {}) {
      const next = normaliseProfileV2(current);
      const expectedRevision = saveOptions.expectedRevision ?? next.revision;
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("Expected profile revision must be a non-negative integer");
      const rawStored = storage.getItem(PROFILE_STORAGE_KEY);
      if (rawStored === null) {
        if (expectedRevision !== 0) throw new Error(`Stale profile revision: expected ${expectedRevision}, stored profile is missing`);
      } else {
        let stored;
        try {
          stored = normaliseProfileV2(JSON.parse(rawStored));
        } catch {
          throw new Error("Cannot save over an unreadable active profile");
        }
        if (stored.profileId !== next.profileId) {
          throw new Error(`Profile identity changed: expected ${next.profileId}, found ${stored.profileId}`);
        }
        if (stored.revision !== expectedRevision) {
          throw new Error(`Stale profile revision: expected ${expectedRevision}, found ${stored.revision}`);
        }
      }
      next.revision = expectedRevision + 1;
      next.updatedAt = now();
      return write(next);
    },

    saveMerged(current, { maxAttempts = 2 } = {}) {
      const local = normaliseProfileV2(current);
      const base = baseline && baseline.revision === local.revision ? clone(baseline) : null;
      if (!base) throw new Error("Cannot merge without the matching loaded profile baseline");
      let lastError = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const rawLatest = storage.getItem(PROFILE_STORAGE_KEY);
        if (rawLatest === null) throw new Error("Cannot merge because the active profile is missing");
        const latest = normaliseProfileV2(JSON.parse(rawLatest));
        const merged = mergeConcurrentProfiles(base, local, latest);
        try {
          return this.save(merged, { expectedRevision: latest.revision });
        } catch (error) {
          lastError = error;
          if (!String(error?.message || error).startsWith("Stale profile revision:")) throw error;
        }
      }
      throw lastError || new Error("Unable to merge profile changes");
    },

    applyOnce(current, eventId, mutate) {
      if (typeof eventId !== "string" || !eventId) throw new Error("Profile event ID is required");
      const draft = normaliseProfileV2(current);
      if (draft.appliedEvents[eventId]) return { applied: false, profile: draft };
      if (typeof mutate === "function") mutate(draft);
      draft.appliedEvents[eventId] = { appliedAt: now() };
      return { applied: true, profile: this.save(draft) };
    },

    diagnostics() {
      return clone(lastLoad);
    },

    export(current) {
      return JSON.stringify(normaliseProfileV2(current), null, 2);
    },

    import(raw) {
      return write(normaliseProfileV2(JSON.parse(raw)));
    },

    clear({ includeLegacy = false, includeRecovery = includeLegacy } = {}) {
      storage.removeItem(PROFILE_STORAGE_KEY);
      if (includeLegacy) storage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
      if (includeRecovery) storage.removeItem(PROFILE_RECOVERY_STORAGE_KEY);
    },
  };
}
