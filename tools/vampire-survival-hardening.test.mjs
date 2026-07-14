import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CLOUD_PROFILE_MAX_BYTES } from "../games/vampire-survival-src/cloud-sync.mjs";
import {
  MAX_SCORE_HISTORY,
  freshProfileV2,
  normaliseProfileV2,
} from "../games/vampire-survival-src/profile.mjs";
import {
  CAMPAIGN_NIGHTS,
  createHuntDepth,
  createRunContract,
  huntCrossQuota,
} from "../games/vampire-survival-src/progression.mjs";

const difficulty = Object.freeze({ dawn: 225, grace: 0.8 });

test("all Campaign nights and representative deep Hunt depths retain fixed-night contracts", () => {
  for (let night = 1; night <= 15; night += 1) {
    const contract = createRunContract({ mode: "campaign", difficulty, campaignNight: night });
    assert.equal(contract.id, `night-${night}`);
    assert.equal(contract.dawn, difficulty.dawn);
    assert.equal(contract.crossPoints.length, contract.crossQuota);
    assert.ok(contract.crossQuota >= 3 && contract.crossQuota <= 6);
  }
  assert.equal(Object.keys(CAMPAIGN_NIGHTS).length, 15);

  for (const depth of [1, 2, 5, 10, 15, 25, 100, 1_000, 10_000]) {
    const authored = createHuntDepth(depth);
    const contract = createRunContract({ mode: "hunt", difficulty, huntDepth: depth });
    assert.equal(contract.dawn, difficulty.dawn);
    assert.equal(contract.crossQuota, huntCrossQuota(depth));
    assert.equal(contract.crossPoints.length, contract.crossQuota);
    assert.ok(contract.crossQuota <= 6);
    assert.ok(Number.isFinite(authored.pressure));
    assert.ok(Number.isFinite(authored.enemyHp));
    assert.ok(Number.isFinite(authored.enemyDamage));
    assert.ok(Number.isFinite(authored.scoreMultiplier));
  }
});

test("fresh, completed, and large valid profiles normalise within the cloud envelope", () => {
  const fresh = normaliseProfileV2(freshProfileV2({ profileId: "local:hardening:fresh" }));
  assert.equal(fresh.campaign.unlockedNight, 1);
  assert.equal(fresh.hunt.unlocked, true);

  const completedCandidate = freshProfileV2({ profileId: "local:hardening:completed", revision: 40 });
  completedCandidate.campaign.clears = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`night-${index + 1}`, true]));
  completedCandidate.campaign.unlockedNight = 15;
  completedCandidate.campaign.endingSeen = true;
  completedCandidate.bloodline.loadoutConfigured = true;
  completedCandidate.bloodline.loadout = ["mist", "swarm"];
  const completed = normaliseProfileV2(completedCandidate);
  assert.equal(completed.campaign.endingUnlocked, true);
  assert.equal(completed.hunt.ascensionUnlocked, true);
  assert.deepEqual(completed.bloodline.loadout, ["mist", "swarm"]);

  const largeCandidate = freshProfileV2({ profileId: "local:hardening:large", revision: 4_000 });
  largeCandidate.scores = Array.from({ length: 120 }, (_, index) => ({
    runId: `large-run-${index}`,
    score: 100_000 - index,
    time: 225,
    grade: "S",
    win: true,
    difficulty: "nightmare",
    date: "2026-07-15T06:00:00.000Z",
  }));
  for (let index = 0; index < 1_500; index += 1) {
    largeCandidate.economy.events[`history:${index}`] = { amount: 0, source: "hardening-history", appliedAt: "2026-07-15T06:00:00.000Z" };
  }
  for (let depth = 1; depth <= 3_000; depth += 1) {
    largeCandidate.hunt.scores[`depth-${depth}`] = { score: depth * 100, grade: "S", date: "2026-07-15T06:00:00.000Z" };
  }
  const large = normaliseProfileV2(largeCandidate);
  const bytes = new TextEncoder().encode(JSON.stringify({ profile: large })).byteLength;
  assert.equal(large.scores.length, MAX_SCORE_HISTORY);
  assert.ok(bytes > 200_000, `expected a meaningful stress profile, received ${bytes} bytes`);
  assert.ok(bytes < CLOUD_PROFILE_MAX_BYTES, `stress profile exceeded cloud limit at ${bytes} bytes`);
});

test("Iteration 41 source keeps Hunt entry, player copy, accessibility, and controller contracts", async () => {
  const [runtime, input, template, gameplay] = await Promise.all([
    readFile(new URL("../games/vampire-survival-src/runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../games/vampire-survival-src/input.mjs", import.meta.url), "utf8"),
    readFile(new URL("../games/vampire-survival-src/template.html", import.meta.url), "utf8"),
    readFile(new URL("../games/vampire-survival-src/gameplay.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /iteration:\s*41/);
  assert.match(input, /syncDialogIsolation/);
  assert.match(input, /pollGamepadInput/);
  assert.match(input, /gamepadBack/);
  assert.match(input, /huntDepth:Math\.max\(1,\(profile\.hunt\.bestDepth\|\|0\)\+1\)/);
  assert.match(template, /id="modeBriefing"/);
  assert.match(template, /Hunt from the start/);
  assert.match(template, /id="game"[^>]+aria-hidden="true"[^>]+tabindex="-1"/);
  assert.match(template, /id="hud" aria-hidden="true"/);
  assert.match(gameplay, /function setGameplaySurfaceActive\(active\)/);
  assert.doesNotMatch(template, /authored nights|committed ending|fixed-length night|warding-cross quota|atomic profile transaction|exact blocking reason/i);
  assert.match(template, /min-height:44px/);
  assert.match(template, /\.check\{[^}]*min-height:44px/);
  assert.match(template, /@media\(pointer:coarse\)\{[^}]*\.check\{?[^}]*min-height:48px/);
  assert.match(template, /prefers-reduced-motion:reduce/);
  assert.match(template, /left stick/);
  assert.match(template, /LB creates a Thrall/);
});
