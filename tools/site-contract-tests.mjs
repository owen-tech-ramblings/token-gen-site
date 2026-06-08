import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const index = read("index.html");
const chatHtml = read("chat.html");
const chatJs = read("chat.js");
const monitorJs = read("monitor-simple-20260607-token-rates.js");

assert.match(index, /href="\.\/server-monitor\.html"/, "Homepage must link to Monitor.");
assert.match(index, /href="\.\/chat\.html"/, "Homepage must link to Chat.");
assert.match(index, /href="\.\/games\/"/, "Homepage must link to Games.");
assert.match(index, /Token Gen/i, "Homepage must identify Token Gen clearly.");

assert.doesNotMatch(chatJs, /applyModelFallback/, "Chat must not silently use fallback model discovery.");
assert.doesNotMatch(chatJs, /DEFAULT_CHAT_MODEL\s*=\s*"Qwen-Qwen3\.6-27B-FP8"/, "Chat must not hardcode the short vLLM model id fallback.");
assert.match(chatJs, /disableChat/, "Chat must disable input when model discovery fails.");
assert.match(chatJs, /web context service is not configured/i, "Chat must explain unavailable web search as service configuration.");
assert.match(chatHtml, /chat\.js\?v=token-chat-api-required-20260608/, "Chat HTML must cache-bust the no-fallback script.");

assert.match(monitorJs, /function renderObjectDetails/, "Monitor must include a generic object renderer for all public-status fields.");
assert.doesNotMatch(monitorJs, /let lastGoodPayload/, "Monitor must not retain old data when the API is broken.");
assert.doesNotMatch(monitorJs, /driver_version/, "Monitor must not show private-only GPU driver columns unless public status includes them.");
assert.doesNotMatch(monitorJs, /uuid/, "Monitor must not show private-only GPU UUID columns unless public status includes them.");

console.log("site contract tests passed");
