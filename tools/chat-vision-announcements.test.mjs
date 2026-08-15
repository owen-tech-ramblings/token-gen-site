import assert from "node:assert/strict";
import test from "node:test";

test("repeated vision announcements are observably distinct without visible noise", async () => {
  const { nextVisionAnnouncement } = await import("../chat-vision-announcements.mjs");
  assert.notEqual(nextVisionAnnouncement("Chart moved up."), nextVisionAnnouncement("Chart moved up."));
});
