import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatHtml = readFileSync(new URL("../chat.html", import.meta.url), "utf8");

async function loadWebOptions() {
  try {
    return await import("../chat-web-options.mjs");
  } catch (error) {
    assert.fail(`chat-web-options.mjs must provide real route normalization: ${error}`);
  }
}

test("website exposes a 5 through 20 Sources range with default 10", () => {
  assert.match(
    chatHtml,
    /id="chatWebResults"[^>]*min="5"[^>]*max="20"[^>]*step="1"[^>]*value="10"/,
  );
});

test("website exposes the API's 100k web evidence ceiling", () => {
  assert.match(
    chatHtml,
    /id="chatWebBudget"[^>]*min="500"[^>]*max="100000"[^>]*value="16000"/,
  );
});

test("website result-limit normalization defaults and clamps", async () => {
  const { normalizeWebResultLimit } = await loadWebOptions();
  for (const [value, expected] of [
    [undefined, 10],
    [null, 10],
    ["", 10],
    ["invalid", 10],
    [1, 5],
    [5, 5],
    [5.4, 5],
    [10, 10],
    [19.6, 20],
    [20, 20],
    [99, 20],
  ]) {
    assert.equal(
      normalizeWebResultLimit(value),
      expected,
      `Unexpected limit for ${String(value)}`,
    );
  }
});

test("ordinary Web and Research routes preserve the selected evidence budget", async () => {
  const { normalizeWebRouteOptions } = await loadWebOptions();
  assert.deepEqual(
    normalizeWebRouteOptions({
      research: false,
      maxResults: 5,
      contextTokenBudget: 10000,
    }),
    { maxResults: 5, contextTokenBudget: 10000 },
  );
  assert.deepEqual(
    normalizeWebRouteOptions({
      research: true,
      maxResults: 5,
      contextTokenBudget: 10000,
    }),
    { maxResults: 5, contextTokenBudget: 10000 },
  );
});

test("web evidence budget is integer-normalized within the advertised range", async () => {
  const { normalizeWebRouteOptions } = await loadWebOptions();
  for (const [value, expected] of [
    [499, 500],
    [500.8, 501],
    [100000, 100000],
    [200000, 100000],
    ["", 10000],
    ["   ", 10000],
    ["invalid", 10000],
  ]) {
    assert.equal(
      normalizeWebRouteOptions({ maxResults: 10, contextTokenBudget: value }).contextTokenBudget,
      expected,
    );
  }
});
