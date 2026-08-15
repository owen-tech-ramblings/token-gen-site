import assert from "node:assert/strict";
import test from "node:test";
import {
  moveVisionImage,
  orderedVisionImages,
  selectEditTarget,
  visionContentParts,
} from "../chat-multimodal-options.mjs";

const images = [
  { id: "chart-a", name: "chart-a.png", dataUrl: "data:image/png;base64,YQ==" },
  { id: "chart-b", name: "chart-b.png", dataUrl: "data:image/png;base64,Yg==" },
  { id: "chart-c", name: "chart-c.png", dataUrl: "data:image/png;base64,Yw==" },
];

test("ordered vision images retain the chosen comparison order and labels", () => {
  const selected = orderedVisionImages(images, ["chart-b", "chart-a", "chart-c"]);

  assert.deepEqual(selected.map((image) => image.id), ["chart-b", "chart-a", "chart-c"]);
  assert.deepEqual(visionContentParts(selected), [
    { type: "text", text: "Image 1 — chart-b.png" },
    { type: "image_url", image_url: { url: "data:image/png;base64,Yg==" } },
    { type: "text", text: "Image 2 — chart-a.png" },
    { type: "image_url", image_url: { url: "data:image/png;base64,YQ==" } },
    { type: "text", text: "Image 3 — chart-c.png" },
    { type: "image_url", image_url: { url: "data:image/png;base64,Yw==" } },
  ]);
});

test("moving a vision image changes only its adjacent order", () => {
  assert.deepEqual(
    moveVisionImage(images, "chart-b", "up").map((image) => image.id),
    ["chart-b", "chart-a", "chart-c"],
  );
  assert.deepEqual(
    moveVisionImage(images, "chart-b", "down").map((image) => image.id),
    ["chart-a", "chart-c", "chart-b"],
  );
  assert.deepEqual(
    moveVisionImage(images, "chart-a", "up").map((image) => image.id),
    ["chart-a", "chart-b", "chart-c"],
  );
});

test("selecting an edit target marks exactly one visible image", () => {
  const selected = selectEditTarget(images, "chart-b");

  assert.deepEqual(selected.map((image) => image.editTarget), [false, true, false]);
  assert.deepEqual(
    selected.filter((image) => image.editTarget).map((image) => image.id),
    ["chart-b"],
  );
});

test("ordered vision images clamp comparisons to four images", () => {
  const fiveImages = [...images, { id: "chart-d", name: "chart-d.png" }, { id: "chart-e", name: "chart-e.png" }];

  assert.deepEqual(
    orderedVisionImages(fiveImages, ["chart-e", "chart-d", "chart-c", "chart-b", "chart-a"]).map((image) => image.id),
    ["chart-e", "chart-d", "chart-c", "chart-b"],
  );
});
