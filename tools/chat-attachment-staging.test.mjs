import assert from "node:assert/strict";
import test from "node:test";

test("partial vision staging releases every newly-created preview after a later failure", async () => {
  const { stageVisionAttachments } = await import("../chat-attachment-staging.mjs");
  const released = [];
  const files = [{ name: "one.png" }, { name: "two.png" }];
  await assert.rejects(
    stageVisionAttachments({
      existing: [],
      files,
      limits: { maxImages: 4, maxTotalBytes: 10 },
      readVisionImage: async (file) => ({ name: file.name, sizeBytes: file.name === "one.png" ? 6 : 6, previewObjectUrl: `blob:${file.name}` }),
      releasePreview: (image) => released.push(image.previewObjectUrl),
    }),
    /total up to/,
  );
  assert.deepEqual(released, ["blob:one.png", "blob:two.png"]);
});
