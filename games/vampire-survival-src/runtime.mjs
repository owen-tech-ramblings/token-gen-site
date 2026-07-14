export const BUILD = Object.freeze({
  iteration: 41,
  upgrades: true,
  boss: true,
  districts: true,
  platform: true,
  polish: true,
  profileSchema: 2,
});

export const GAME_PHASES = Object.freeze({
  BOOT: "boot",
  MENU: "menu",
  CAMPAIGN_MAP: "campaign-map",
  NIGHT_ACTIVE: "night-active",
  BOSS_ACTIVE: "boss-active",
  COFFIN_TRANSITION: "coffin-transition",
  COFFIN_HUB: "coffin-hub",
  BLOODLINE: "bloodline",
  LOADOUT: "loadout",
  ENDING: "ending",
  RESULT: "result",
});

export const $ = (id) => document.getElementById(id);
export const TAU = Math.PI * 2;
export const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export const lerp = (start, end, amount) => start + (end - start) * amount;

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(initialSeed) {
  let seed = initialSeed;
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRunSeed(mode, options = {}) {
  const now = options.now || (() => new Date());
  const timestamp = options.timestamp || (() => Date.now());
  const entropy = options.entropy || Math.random;
  if (mode === "daily") return `daily:${now().toISOString().slice(0, 10)}`;
  return `standard:${timestamp()}:${entropy()}`;
}

export function trimEntityOverflow(entities, cap, origin, protectedEntity = null) {
  invariant(Array.isArray(entities), "Entity collection must be an array");
  invariant(Number.isInteger(cap) && cap >= 0, "Entity cap must be a non-negative integer");
  const live = entities.filter((entity) => !entity.dead);
  const overflow = Math.max(0, live.length - cap);
  if (overflow === 0) return 0;
  const protectedEntities = new Set(Array.isArray(protectedEntity) ? protectedEntity.filter(Boolean) : [protectedEntity].filter(Boolean));
  const removable = live
    .filter((entity) => !protectedEntities.has(entity))
    .sort((left, right) => (
      Math.hypot(right.x - origin.x, right.y - origin.y)
      - Math.hypot(left.x - origin.x, left.y - origin.y)
    ));
  const removed = Math.min(overflow, removable.length);
  for (let index = 0; index < removed; index += 1) removable[index].dead = true;
  return removed;
}
