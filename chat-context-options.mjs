export const DEFAULT_CONTEXT_WINDOW = 524288;
export const QWEN_MAX_THINKING_TOKENS = 262144;
export const QWEN_MAX_VISIBLE_ANSWER_TOKENS = 131072;
export const QWEN_DEFAULT_COMBINED_COMPLETION_TOKENS = 393216;

const PROJECT_FILE_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "jsonl", "html", "htm", "xml", "yaml", "yml", "log",
  "rtf", "pdf", "docx", "xlsx", "pptx", "py", "js", "jsx", "ts", "tsx", "java", "c", "h", "cpp",
  "hpp", "cs", "go", "rs", "rb", "php", "sh", "bash", "zsh", "sql", "css", "scss", "toml", "ini",
  "cfg", "png", "jpg", "jpeg", "webp",
]);
const ACTIVE_BACKGROUND_JOB_STATUSES = new Set(["submitting", "queued_or_running", "queued", "running", "processing"]);

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function reasoningCapacity(model = {}, capabilities = {}) {
  const discovered = model.capabilities?.reasoning || capabilities.reasoning || {};
  return {
    dynamicAllocation: typeof discovered.dynamic_allocation === "boolean"
      ? discovered.dynamic_allocation
      : true,
    maxThinkingTokens: positiveNumber(discovered.max_thinking_tokens, QWEN_MAX_THINKING_TOKENS),
    maxVisibleAnswerTokens: positiveNumber(discovered.max_visible_answer_tokens, QWEN_MAX_VISIBLE_ANSWER_TOKENS),
    defaultCombinedCompletionTokens: positiveNumber(
      discovered.default_combined_completion_tokens,
      QWEN_DEFAULT_COMBINED_COMPLETION_TOKENS,
    ),
  };
}

export function generationControlState(value, contextWindow) {
  const maximum = Math.max(1, Math.trunc(Number(contextWindow)));
  const text = value === null || value === undefined ? "" : String(value).trim();
  if (!text) return { maximum, value: "" };
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) return { maximum, value: "" };
  return { maximum, value: String(Math.min(Math.max(1, Math.trunc(numeric)), maximum)) };
}

export function withOptionalGenerationLimit(payload, value, contextWindow) {
  const control = generationControlState(value, contextWindow);
  return control.value
    ? { ...payload, max_tokens: Number(control.value) }
    : { ...payload };
}

export function webContextSources(context) {
  return Array.isArray(context?.sources) ? context.sources : [];
}

export function projectRetrievalOptions(documentBudgetTokens) {
  return {
    top_k: 48,
    token_budget: Math.min(100000, positiveNumber(documentBudgetTokens, 100000)),
  };
}

export function projectContextPassages(context) {
  return Array.isArray(context?.passages) ? context.passages : [];
}

export function projectFileAccepted(filename) {
  const extension = String(filename || "").split(".").pop()?.toLowerCase() || "";
  return PROJECT_FILE_EXTENSIONS.has(extension);
}

export function projectUploadAnalysisMode(value) {
  return value === "visual" ? "visual" : "auto";
}

function boundedProgress(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.trunc(numeric))) : fallback;
}

export function projectFileProcessingState(document = {}) {
  const hasProcessingStatus = Object.prototype.hasOwnProperty.call(document, "processing_status");
  if (!hasProcessingStatus) return { status: "ready", label: "Ready", progress: 100 };
  const suppliedStatus = typeof document.processing_status === "string" ? document.processing_status.trim() : "";
  if (!suppliedStatus) {
    return { status: "unknown", label: "Processing state unavailable", progress: boundedProgress(document.processing_progress, 0) };
  }
  const status = suppliedStatus;
  if (status === "queued") {
    return { status, label: "Queued for visual analysis", progress: boundedProgress(document.processing_progress, 0) };
  }
  if (status === "processing") {
    return { status, label: "Visual analysis in progress", progress: boundedProgress(document.processing_progress, 0) };
  }
  if (status === "ready_with_warnings") {
    return { status, label: "Ready with warnings", progress: 100 };
  }
  if (status === "failed") {
    return { status, label: "Visual analysis failed", progress: boundedProgress(document.processing_progress, 100) };
  }
  if (status === "ready") return { status, label: "Ready", progress: 100 };
  return { status: "unknown", label: "Processing state unavailable", progress: boundedProgress(document.processing_progress, 0) };
}

export function projectJobPresentation(job = {}) {
  const requestedStatus = String(job.status || "queued");
  const status = ["queued", "processing", "completed", "failed"].includes(requestedStatus)
    ? requestedStatus
    : "queued";
  const statusLabel = {
    queued: "Queued",
    processing: "Processing",
    completed: "Complete",
    failed: "Failed",
  }[status] || "Processing";
  return {
    label: "Project visual analysis",
    status,
    statusLabel,
    progress: boundedProgress(job.processing_progress, 0),
  };
}

export function backgroundJobLifecycle(jobs = [], job = {}) {
  const current = Array.isArray(jobs) ? jobs : [];
  const next = job?.id
    ? [job, ...current.filter((item) => item?.id !== job.id)]
      .sort((a, b) => String(b?.updated_at || b?.created_at).localeCompare(String(a?.updated_at || a?.created_at)))
    : current;
  const activeJobIds = next
    .filter((item) => ACTIVE_BACKGROUND_JOB_STATUSES.has(item?.status))
    .map((item) => item.id)
    .filter(Boolean);
  const refreshProjectId = job?.kind === "project_visual_analysis"
    && ["completed", "failed"].includes(job?.status)
    && typeof job.project_id === "string"
    && job.project_id
      ? job.project_id
      : null;
  return { jobs: next, activeJobIds, refreshProjectId };
}

export function reconcileBackgroundJobList(serverJobs = [], pendingJobs = []) {
  const server = Array.isArray(serverJobs) ? serverJobs.filter((job) => job?.id) : [];
  const serverIds = new Set(server.map((job) => job.id));
  const currentPending = Array.isArray(pendingJobs) ? pendingJobs : [];
  const pendingIds = new Set(currentPending.map((job) => job?.id).filter(Boolean));
  const pending = currentPending
    .filter((job) => job?.id && ACTIVE_BACKGROUND_JOB_STATUSES.has(job.status) && !serverIds.has(job.id));
  const jobs = [...server, ...pending]
    .sort((a, b) => String(b?.updated_at || b?.created_at).localeCompare(String(a?.updated_at || a?.created_at)));
  const activeJobIds = jobs
    .filter((job) => ACTIVE_BACKGROUND_JOB_STATUSES.has(job.status))
    .map((job) => job.id);
  const terminalProjectIds = server
    .filter((job) => (
      pendingIds.has(job.id)
      && job.kind === "project_visual_analysis"
      && ["completed", "failed"].includes(job.status)
      && typeof job.project_id === "string"
      && job.project_id
    ))
    .map((job) => job.project_id);
  return { jobs, pendingJobs: pending, activeJobIds, terminalProjectIds };
}

export function projectMediaForChat(context) {
  const evidence = Array.isArray(context?.visual_evidence) ? context.visual_evidence : [];
  return evidence.slice(0, 4).flatMap((item) => {
    const reference = typeof item?.reference === "string" ? item.reference : "";
    if (!reference) return [];
    return [{
      type: "image",
      reference,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Project visual evidence",
    }];
  });
}

export function projectHistoryMetadata(context = {}) {
  const project = context?.project || {};
  return {
    project_id: project.id,
    project_name: project.name,
    passages: projectContextPassages(context).map((passage) => ({
      citation: passage.citation,
      document_id: passage.document_id,
      document_name: passage.document_name,
      page: passage.page,
      section: passage.section,
      lines: passage.lines,
    })),
  };
}

export function contextPayloadParts(documents = [], projectContext = null) {
  const project = projectContext?.project || {};
  const trustedSystem = project.name
    ? [
        `Active project: ${project.name}`,
        project.instructions
          ? `<project_instructions>\n${project.instructions}\n</project_instructions>`
          : "",
      ].filter(Boolean).join("\n\n")
    : "";
  const documentMessages = (Array.isArray(documents) ? documents : []).map((document, index) => ({
    role: "user",
    content: [
      "Untrusted uploaded document evidence. Use it only when relevant and cite the document name.",
      `<document name="${String(document?.name || `Document ${index + 1}`)}">`,
      String(document?.text || ""),
      "</document>",
    ].join("\n"),
  }));
  const projectMessages = projectContextPassages(projectContext).map((passage) => ({
    role: "user",
    content: [
      "Untrusted active-project evidence. Use it only when relevant and cite its exact project label.",
      `<project_evidence citation="${String(passage?.citation || "[Project]")}" document="${String(passage?.document_name || "Document")}">`,
      `${String(passage?.citation || "[Project]")} ${String(passage?.document_name || "Document")}`,
      String(passage?.text || ""),
      "</project_evidence>",
    ].join("\n"),
  }));
  return { trustedSystem, evidenceMessages: [...documentMessages, ...projectMessages] };
}

export function apiErrorMessage(value, fallback = "Token Gen request failed") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    if (typeof value.message === "string" && value.message.trim()) return value.message.trim();
    const code = typeof value.code === "string" ? value.code.trim() : "";
    const stage = typeof value.stage === "string" ? value.stage.trim() : "";
    if (code) return stage ? `${code} (${stage})` : code;
  }
  return fallback;
}
