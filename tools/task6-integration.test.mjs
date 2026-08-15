import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatJs = readFileSync(new URL("../chat.js", import.meta.url), "utf8");
const chatHtml = readFileSync(new URL("../chat.html", import.meta.url), "utf8");

test("project-media chat uses only the credentialed same-origin bridge and clears references", () => {
  assert.match(chatJs, /import \{ requestChatStream \} from "\.\/chat-transport-options\.mjs"/);
  assert.match(chatJs, /requestChatStream\(payload, chatUserId, isLoopbackHost\(\), fetch, streamAbortController\.signal\)/);
});

test("composer controls name each image and preserve keyboard focus with one polite status", () => {
  assert.match(chatJs, /setAttribute\("aria-label", `Move \$\{image\.name \|\| "image"\} \$\{direction\}`\)/);
  assert.match(chatJs, /setAttribute\("aria-label", `Set \$\{image\.name \|\| "image"\} as edit target`\)/);
  assert.match(chatJs, /\.focus\(\)/);
  assert.match(chatHtml, /id="chatVisionActionStatus"[^>]*aria-live="polite"/);
});
