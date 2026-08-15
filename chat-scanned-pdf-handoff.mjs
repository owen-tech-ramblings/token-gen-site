export function scannedPdfProjectAction(file, project) {
  if (!file) return { kind: "none" };
  if (!project?.id) return { kind: "choose_project" };
  return { kind: "upload", files: [file] };
}
