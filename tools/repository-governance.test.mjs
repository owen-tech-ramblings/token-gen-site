import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");
const instructions = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

test("CI is one targeted master-only run on the private runner", () => {
  assert.match(workflow, /risk-based-targeted-v2/);
  assert.match(workflow, /branches:\s*\n\s*- master/);
  assert.match(workflow, /self-hosted, linux, x64, lil-zen-ci/);
  assert.doesNotMatch(workflow, /pull_request|ubuntu-latest|npm test|\n\s*- dev/);
});

test("repository instructions bind the governed authoring and release path", () => {
  assert.match(instructions, /Canonical root: `\/home\/jesse\/\.openclaw\/workspace\/token-gen-site-pages`/);
  assert.match(instructions, /receipt-bound `codex\/\*` worktrees/);
  assert.match(instructions, /Approved secret locators are/);
  assert.match(instructions, /Google Secret Manager project `lil-zen-oc`/);
  assert.match(instructions, /`risk-based-targeted-v2`/);
  assert.match(instructions, /receipt-bound Token Gen Pages cutover/);
});
