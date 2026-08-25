import test from "node:test";
import assert from "node:assert/strict";

let subject = {};
try {
  subject = await import("../chat-agent-options.mjs");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const liveContractFixture = {
  agent_integration: {
    chat: {
      compatibility: "Requests without agent.enabled=true retain the existing chat path.",
      enabled_value: { enabled: true },
      max_steps: { default: 16, maximum: 32, minimum: 1 },
      optional_request_field: "agent",
    },
    guarantees: {
      hidden_reasoning_in_trace: false,
      one_model: true,
      shell_access: false,
    },
    jobs: {
      durable_fields: ["request_summary", "trace", "answer", "agent_artifacts", "citations", "usage", "error", "error_stage"],
      kind: "agent",
      privacy: "Encrypted owner-scoped records exclude raw credentials, media bytes, complete tool results, and hidden reasoning.",
    },
    streaming: {
      final_event: "One standard OpenAI chat completion chunk followed by [DONE].",
      safe_event_names: ["agent_step", "tool_result"],
      trace_fields: ["tool", "status", "elapsed_ms", "call_id"],
    },
    tools: {
      discovery: "/api/agent/tools",
      invocation: "/api/agent/tools/call",
      invocation_authorization: "Each tool applies its existing authorization and owner scope.",
    },
  },
};

test("agent availability requires the documented opt-in and safe stream contract", () => {
  const supported = subject.resolveAgentContract?.(liveContractFixture);
  const incompatible = subject.resolveAgentContract?.({
    agent_integration: {
      ...liveContractFixture.agent_integration,
      streaming: { safe_event_names: ["agent_step"] },
    },
  });

  assert.deepEqual(supported, {
    available: true,
    defaultMaxSteps: 16,
    maximumMaxSteps: 32,
  });
  assert.equal(incompatible?.available, false);
});

test("only Agent mode adds the server-owned agent request field", () => {
  const base = { model: "Qwen-Qwen3.8-27B", messages: [{ role: "user", content: "Check the server" }] };

  assert.deepEqual(subject.withAgentRequest?.(base, "agent", { available: true }), {
    ...base,
    agent: { enabled: true },
  });
  assert.deepEqual(subject.withAgentRequest?.(base, "chat", { available: true }), base);
  assert.throws(
    () => subject.withAgentRequest?.(base, "agent", { available: false }),
    /Agent mode is unavailable/,
  );
});

test("agent activity retains only documented safe trace and artifact fields", () => {
  let activity = subject.mergeAgentActivity?.({}, {
    type: "agent_step",
    step: 2,
    reasoning_content: "must never render",
  });
  activity = subject.mergeAgentActivity?.(activity, {
    type: "tool_result",
    tool: "generate_image",
    status: "ok",
    elapsed_ms: 42,
    call_id: "call-1",
    arguments: { prompt: "private prompt" },
    result: { secret: "must never render" },
  });
  activity = subject.mergeAgentActivity?.(activity, {
    agent_trace: [{ tool: "generate_image", status: "ok", elapsed_ms: 42, call_id: "call-1" }],
    agent_artifacts: [{
      tool: "generate_image",
      prompt_id: "job-123",
      poll_url: "/api/image/history/job-123",
      provider_response: "must never render",
    }],
    citations: [{ index: 1, title: "Primary source", url: "https://example.com/source", snippet: "omit me" }],
  });

  assert.deepEqual(activity, {
    steps: [2],
    tools: [{ tool: "generate_image", status: "ok", elapsedMs: 42, callId: "call-1" }],
    artifacts: [{ tool: "generate_image", id: "job-123", pollUrl: "/api/image/history/job-123" }],
    citations: [{ index: 1, title: "Primary source", url: "https://example.com/source" }],
  });
  assert.doesNotMatch(JSON.stringify(activity), /private prompt|secret|reasoning|provider_response/);
});
