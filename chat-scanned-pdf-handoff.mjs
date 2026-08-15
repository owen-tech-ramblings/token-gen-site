export function createPendingScannedPdf(file, id) {
  if (!file || !String(id || "").trim()) return null;
  return { id: String(id), file, busy: false, uploadToken: 0 };
}

export function scannedPdfProjectAction(pending, project) {
  if (!pending?.file) return { kind: "none" };
  if (pending.busy) return { kind: "busy" };
  if (!project?.id) return { kind: "choose_project" };
  return {
    kind: "upload",
    files: [pending.file],
    pendingId: pending.id,
    projectId: String(project.id),
  };
}

export function beginScannedPdfUpload(pending, project) {
  const action = scannedPdfProjectAction(pending, project);
  if (action.kind !== "upload") return { pending, action };
  const uploadToken = Number(pending.uploadToken || 0) + 1;
  return {
    pending: { ...pending, busy: true, uploadToken },
    action: { ...action, uploadToken },
  };
}

export function finishScannedPdfUpload(pending, action, succeeded) {
  if (
    !pending
    || action?.kind !== "upload"
    || pending.id !== action.pendingId
    || pending.uploadToken !== action.uploadToken
  ) return pending;
  return succeeded ? null : { ...pending, busy: false };
}

export function scannedPdfUploadAppliesToProject(action, project) {
  return action?.kind === "upload" && action.projectId === String(project?.id || "");
}
