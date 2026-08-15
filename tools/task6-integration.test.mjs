import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatJs = readFileSync(new URL("../chat.js", import.meta.url), "utf8");
const chatHtml = readFileSync(new URL("../chat.html", import.meta.url), "utf8");

test("project-media chat uses only the credentialed same-origin bridge and clears references", () => {
  const request = chatJs.slice(chatJs.indexOf("const payload = await buildPayload"), chatJs.indexOf("if (!res.ok || !res.body)"));
  const privateBranch = request.slice(request.indexOf("if (hasProjectMedia)"), request.indexOf("} else {", request.indexOf("if (hasProjectMedia)")));
  const publicBranch = request.slice(request.indexOf("} else {", request.indexOf("if (hasProjectMedia)")));
  assert.match(request, /const hasProjectMedia = Array\.isArray\(payload\.project_media\) && payload\.project_media\.length > 0;/);
  assert.match(privateBranch, /\/api\/private\/projects\/chat\/stream/);
  assert.match(privateBranch, /credentials:\s*"include"/);
  assert.doesNotMatch(privateBranch, /x-token-gen-user/);
  assert.match(request, /finally\s*{\s*delete payload\.project_media;/);
  assert.match(publicBranch, /\$\{API_BASE\}\/api\/chat\/stream/);
  assert.match(publicBranch, /x-token-gen-user/);
});

test("composer controls name each image and preserve keyboard focus with one polite status", () => {
  assert.match(chatJs, /setAttribute\("aria-label", `Move \$\{image\.name \|\| "image"\} \$\{direction\}`\)/);
  assert.match(chatJs, /setAttribute\("aria-label", `Set \$\{image\.name \|\| "image"\} as edit target`\)/);
  assert.match(chatJs, /\.focus\(\)/);
  assert.match(chatHtml, /id="chatVisionActionStatus"[^>]*aria-live="polite"/);
});
