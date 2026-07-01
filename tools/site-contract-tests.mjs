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
assert.match(chatHtml, /id="chatMode"/, "Chat HTML must include a mode selector.");
assert.match(chatHtml, /id="chatImageSize"/, "Chat HTML must include image size settings.");
assert.match(chatHtml, /id="chatImageQuality"/, "Chat HTML must include image quality settings.");
assert.match(chatHtml, /id="chatImageSamples"/, "Chat HTML must include image sample count settings.");
assert.match(chatHtml, /chat\.js\?v=token-chat-image-generation-20260701/, "Chat HTML must cache-bust the image-generation script.");
assert.match(chatJs, /\/api\/image\/health/, "Chat must check image generation capability.");
assert.match(chatJs, /\/api\/image\/generations/, "Chat must submit image generation jobs.");
assert.match(chatJs, /\/api\/image\/history\/\$\{/, "Chat must poll image generation history.");
assert.match(chatJs, /generateImageSamplesSequentially/, "Chat must generate multiple image samples consecutively.");
assert.match(chatJs, /renderImageOutputs/, "Chat must render generated image outputs in the thread.");

assert.match(monitorJs, /function renderObjectDetails/, "Monitor must include a generic object renderer for all public-status fields.");
assert.doesNotMatch(monitorJs, /let lastGoodPayload/, "Monitor must not retain old data when the API is broken.");
assert.doesNotMatch(monitorJs, /driver_version/, "Monitor must not show private-only GPU driver columns unless public status includes them.");
assert.doesNotMatch(monitorJs, /uuid/, "Monitor must not show private-only GPU UUID columns unless public status includes them.");

console.log("site contract tests passed");
