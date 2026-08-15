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

test("timer and queued saves retain their captured A ownership after B opens", async () => {
  const {
    applySavedConversationResult,
    beginHistoryViewAction,
    captureHistoryViewAction,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof captureHistoryViewAction, "function");
  let historyState = {
    viewGeneration: 0,
    historyActionToken: null,
    nextHistoryActionToken: 0,
    currentId: "chat-a",
    currentVersion: "version-a",
    messages: ["message from A"],
    historyStatus: "Saving A",
  };
  const activeA = beginHistoryViewAction(historyState);
  historyState = activeA.state;
  const timerAction = captureHistoryViewAction(historyState);
  const queuedAction = captureHistoryViewAction(historyState);
  let releaseTimer;
  let releaseQueued;
  const timerSave = new Promise((resolve) => { releaseTimer = resolve; }).then(() => applySavedConversationResult(
    historyState, timerAction, { id: "chat-a", version: "timer-version-a" }, "timer-etag-a",
  ));
  const queuedSave = new Promise((resolve) => { releaseQueued = resolve; }).then(() => applySavedConversationResult(
    historyState, queuedAction, { id: "chat-a", version: "queued-version-a" }, "queued-etag-a",
  ));

  const openB = beginHistoryViewAction(historyState);
  historyState = {
    ...openB.state,
    currentId: "chat-b",
    currentVersion: "version-b",
    messages: ["message from B"],
    historyStatus: "Opened B",
  };
  releaseTimer();
  releaseQueued();
  const [timerResult, queuedResult] = await Promise.all([timerSave, queuedSave]);
  assert.equal(timerResult.applied, false);
  assert.equal(queuedResult.applied, false);
  assert.equal(historyState.currentId, "chat-b");
  assert.equal(historyState.currentVersion, "version-b");
  assert.deepEqual(historyState.messages, ["message from B"]);
  assert.equal(historyState.historyStatus, "Opened B");
});

test("stale chat fetches and upstream errors leave B untouched", async () => {
  const { awaitCurrentSendStep } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof awaitCurrentSendStep, "function");
  const b = { messages: ["B message"], status: "Opened B", reasoning: "B reasoning" };

  let owner = "a";
  const isCurrent = () => owner === "a";
  const fetchController = new AbortController();
  let releaseFetch;
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const deferredFetch = awaitCurrentSendStep(isCurrent, () => fetchGate, { controller: fetchController });
  owner = "b";
  releaseFetch({ ok: true });
  assert.deepEqual(await deferredFetch, { current: false, value: null });
  assert.equal(fetchController.signal.aborted, true);
  assert.deepEqual(b, { messages: ["B message"], status: "Opened B", reasoning: "B reasoning" });

  owner = "a";
  const errorController = new AbortController();
  let rejectUpstream;
  const upstreamGate = new Promise((_, reject) => { rejectUpstream = reject; });
  const deferredError = awaitCurrentSendStep(isCurrent, () => upstreamGate, { controller: errorController });
  owner = "b";
  rejectUpstream(new Error("upstream failed"));
  assert.deepEqual(await deferredError, { current: false, value: null });
  assert.equal(errorController.signal.aborted, true);
  assert.deepEqual(b, { messages: ["B message"], status: "Opened B", reasoning: "B reasoning" });
});

test("stale chat reader cancels once while a current stream remains usable", async () => {
  const { awaitCurrentSendStep } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof awaitCurrentSendStep, "function");
  let owner = "a";
  const isCurrent = () => owner === "a";
  const controller = new AbortController();
  let readCount = 0;
  let releaseSecondRead;
  const reader = {
    cancelCalls: 0,
    read() {
      readCount += 1;
      if (readCount === 1) return Promise.resolve({ value: "A chunk", done: false });
      return new Promise((resolve) => { releaseSecondRead = resolve; });
    },
    async cancel() { this.cancelCalls += 1; },
  };
  const visible = [];
  const first = await awaitCurrentSendStep(isCurrent, () => reader.read(), { reader, controller });
  if (first.current) visible.push(first.value.value);
  assert.deepEqual(visible, ["A chunk"]);

  const second = awaitCurrentSendStep(isCurrent, () => reader.read(), { reader, controller });
  owner = "b";
  releaseSecondRead({ value: "stale chunk", done: false });
  assert.deepEqual(await second, { current: false, value: null });
  assert.equal(reader.cancelCalls, 1);
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(visible, ["A chunk"], "the stale chunk must not reach B");

  owner = "a";
  const current = await awaitCurrentSendStep(isCurrent, async () => "normal response", { controller: new AbortController() });
  assert.deepEqual(current, { current: true, value: "normal response" });
});

test("a captured project scope aborts deferred A preparation after B becomes active", async () => {
  const {
    captureLoadedProjectScope,
    prepareCurrentProjectScope,
    projectScopeIsCurrent,
  } = await import("../chat-scanned-pdf-handoff.mjs");
  assert.equal(typeof captureLoadedProjectScope, "function");
  assert.equal(typeof prepareCurrentProjectScope, "function");
  assert.equal(typeof projectScopeIsCurrent, "function");

  let projectState = {
    activeId: "project-a",
    active: { id: "project-a", name: "A", instructions: "A instructions" },
    viewGeneration: 1,
  };
  const scopeA = captureLoadedProjectScope(projectState, 7);
  let fetchCalls = 0;
  const submitPreparedProject = (prepared) => {
    if (!prepared.current) return null;
    fetchCalls += 1;
    return prepared.value;
  };
  let releasePreparation;
  const preparation = new Promise((resolve) => { releasePreparation = resolve; });
  const preparedA = prepareCurrentProjectScope(projectState, 7, scopeA, async (project) => {
    await preparation;
    return { metadata: { project_id: project.id }, evidence: project.instructions };
  });

  Object.assign(projectState, {
    activeId: "project-b",
    active: { id: "project-b", name: "B", instructions: "B instructions" },
    viewGeneration: 2,
  });
  releasePreparation();
  const stalePreparation = await preparedA;
  assert.deepEqual(stalePreparation, { current: false, value: null });
  assert.equal(submitPreparedProject(stalePreparation), null);
  assert.equal(fetchCalls, 0, "a changed project must not submit A context upstream");

  Object.assign(projectState, {
    activeId: "project-a",
    active: { id: "project-a", name: "A", instructions: "A instructions" },
    viewGeneration: 3,
  });
  const stableScopeA = captureLoadedProjectScope(projectState, 7);
  const stablePreparation = await prepareCurrentProjectScope(projectState, 7, stableScopeA, async (project) => (
    { metadata: { project_id: project.id }, evidence: project.instructions }
  ));
  const stableSubmission = submitPreparedProject(stablePreparation);
  assert.deepEqual(stableSubmission, {
    metadata: { project_id: "project-a" },
    evidence: "A instructions",
  });
  assert.equal(fetchCalls, 1, "only the stable A scope may reach the model submission boundary");
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
  assert.match(save, /async function saveConversation\(expectedAction = captureHistoryViewAction\(historyState\)\)/);
  assert.match(save, /applySavedConversationResult\(historyState, expectedAction,/);
  assert.match(save, /historyState\.saveQueued = expectedAction/);
  assert.match(source, /saveConversation\(action\)/);
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
  assert.match(source, /captureLoadedProjectScope\(projectState, historyState\.viewGeneration\)/);
  assert.match(source, /const sendViewAction = captureHistoryViewAction\(historyState\)/);
  assert.match(source, /projectScopeIsCurrent\(projectState, historyState\.viewGeneration, projectScope\)/);
  assert.match(source, /prepareCurrentProjectScope\(projectState, historyState\.viewGeneration, projectScope,/);
  assert.match(source, /buildPayload\(chatUserId, projectContext, route, projectScope\)/);
  const sendStart = source.indexOf("async function sendMessage");
  const sendEnd = source.indexOf("function imageSettings", sendStart);
  const send = source.slice(sendStart, sendEnd);
  assert.ok(send.indexOf("!preparedProject.current") < send.indexOf("requestChatStream(payload"), "A stale project scope must stop before the model stream request.");
  assert.match(send, /const streamAbortController = new AbortController\(\)/, "Every chat send must own a cancellable stream request.");
  assert.match(send, /awaitCurrentSendStep\(\s*sendViewIsCurrent,\s*\(\) => requestChatStream\(/, "The response await must stop stale sends before response handling.");
  assert.match(send, /awaitCurrentSendStep\(\s*sendViewIsCurrent,\s*\(\) => reader\.read\(\),/, "Every reader await must stop stale chunks before UI mutation.");
  assert.doesNotMatch(send, /!route\.project \|\| sendViewIsCurrent\(\)/, "Ordinary chat failures must not update a newer conversation.");
  assert.match(send, /if \(sendViewIsCurrent\(\)\) \{\s*const failure/, "Only the current send may append a failure.");
  assert.match(source, /pagehide/);
});
