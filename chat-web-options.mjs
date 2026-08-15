export function normalizeWebResultLimit(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 10;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(5, Math.min(20, Math.round(parsed)));
}

export function normalizeWebRouteOptions({
  maxResults,
  contextTokenBudget,
}) {
  const rawBudget = Number(contextTokenBudget);
  const budget = Number.isFinite(rawBudget)
    ? Math.max(500, Math.min(100000, Math.round(rawBudget)))
    : 10000;
  return {
    maxResults: normalizeWebResultLimit(maxResults),
    contextTokenBudget: budget,
  };
}
