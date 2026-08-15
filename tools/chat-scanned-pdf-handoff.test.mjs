import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("scanned PDF handoff action globally owns a deferred upload", async () => {
  const {
    beginScannedPdfUpload,
    createScannedPdfHandoffState,
    finishScannedPdfUpload,
    scannedPdfProjectAction,
    stageScannedPdf,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof createScannedPdfHandoffState, "function");
  assert.equal(typeof stageScannedPdf, "function");
  assert.equal(typeof beginScannedPdfUpload, "function");
  assert.equal(typeof finishScannedPdfUpload, "function");
  const file = { name: "scan.pdf", size: 123 };
  let state = stageScannedPdf(createScannedPdfHandoffState(), file, "pending-one");
  assert.deepEqual(scannedPdfProjectAction(state, null), { kind: "choose_project" });
  const first = beginScannedPdfUpload(state, { id: "project-1" });
  assert.equal(first.action.kind, "upload");
  assert.equal(first.action.projectId, "project-1");
  state = first.state;
  state = stageScannedPdf(state, { name: "replacement.pdf", size: 456 }, "pending-two");
  assert.equal(state.pending.id, "pending-one", "an active upload cannot be replaced");
  const second = beginScannedPdfUpload(state, { id: "project-1" });
  assert.equal(second.action.kind, "busy");
  const afterProjectSwitch = finishScannedPdfUpload(state, first.action, true, false);
  assert.equal(afterProjectSwitch.pending?.id, "pending-one");
  assert.equal(afterProjectSwitch.activeAction, null, "a switched project retains the file for a later explicit action");
  let release;
  const deferred = new Promise((resolve) => { release = resolve; });
  const completion = deferred.then(() => finishScannedPdfUpload(state, first.action, true, true));
  release();
  state = await completion;
  assert.equal(state.pending, null);
  assert.equal(state.activeAction, null);
});

test("owned operations and project views reject stale completions", async () => {
  const {
    beginOwnedOperation,
    captureProjectView,
    finishOwnedOperation,
    projectViewIsCurrent,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof beginOwnedOperation, "function");
  assert.equal(typeof finishOwnedOperation, "function");
  let operations = { busy: false, busyToken: null, nextOperationToken: 0 };
  operations = beginOwnedOperation(operations);
  const firstToken = operations.busyToken;
  operations = beginOwnedOperation(operations);
  const secondToken = operations.busyToken;
  operations = finishOwnedOperation(operations, firstToken);
  assert.equal(operations.busy, true, "the first finally cannot clear another owner");
  assert.equal(operations.busyToken, secondToken);

  assert.equal(typeof captureProjectView, "function");
  assert.equal(typeof projectViewIsCurrent, "function");
  const captured = captureProjectView({ viewGeneration: 3 }, 7, "project-one");
  let release;
  const deferred = new Promise((resolve) => { release = resolve; });
  const apply = deferred.then(() => projectViewIsCurrent(
    { viewGeneration: 4, activeId: "project-one", active: { id: "project-one" } },
    8, captured,
  ));
  release();
  assert.equal(await apply, false, "a refresh started before a project/conversation switch cannot apply");
});

test("chat renders a disabled real scanned-PDF project action and New Chat clears it", () => {
  const source = fs.readFileSync(new URL("../chat.js", import.meta.url), "utf8");
  assert.match(source, /data-scanned-pdf-add/);
  assert.match(source, /uploadProjectDocuments\(action\.files, \{ projectId: action\.projectId \}\)/);
  assert.match(source, /refreshActiveProjectFiles\(destinationId\)/);
  assert.match(source, /data-scanned-pdf-add\$\{disabled\}/);
  const newChatStart = source.indexOf('els.clear.addEventListener("click"');
  const newChatEnd = source.indexOf('renderMessages(false);', newChatStart);
  const newChat = source.slice(newChatStart, newChatEnd);
  assert.match(newChat, /clearPendingScannedPdf\(\)/);
  assert.match(source, /pagehide/);
});
