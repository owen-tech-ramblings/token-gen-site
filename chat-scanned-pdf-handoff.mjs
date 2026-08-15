export function createPendingScannedPdf(file, id) {
  if (!file || !String(id || "").trim()) return null;
  return { id: String(id), file };
}

export function createScannedPdfHandoffState() {
  return { pending: null, activeAction: null, nextActionToken: 0 };
}

export function stageScannedPdf(state, file, id) {
  if (state?.activeAction) return state;
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
    pendingId: state.pending.id,
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
  const clear = succeeded && destinationIsCurrent && state.pending?.id === action.pendingId;
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
