export function createPendingScannedPdf(file, id) {
  if (!file || !String(id || "").trim()) return null;
  return { id: String(id), file };
}

export function createScannedPdfHandoffState() {
  return { pending: null, activeAction: null, nextActionToken: 0 };
}

export function stageScannedPdf(state, file, id) {
  const pending = createPendingScannedPdf(file, id);
  return pending ? { ...state, pending } : state;
}

export function clearStagedScannedPdf(state) {
  return { ...state, pending: null };
}

export function scannedPdfProjectAction(state, project) {
  if (!state?.pending?.file) return { kind: "none" };
  if (state.activeAction) return { kind: "busy" };
  if (!project?.id) return { kind: "choose_project" };
  return {
    kind: "upload",
    files: [state.pending.file],
    pending: state.pending,
    projectId: String(project.id),
  };
}

export function beginScannedPdfUpload(state, project) {
  const action = scannedPdfProjectAction(state, project);
  if (action.kind !== "upload") return { state, action };
  const token = Number(state.nextActionToken || 0) + 1;
  return {
    state: { ...state, activeAction: { ...action, token }, nextActionToken: token },
    action: { ...action, token },
  };
}

export function finishScannedPdfUpload(state, action, succeeded, destinationIsCurrent) {
  if (action?.kind !== "upload" || state?.activeAction?.token !== action.token) return state;
  const clear = succeeded && destinationIsCurrent && state.pending === action.pending;
  return { ...state, activeAction: null, pending: clear ? null : state.pending };
}

export function scannedPdfUploadAppliesToProject(action, project) {
  return action?.kind === "upload" && action.projectId === String(project?.id || "");
}

export function beginOwnedOperation(state) {
  const busyToken = Number(state?.nextOperationToken || 0) + 1;
  return { ...state, busy: true, busyToken, nextOperationToken: busyToken };
}

export function finishOwnedOperation(state, busyToken) {
  if (state?.busyToken !== busyToken) return state;
  return { ...state, busy: false, busyToken: null };
}

export function captureProjectView(projectState, conversationGeneration, projectId) {
  return {
    projectId: String(projectId || ""),
    viewGeneration: Number(projectState?.viewGeneration || 0),
    conversationGeneration: Number(conversationGeneration || 0),
  };
}

export function projectViewIsCurrent(projectState, conversationGeneration, captured) {
  return Boolean(
    captured?.projectId
    && projectState?.activeId === captured.projectId
    && projectState?.active?.id === captured.projectId
    && Number(projectState?.viewGeneration || 0) === captured.viewGeneration
    && Number(conversationGeneration || 0) === captured.conversationGeneration
  );
}

export function captureProjectSelection(projectState, conversationGeneration, projectId) {
  return {
    projectId: String(projectId || ""),
    viewGeneration: Number(projectState?.viewGeneration || 0),
    conversationGeneration: Number(conversationGeneration || 0),
  };
}

export function projectSelectionIsCurrent(projectState, conversationGeneration, captured) {
  return Boolean(
    captured?.projectId
    && projectState?.activeId === captured.projectId
    && Number(projectState?.viewGeneration || 0) === captured.viewGeneration
    && Number(conversationGeneration || 0) === captured.conversationGeneration
  );
}

export function beginHistoryViewAction(state) {
  const actionToken = Number(state?.nextHistoryActionToken || 0) + 1;
  const viewGeneration = Number(state?.viewGeneration || 0) + 1;
  const action = { actionToken, viewGeneration };
  return {
    state: {
      ...state,
      viewGeneration,
      historyActionToken: actionToken,
      nextHistoryActionToken: actionToken,
    },
    action,
  };
}

export function historyViewActionIsCurrent(state, action) {
  return Boolean(
    action
    && Number(state?.viewGeneration || 0) === action.viewGeneration
    && Number(state?.historyActionToken || 0) === action.actionToken
  );
}

export function captureHistoryViewAction(state) {
  return {
    actionToken: Number(state?.historyActionToken || 0),
    viewGeneration: Number(state?.viewGeneration || 0),
  };
}

export function applySavedConversationResult(state, expectedAction, conversation, version) {
  if (!expectedAction || !historyViewActionIsCurrent(state, expectedAction)) {
    return { state, applied: false };
  }
  return {
    state: {
      ...state,
      currentId: conversation.id,
      currentVersion: version || conversation.version,
    },
    applied: true,
  };
}

export function loadedActiveProject(projectState) {
  const active = projectState?.active;
  if (!active?.id || String(projectState?.activeId || "") !== String(active.id)) return null;
  return active;
}

export function captureLoadedProjectScope(projectState, conversationGeneration) {
  const project = loadedActiveProject(projectState);
  if (!project) return null;
  return {
    project,
    view: captureProjectView(projectState, conversationGeneration, project.id),
  };
}

export function projectScopeIsCurrent(projectState, conversationGeneration, scope) {
  return Boolean(
    scope?.project?.id
    && projectViewIsCurrent(projectState, conversationGeneration, scope.view)
  );
}

export async function prepareCurrentProjectScope(projectState, conversationGeneration, scope, prepare) {
  if (!projectScopeIsCurrent(projectState, conversationGeneration, scope)) {
    return { current: false, value: null };
  }
  const value = await prepare(scope.project);
  return projectScopeIsCurrent(projectState, conversationGeneration, scope)
    ? { current: true, value }
    : { current: false, value: null };
}

export async function awaitCurrentSendStep(isCurrent, operation, { reader = null, controller = null } = {}) {
  try {
    const value = await operation();
    if (isCurrent()) return { current: true, value };
  } catch (error) {
    if (isCurrent()) throw error;
  }
  if (controller && !controller.signal.aborted) controller.abort();
  if (reader?.cancel) {
    try {
      await reader.cancel();
    } catch {
      // A closed stream does not need another recovery path.
    }
  }
  return { current: false, value: null };
}
