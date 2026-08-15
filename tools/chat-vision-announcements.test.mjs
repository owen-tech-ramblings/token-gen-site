import assert from "node:assert/strict";
import test from "node:test";

test("repeated vision announcements clear then restore exactly the human message", async () => {
  const { announceVision } = await import("../chat-vision-announcements.mjs");
  const values = [];
  const region = { set textContent(value) { values.push(value); } };
  const queue = [];
  const schedule = (callback) => queue.push(callback);
  announceVision(region, "Chart moved up.", schedule);
  queue.shift()();
  announceVision(region, "Chart moved up.", schedule);
  queue.shift()();
  assert.deepEqual(values, ["", "Chart moved up.", "", "Chart moved up."]);
  assert.equal(values.at(-1), "Chart moved up.");
});
