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
  assert.equal(withOptionalGenerationLimit({}, "64000.5", 524288).max_tokens, 64000);
  assert.equal(withOptionalGenerationLimit({}, "0.5", 524288).max_tokens, 1);
});

test("trusted project instructions stay separate from whole untrusted evidence units", async () => {
  const { contextPayloadParts } = await loadContextOptions();
  const documents = [
    { name: "one.txt", text: "alpha tail" },
    { name: "two.txt", text: "beta tail" },
  ];
  const project = {
    project: { name: "Atlas", instructions: "Prefer the current release." },
    passages: [
      { citation: "[Project 1]", document_name: "a.pdf", text: "gamma tail" },
      { citation: "[Project 2]", document_name: "b.pdf", text: "delta tail" },
    ],
  };
  const result = contextPayloadParts(documents, project);
  assert.match(result.trustedSystem, /Prefer the current release\./);
  assert.doesNotMatch(result.trustedSystem, /alpha tail|gamma tail/);
  assert.equal(result.evidenceMessages.length, 4);
  assert.deepEqual(result.evidenceMessages.map((message) => message.role), ["user", "user", "user", "user"]);
  assert.match(result.evidenceMessages[0].content, /alpha tail/);
  assert.match(result.evidenceMessages[1].content, /beta tail/);
  assert.match(result.evidenceMessages[2].content, /\[Project 1\][\s\S]*gamma tail/);
  assert.match(result.evidenceMessages[3].content, /\[Project 2\][\s\S]*delta tail/);
});

test("structured API errors have a readable safe message", async () => {
  const { apiErrorMessage } = await loadContextOptions();
  assert.equal(apiErrorMessage("plain failure"), "plain failure");
  assert.equal(
    apiErrorMessage({ code: "context_capacity_exceeded", stage: "context_admission" }),
    "context_capacity_exceeded (context_admission)",
  );
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
