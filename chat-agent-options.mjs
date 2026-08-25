const EMPTY_ACTIVITY = Object.freeze({
  steps: [],
  tools: [],
  artifacts: [],
  citations: [],
});

function boundedPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function resolveAgentContract(contract) {
  const integration = contract?.agent_integration;
  const chat = integration?.chat;
  const safeEvents = Array.isArray(integration?.streaming?.safe_event_names)
    ? integration.streaming.safe_event_names
    : [];
  const available = chat?.optional_request_field === "agent"
    && chat?.enabled_value?.enabled === true
    && safeEvents.includes("agent_step")
    && safeEvents.includes("tool_result")
    && integration?.guarantees?.hidden_reasoning_in_trace === false
    && integration?.guarantees?.shell_access === false;

  return {
    available,
    defaultMaxSteps: boundedPositiveInteger(chat?.max_steps?.default, 16),
    maximumMaxSteps: boundedPositiveInteger(chat?.max_steps?.maximum, 32),
  };
}

export function withAgentRequest(payload, mode, contract) {
  if (mode !== "agent") return payload;
  if (!contract?.available) throw new Error("Agent mode is unavailable from the current API contract.");
  return { ...payload, agent: { enabled: true } };
}

function safeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function safeTraceRecord(value) {
  if (!value || typeof value !== "object") return null;
  const tool = safeText(value.tool);
  const status = safeText(value.status);
  const callId = safeText(value.call_id ?? value.callId);
  const elapsed = Number(value.elapsed_ms ?? value.elapsedMs);
  if (!tool || !status || !callId || !Number.isFinite(elapsed) || elapsed < 0) return null;
  return {
    tool,
    status,
    elapsedMs: Math.round(elapsed),
    callId,
  };
}

function safeArtifact(value) {
  if (!value || typeof value !== "object") return null;
  const tool = safeText(value.tool);
  const id = safeText(value.prompt_id ?? value.job_id ?? value.id);
  const pollUrl = safeText(value.poll_url ?? value.pollUrl);
  if (!tool || !id || !pollUrl.startsWith("/api/")) return null;
  return { tool, id, pollUrl };
}

function safeCitation(value) {
  if (!value || typeof value !== "object") return null;
  const title = safeText(value.title);
  const url = safeText(value.url);
  if (!title || !/^https?:\/\//i.test(url)) return null;
  const index = boundedPositiveInteger(value.index, null);
  return index ? { index, title, url } : { title, url };
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const identity = key(value);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function mergeAgentActivity(current = EMPTY_ACTIVITY, chunk = {}) {
  const steps = Array.isArray(current?.steps)
    ? current.steps.filter((step) => Number.isInteger(step) && step > 0)
    : [];
  if (chunk?.type === "agent_step" && Number.isInteger(chunk.step) && chunk.step > 0) {
    steps.push(chunk.step);
  }

  const tools = Array.isArray(current?.tools)
    ? current.tools.map(safeTraceRecord).filter(Boolean)
    : [];
  if (chunk?.type === "tool_result") {
    const record = safeTraceRecord(chunk);
    if (record) tools.push(record);
  }
  if (Array.isArray(chunk?.agent_trace)) {
    tools.push(...chunk.agent_trace.map(safeTraceRecord).filter(Boolean));
  }

  const artifacts = Array.isArray(current?.artifacts)
    ? current.artifacts.map(safeArtifact).filter(Boolean)
    : [];
  if (Array.isArray(chunk?.agent_artifacts)) {
    artifacts.push(...chunk.agent_artifacts.map(safeArtifact).filter(Boolean));
  }

  const citations = Array.isArray(current?.citations)
    ? current.citations.map(safeCitation).filter(Boolean)
    : [];
  if (Array.isArray(chunk?.citations)) {
    citations.push(...chunk.citations.map(safeCitation).filter(Boolean));
  }

  return {
    steps: [...new Set(steps)].sort((left, right) => left - right),
    tools: uniqueBy(tools, (record) => record.callId),
    artifacts: uniqueBy(artifacts, (artifact) => `${artifact.tool}:${artifact.id}`),
    citations: uniqueBy(citations, (citation) => citation.url),
  };
}
