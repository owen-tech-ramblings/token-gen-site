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

test("deferred project selections accept their current response before active state is populated", async () => {
  const {
    captureProjectSelection,
    projectSelectionIsCurrent,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof captureProjectSelection, "function");
  assert.equal(typeof projectSelectionIsCurrent, "function");

  let projectState = { viewGeneration: 1, activeId: null, active: null };
  const firstSelection = captureProjectSelection(projectState, 5, "project-a");
  projectState = { ...projectState, activeId: "project-a" };
  let releaseFirst;
  const firstResponse = new Promise((resolve) => { releaseFirst = resolve; });
  const firstApplied = firstResponse.then(() => projectSelectionIsCurrent(projectState, 5, firstSelection));
  releaseFirst();
  assert.equal(await firstApplied, true, "the first selected project can populate an empty active state");

  projectState = { ...projectState, viewGeneration: 2, active: { id: "project-a" } };
  const secondSelection = captureProjectSelection(projectState, 5, "project-b");
  projectState = { ...projectState, activeId: "project-b" };
  let releaseSecond;
  const secondResponse = new Promise((resolve) => { releaseSecond = resolve; });
  const secondApplied = secondResponse.then(() => projectSelectionIsCurrent(projectState, 5, secondSelection));
  releaseSecond();
  assert.equal(await secondApplied, true, "an A-to-B selection can replace the old loaded A state");

  const staleA = captureProjectSelection({ viewGeneration: 2, activeId: "project-a", active: { id: "project-a" } }, 5, "project-a");
  projectState = { ...projectState, viewGeneration: 3, activeId: "project-b", active: { id: "project-b" } };
  let releaseStale;
  const staleResponse = new Promise((resolve) => { releaseStale = resolve; });
  const staleApplied = staleResponse.then(() => projectSelectionIsCurrent(projectState, 5, staleA));
  releaseStale();
  assert.equal(await staleApplied, false, "a delayed A response cannot overwrite a later B selection");
});

test("a deferred New Chat save cannot reset a newer opened conversation", async () => {
  const {
    beginHistoryViewAction,
    historyViewActionIsCurrent,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof beginHistoryViewAction, "function");
  assert.equal(typeof historyViewActionIsCurrent, "function");

  let historyState = { viewGeneration: 0, historyActionToken: null, nextHistoryActionToken: 0 };
  const newChat = beginHistoryViewAction(historyState);
  historyState = newChat.state;
  let releaseSave;
  const deferredSave = new Promise((resolve) => { releaseSave = resolve; });
  const shouldReset = deferredSave.then(() => historyViewActionIsCurrent(historyState, newChat.action));

  const newerOpen = beginHistoryViewAction(historyState);
  historyState = newerOpen.state;
  releaseSave();
  assert.equal(await shouldReset, false, "the stale New Chat action yields to the newer conversation open");
  assert.equal(historyViewActionIsCurrent(historyState, newerOpen.action), true);
});

test("a superseded New Chat flush cannot rebind a newer opened conversation", async () => {
  const {
    applySavedConversationResult,
    beginHistoryViewAction,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof applySavedConversationResult, "function");

  let historyState = {
    viewGeneration: 0,
    historyActionToken: null,
    nextHistoryActionToken: 0,
    currentId: "old-chat",
    currentVersion: "old-version",
    messages: ["old message"],
  };
  const newChat = beginHistoryViewAction(historyState);
  historyState = newChat.state;
  let releaseOldSave;
  const oldSave = new Promise((resolve) => { releaseOldSave = resolve; });
  const oldResult = oldSave.then(() => applySavedConversationResult(
    historyState,
    newChat.action,
    { id: "old-chat", version: "old-version-after-save" },
    "old-etag-after-save",
  ));

  const openB = beginHistoryViewAction(historyState);
  historyState = {
    ...openB.state,
    currentId: "chat-b",
    currentVersion: "version-b",
    messages: ["message from B"],
  };
  releaseOldSave();
  const staleResult = await oldResult;
  assert.equal(staleResult.applied, false);
  assert.equal(staleResult.state.currentId, "chat-b");
  assert.equal(staleResult.state.currentVersion, "version-b");
  assert.deepEqual(staleResult.state.messages, ["message from B"]);
});

test("a deferred first open yields before a newer open issues its request", async () => {
  const {
    beginHistoryViewAction,
    historyViewActionIsCurrent,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  let historyState = { viewGeneration: 0, historyActionToken: null, nextHistoryActionToken: 0 };
  const firstOpen = beginHistoryViewAction(historyState);
  historyState = firstOpen.state;
  let releaseFlush;
  const deferredFlush = new Promise((resolve) => { releaseFlush = resolve; });
  const firstMayIssueRequest = deferredFlush.then(() => historyViewActionIsCurrent(historyState, firstOpen.action));

  const secondOpen = beginHistoryViewAction(historyState);
  historyState = secondOpen.state;
  releaseFlush();
  assert.equal(await firstMayIssueRequest, false, "the first open must stop before its GET after the flush");
  assert.equal(historyViewActionIsCurrent(historyState, secondOpen.action), true);
});

test("project actions require the active ID to match the loaded project", async () => {
  const {
    createScannedPdfHandoffState,
    loadedActiveProject,
    scannedPdfProjectAction,
    stageScannedPdf,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof loadedActiveProject, "function");
  let projectState = { activeId: "project-a", active: { id: "project-a", name: "A" } };
  let handoff = stageScannedPdf(createScannedPdfHandoffState(), { name: "scan.pdf" }, "scan-a");
  assert.equal(loadedActiveProject(projectState)?.id, "project-a");
  assert.equal(scannedPdfProjectAction(handoff, loadedActiveProject(projectState)).kind, "upload");

  projectState = { ...projectState, activeId: "project-b" };
  assert.equal(loadedActiveProject(projectState), null, "A cannot back a B selection while B loads");
  assert.deepEqual(scannedPdfProjectAction(handoff, loadedActiveProject(projectState)), { kind: "choose_project" });

  projectState = { ...projectState, active: { id: "project-a", name: "A" } };
  assert.equal(loadedActiveProject(projectState), null, "a stale A response cannot enable project actions");
  projectState = { ...projectState, active: { id: "project-b", name: "B" } };
  assert.equal(loadedActiveProject(projectState)?.id, "project-b");
  assert.equal(scannedPdfProjectAction(handoff, loadedActiveProject(projectState)).projectId, "project-b");
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
  assert.match(newChat, /historyViewActionIsCurrent\(historyState, newChatAction\.action\)/);
  assert.match(newChat, /flushConversationSave\(newChatAction\.action\)/);
  const selectionStart = source.indexOf("async function setActiveProject");
  const selectionEnd = source.indexOf("async function refreshActiveProjectFiles", selectionStart);
  const selection = source.slice(selectionStart, selectionEnd);
  assert.match(selection, /captureProjectSelection\(projectState, historyState\.viewGeneration, nextId\)/);
  assert.match(selection, /projectSelectionIsCurrent\(projectState, historyState\.viewGeneration, selection\)/);
  const saveStart = source.indexOf("async function saveConversation");
  const saveEnd = source.indexOf("function scheduleConversationSave", saveStart);
  const save = source.slice(saveStart, saveEnd);
  assert.match(save, /async function saveConversation\(expectedAction = null\)/);
  assert.match(save, /applySavedConversationResult\(historyState, expectedAction,/);
  const openStart = source.indexOf("async function openStoredConversation");
  const openEnd = source.indexOf("async function deleteStoredConversation", openStart);
  const open = source.slice(openStart, openEnd);
  assert.match(open, /if \(historyState\.saveTimer\) \{\s*await flushConversationSave\(conversationAction\);\s*\}/);
  const flushIndex = open.indexOf("await flushConversationSave(conversationAction)");
  const guardIndex = open.indexOf("if (!historyViewActionIsCurrent(historyState, conversationAction)) return;", flushIndex);
  const openingStatusIndex = open.indexOf('setHistoryStatus("Opening..."');
  const openRequestIndex = open.indexOf("await historyRequest", flushIndex);
  assert.ok(flushIndex >= 0 && guardIndex > flushIndex && guardIndex < openingStatusIndex && openRequestIndex > guardIndex,
    "a superseded open must stop after saving and before status or GET");
  assert.match(source, /const active = loadedActiveProject\(projectState\)/);
  assert.match(source, /beginScannedPdfUpload\(scannedPdfHandoff, loadedActiveProject\(projectState\)\)/);
  assert.match(source, /if \(loadedActiveProject\(projectState\)\) els\.projectDocuments\.click\(\);/);
  assert.match(source, /pagehide/);
});
