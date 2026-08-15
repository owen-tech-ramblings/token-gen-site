import assert from "node:assert/strict";
import test from "node:test";

async function loadContextOptions() {
  try {
    return await import("../chat-context-options.mjs");
  } catch (error) {
    assert.fail(`chat-context-options.mjs must provide real request normalization: ${error}`);
  }
}

test("automatic generation allocation omits max_tokens", async () => {
  const { withOptionalGenerationLimit } = await loadContextOptions();
  assert.deepEqual(
    withOptionalGenerationLimit({ model: "Qwen-Qwen3.8-27B" }, "", 524288),
    { model: "Qwen-Qwen3.8-27B" },
  );
});

test("model discovery retains an explicit generation limit within the physical context", async () => {
  const { generationControlState, withOptionalGenerationLimit } = await loadContextOptions();
  assert.deepEqual(generationControlState("64000", 524288), {
    maximum: 524288,
    value: "64000",
  });
  assert.equal(withOptionalGenerationLimit({}, "64000", 524288).max_tokens, 64000);
  assert.equal(withOptionalGenerationLimit({}, "600000", 524288).max_tokens, 524288);
});

test("reasoning capacity prefers optional discovery metadata with Qwen defaults", async () => {
  const { reasoningCapacity } = await loadContextOptions();
  assert.deepEqual(reasoningCapacity({
    capabilities: {
      reasoning: {
        dynamic_allocation: true,
        max_thinking_tokens: 200000,
        max_visible_answer_tokens: 100000,
        default_combined_completion_tokens: 300000,
      },
    },
  }), {
    dynamicAllocation: true,
    maxThinkingTokens: 200000,
    maxVisibleAnswerTokens: 100000,
    defaultCombinedCompletionTokens: 300000,
  });
  assert.equal(reasoningCapacity({}, {
    reasoning: { max_visible_answer_tokens: 96000 },
  }).maxVisibleAnswerTokens, 96000);
  assert.deepEqual(reasoningCapacity({}), {
    dynamicAllocation: true,
    maxThinkingTokens: 262144,
    maxVisibleAnswerTokens: 131072,
    defaultCombinedCompletionTokens: 393216,
  });
});

test("all twenty API-returned web sources remain available", async () => {
  const { webContextSources } = await loadContextOptions();
  const sources = Array.from({ length: 20 }, (_, index) => ({
    index: index + 1,
    title: `Source ${index + 1}`,
    url: `https://example.com/${index + 1}`,
  }));
  assert.deepEqual(webContextSources({ sources }), sources);
});

test("project retrieval supplies up to forty-eight candidates within the 100k evidence ceiling", async () => {
  const { projectRetrievalOptions } = await loadContextOptions();
  assert.deepEqual(projectRetrievalOptions(524288), { top_k: 48, token_budget: 100000 });
  assert.deepEqual(projectRetrievalOptions(64000), { top_k: 48, token_budget: 64000 });
});

test("all forty-eight returned project passages remain available", async () => {
  const { projectContextPassages } = await loadContextOptions();
  const passages = Array.from({ length: 48 }, (_, index) => ({
    citation: `[P${index + 1}]`,
    document_name: `Document ${index + 1}`,
  }));
  assert.deepEqual(projectContextPassages({ passages }), passages);
});
