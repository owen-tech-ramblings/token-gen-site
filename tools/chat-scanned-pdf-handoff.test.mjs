import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("scanned PDF handoff is single-flight and keeps the captured destination", async () => {
  const {
    beginScannedPdfUpload,
    createPendingScannedPdf,
    scannedPdfProjectAction,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof createPendingScannedPdf, "function");
  assert.equal(typeof beginScannedPdfUpload, "function");
  const file = { name: "scan.pdf", size: 123 };
  const pending = createPendingScannedPdf(file, "pending-one");
  assert.deepEqual(scannedPdfProjectAction(pending, null), { kind: "choose_project" });
  const first = beginScannedPdfUpload(pending, { id: "project-1" });
  assert.equal(first.action.kind, "upload");
  assert.equal(first.action.projectId, "project-1");
  assert.equal(first.pending.busy, true);
  const second = beginScannedPdfUpload(first.pending, { id: "project-1" });
  assert.equal(second.action.kind, "busy");
  let posts = 0;
  for (const action of [first.action, second.action]) {
    if (action.kind === "upload") posts += 1;
  }
  assert.equal(posts, 1, "a double click can submit only the captured first action");
});

test("scanned PDF completion cannot clear a replacement, New Chat, or switched project", async () => {
  const {
    beginScannedPdfUpload,
    createPendingScannedPdf,
    finishScannedPdfUpload,
    scannedPdfUploadAppliesToProject,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof finishScannedPdfUpload, "function");
  const first = beginScannedPdfUpload(
    createPendingScannedPdf({ name: "first.pdf" }, "pending-one"), { id: "project-one" },
  );
  const replacement = createPendingScannedPdf({ name: "replacement.pdf" }, "pending-two");
  assert.equal(finishScannedPdfUpload(replacement, first.action, true), replacement);
  assert.equal(finishScannedPdfUpload(null, first.action, true), null);
  assert.equal(scannedPdfUploadAppliesToProject(first.action, { id: "project-one" }), true);
  assert.equal(scannedPdfUploadAppliesToProject(first.action, { id: "project-two" }), false);
  const afterProjectSwitch = finishScannedPdfUpload(first.pending, first.action, false);
  assert.equal(afterProjectSwitch?.id, "pending-one");
  assert.equal(afterProjectSwitch?.busy, false, "a switched project retains the file for an explicit next action");
});

test("chat renders a disabled real scanned-PDF project action and New Chat clears it", () => {
  const source = fs.readFileSync(new URL("../chat.js", import.meta.url), "utf8");
  assert.match(source, /data-scanned-pdf-add/);
  assert.match(source, /uploadProjectDocuments\(action\.files, \{ projectId: action\.projectId \}\)/);
  assert.match(source, /uploaded && capturedDestinationIsCurrent/);
  assert.match(source, /data-scanned-pdf-add\$\{disabled\}/);
  const newChatStart = source.indexOf('els.clear.addEventListener("click"');
  const newChatEnd = source.indexOf('renderMessages(false);', newChatStart);
  const newChat = source.slice(newChatStart, newChatEnd);
  assert.match(newChat, /clearPendingScannedPdf\(\)/);
  assert.match(source, /pagehide/);
});
