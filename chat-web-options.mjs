export function normalizeWebResultLimit(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 10;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(5, Math.min(20, Math.round(parsed)));
}

export function normalizeWebRouteOptions({
  research,
  maxResults,
  contextTokenBudget,
}) {
  return {
    maxResults: normalizeWebResultLimit(maxResults),
    contextTokenBudget: research
      ? Math.max(16000, Number(contextTokenBudget || 10000))
      : Number(contextTokenBudget || 10000),
  };
}
