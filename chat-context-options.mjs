export const DEFAULT_CONTEXT_WINDOW = 524288;
export const QWEN_MAX_THINKING_TOKENS = 262144;
export const QWEN_MAX_VISIBLE_ANSWER_TOKENS = 131072;
export const QWEN_DEFAULT_COMBINED_COMPLETION_TOKENS = 393216;

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
  return { maximum, value: String(Math.min(Math.trunc(numeric), maximum)) };
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
