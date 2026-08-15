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

test("project file picker accepts visual and legacy project files", async () => {
  const { projectFileAccepted } = await loadContextOptions();
  for (const filename of ["scan.pdf", "chart.PNG", "photo.jpeg", "diagram.webp", "notes.md", "budget.xlsx"]) {
    assert.equal(projectFileAccepted(filename), true, `${filename} should be accepted for a project`);
  }
  assert.equal(projectFileAccepted("archive.exe"), false);
});

test("project upload analysis mode is explicitly auto or visual", async () => {
  const { projectUploadAnalysisMode } = await loadContextOptions();
  assert.equal(projectUploadAnalysisMode("auto"), "auto");
  assert.equal(projectUploadAnalysisMode("visual"), "visual");
  assert.equal(projectUploadAnalysisMode("every-page"), "auto");
});

test("project processing states use safe labels and bounded numeric progress", async () => {
  const { projectFileProcessingState } = await loadContextOptions();
  assert.deepEqual(projectFileProcessingState({ processing_status: "queued", processing_progress: "not a number" }), {
    status: "queued", label: "Queued for visual analysis", progress: 0,
  });
  assert.deepEqual(projectFileProcessingState({ processing_status: "processing", processing_progress: 47.8 }), {
    status: "processing", label: "Visual analysis in progress", progress: 47,
  });
  assert.deepEqual(projectFileProcessingState({ processing_status: "ready", processing_progress: -1 }), {
    status: "ready", label: "Ready", progress: 100,
  });
  assert.deepEqual(projectFileProcessingState({ processing_status: "ready_with_warnings", processing_progress: 500 }), {
    status: "ready_with_warnings", label: "Ready with warnings", progress: 100,
  });
  assert.deepEqual(projectFileProcessingState({ processing_status: "failed", processing_progress: 101 }), {
    status: "failed", label: "Visual analysis failed", progress: 100,
  });
});

test("project visual jobs use generic labels and safe progress", async () => {
  const { projectJobPresentation } = await loadContextOptions();
  assert.deepEqual(projectJobPresentation({
    kind: "project_visual_analysis",
    status: "processing",
    processing_progress: "unsafe",
    title: "private source name",
  }), {
    label: "Project visual analysis",
    status: "processing",
    statusLabel: "Processing",
    progress: 0,
  });
  assert.equal(projectJobPresentation({ status: "private_job_state" }).status, "queued");
});

test("only current visual evidence becomes top-level project media", async () => {
  const { projectMediaForChat } = await loadContextOptions();
  const result = projectMediaForChat({
    visual_evidence: [
      { reference: "opaque-1", label: "Chart.pdf — page 2" },
      { reference: "opaque-2", label: "Chart.pdf — page 3" },
      { reference: "", label: "Missing" },
    ],
  });
  assert.deepEqual(result, [
    { type: "image", reference: "opaque-1", label: "Chart.pdf — page 2" },
    { type: "image", reference: "opaque-2", label: "Chart.pdf — page 3" },
  ]);
});

test("saved project metadata excludes opaque visual references", async () => {
  const { projectHistoryMetadata } = await loadContextOptions();
  const metadata = projectHistoryMetadata({
    project: { id: "project-1", name: "Atlas" },
    passages: [{ citation: "[Project 1]", document_id: "file-1", document_name: "Chart.pdf", page: 2 }],
    visual_evidence: [{ reference: "opaque-token", label: "Chart.pdf — page 2" }],
  });
  assert.deepEqual(metadata, {
    project_id: "project-1",
    project_name: "Atlas",
    passages: [{ citation: "[Project 1]", document_id: "file-1", document_name: "Chart.pdf", page: 2, section: undefined, lines: undefined }],
  });
  assert.doesNotMatch(JSON.stringify(metadata), /opaque-token/);
});
