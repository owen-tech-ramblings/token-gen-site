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
  const maximum = Math.max(1, Number(contextWindow));
  const text = value === null || value === undefined ? "" : String(value).trim();
  if (!text) return { maximum, value: "" };
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) return { maximum, value: "" };
  return { maximum, value: String(Math.min(numeric, maximum)) };
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
