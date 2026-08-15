import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatJs = readFileSync(new URL("../chat.js", import.meta.url), "utf8");

function imageEditIntentPattern() {
  const match = chatJs.match(/const IMAGE_EDIT_INTENT_PATTERN = (\/.+\/[a-z]*);/);
  assert.ok(match, "chat.js must define IMAGE_EDIT_INTENT_PATTERN");
  return Function(`"use strict"; return ${match[1]};`)();
}

test("attached-image follow-ups route common iteration language to image editing", () => {
  const pattern = imageEditIntentPattern();
  for (const prompt of [
    "Make it more cinematic",
    "Turn it into a night scene",
    "Try again with warmer lighting",
    "Create another version with a wider crop",
    "Iterate on this result",
    "Give me a distinct variation",
  ]) {
    assert.match(prompt, pattern, `Expected edit intent for: ${prompt}`);
  }
  assert.doesNotMatch("What objects are visible in this image?", pattern);
});

test("Iterate selects variation defaults before submitting another edit", () => {
  assert.match(
    chatJs,
    /function applyImageIterationDefaults\(\)\s*{[\s\S]*?imageSourceMode\.value\s*=\s*"edit";[\s\S]*?imageEditPreservation\.value\s*=\s*"flexible";[\s\S]*?imageEditStrength\.value\s*=\s*"0\.58";[\s\S]*?syncImageEditStrengthValue\(\);[\s\S]*?}/,
    "Iteration must request a visibly different edit instead of retaining Precise / 0.20 defaults",
  );

  const iterateHandler = chatJs.slice(
    chatJs.indexOf('const button = event.target.closest("[data-image-iterate]")'),
    chatJs.indexOf("els.imageSourcePreview.addEventListener", chatJs.indexOf('const button = event.target.closest("[data-image-iterate]")')),
  );
  assert.match(iterateHandler, /applyImageIterationDefaults\(\)/);
  assert.match(iterateHandler, /Create a distinct variation of this image/);
});

test("comparison keeps every ordered attachment while edits use only the explicit target", () => {
  assert.match(chatJs, /from "\.\/chat-multimodal-options\.mjs"/, "chat must use the shared ordered image helpers");
  assert.match(chatJs, /visionContentParts\(resolvedImages\)/, "comparison payloads must include labelled images in composer order");
  assert.match(chatJs, /const source = sourceVisionImages\.find\(\(image\) => image\.editTarget\)/, "image edits must choose the explicit target");
  assert.match(chatJs, /sendImageMessage\(content, source \? \[source\] : \[\]\)/, "image edits must retain only the selected source attachment");
  assert.doesNotMatch(chatJs, /const source = sourceVisionImages\[0\]/, "image edits must not silently use the first attachment");
});
