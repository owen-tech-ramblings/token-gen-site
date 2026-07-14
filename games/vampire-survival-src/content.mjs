export const DIFFICULTIES = Object.freeze({
  story: { label: "Story", enemyHp: 0.82, enemyDamage: 0.72, spawn: 0.82, dawn: 270, score: 0.8, grace: 5 },
  night: { label: "Night", enemyHp: 1, enemyDamage: 1, spawn: 1, dawn: 225, score: 1, grace: 3 },
  nightmare: { label: "Nightmare", enemyHp: 1.28, enemyDamage: 1.3, spawn: 1.28, dawn: 195, score: 1.4, grace: 1.5 },
});

export const WORLD = Object.freeze({ w: 3200, h: 2200 });

export const DISTRICTS = Object.freeze([
  { id: "cathedral", name: "Cathedral Ward", x: 0, y: 0, w: 1100, h: 1080, ground: "#100b18", accent: "#d8bd73", perk: "Warding-cross damage +20%", danger: "Sanctified pulses" },
  { id: "docks", name: "Blackwater Docks", x: 1100, y: 0, w: 1050, h: 1080, ground: "#07131a", accent: "#5ea5b9", perk: "Movement +8%", danger: "Obscuring fog" },
  { id: "slums", name: "Ashen Slums", x: 2150, y: 0, w: 1050, h: 1080, ground: "#16100d", accent: "#bc7758", perk: "More feeding prey", danger: "Dense patrols" },
  { id: "gardens", name: "Blood Gardens", x: 0, y: 1080, w: 1600, h: 1120, ground: "#0b170f", accent: "#7dc68a", perk: "Roses restore more", danger: "Thorn patches" },
  { id: "palace", name: "Ivory Palace", x: 1600, y: 1080, w: 1600, h: 1120, ground: "#15111b", accent: "#c7a8ee", perk: "Score +20%", danger: "Elite guard" },
]);

export const ENEMY_TYPES = Object.freeze({
  villager: { hp: 20, speed: 82, damage: 4, score: 55, xp: 15, colour: "#a88c72", radius: 10, behaviour: "flee" },
  guard: { hp: 38, speed: 102, damage: 8, score: 95, xp: 24, colour: "#7388a4", radius: 12, behaviour: "hunt" },
  hunter: { hp: 54, speed: 132, damage: 11, score: 155, xp: 32, colour: "#b46d32", radius: 12, behaviour: "flank" },
  priest: { hp: 48, speed: 88, damage: 14, score: 190, xp: 38, colour: "#dbc85e", radius: 13, behaviour: "range" },
  captain: { hp: 105, speed: 116, damage: 18, score: 390, xp: 62, colour: "#d43752", radius: 16, behaviour: "hunt" },
  bellkeeper: { hp: 72, speed: 96, damage: 13, score: 245, xp: 44, colour: "#66b9c9", radius: 14, behaviour: "bell" },
  voss: { hp: 760, speed: 112, damage: 20, score: 3600, xp: 220, colour: "#f04a63", radius: 26, behaviour: "boss" },
  elowen: { hp: 980, speed: 128, damage: 22, score: 4800, xp: 280, colour: "#8eddeb", radius: 27, behaviour: "boss" },
});

export const PACTS = Object.freeze([
  { id: "fangs", name: "Razor Fangs", desc: "Feed damage +25%.", max: 5, apply: (player) => { player.feedDamage *= 1.25; } },
  { id: "reservoir", name: "Blood Reservoir", desc: "Maximum blood +24 and restore 24.", max: 4, apply: (player) => { player.maxBlood += 24; player.blood = Math.min(player.maxBlood, player.blood + 24); } },
  { id: "nightstep", name: "Nightstep", desc: "Movement speed +12%.", max: 4, apply: (player) => { player.speed *= 1.12; } },
  { id: "reach", name: "Hungering Reach", desc: "Feeding range +18.", max: 4, apply: (player) => { player.range += 18; } },
  { id: "mist", name: "Sovereign Mist", desc: "Mist cooldown -18% and duration +0.25s.", max: 4, apply: (player) => { player.mistBase *= 0.82; player.mistDuration += 0.25; } },
  { id: "swarm", name: "Swarm Lord", desc: "Bat Swarm damage +30% and radius +22.", max: 4, apply: (player) => { player.swarmDamage *= 1.3; player.swarmRadius += 22; } },
  { id: "relic", name: "Desecrator", desc: "Warding-cross damage +32%.", max: 4, apply: (player) => { player.relicDamage *= 1.32; } },
  { id: "roses", name: "Rose Hunger", desc: "Rose collection radius +40 and healing +5.", max: 3, apply: (player) => { player.magnet += 40; player.roseHeal += 5; } },
  { id: "combo", name: "Crimson Momentum", desc: "Combo window +0.7s and score multiplier +8%.", max: 4, apply: (player) => { player.comboWindow += 0.7; player.scoreBonus += 0.08; } },
  { id: "echo", name: "Sanguine Echo", desc: "Every fourth feed repeats at 55% damage.", max: 1, apply: (player) => { player.echo = true; } },
  { id: "thorns", name: "Royal Thorns", desc: "Taking damage retaliates against nearby hunters.", max: 1, apply: (player) => { player.thorns = true; } },
  { id: "moon", name: "Moon-Bound", desc: "Blood Moon charges 25% faster.", max: 3, apply: (player) => { player.frenzyGain *= 1.25; } },
]);

export const ACHIEVEMENTS = Object.freeze({
  first_blood: "First Blood",
  relic: "Iconoclast",
  combo10: "Crimson Chain",
  untouched: "Untouched Night",
  voss: "Marshal Breaker",
  elowen: "Last Bell Silenced",
  s_rank: "S-Rank Predator",
  daily: "Creature of Habit",
});
