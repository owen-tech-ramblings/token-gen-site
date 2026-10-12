import test from "node:test";
import assert from "node:assert/strict";
import { sourceReadingLabel, publicWebNotices, webSearchStatus } from "../chat-web-presentation.mjs";

test("source notices describe reading coverage without provider or parser diagnostics", () => {
  assert.deepEqual(["complete", "partial", "compacted", "snippet_only"].map(content_coverage => sourceReadingLabel({content_coverage})),
    ["Page read", "Excerpt used", "Summary used", "Search preview only"]);
  assert.equal(sourceReadingLabel({fetched:true}), "Page opened");
  assert.deepEqual(publicWebNotices([
    "Search round 1: The unmetered balanced SearXNG service performed the search directly.",
    "Tavily received the search query under the selected Tavily API key.",
    "Local embedding was unavailable; research evidence used lexical ranking.",
    "[1] The page could not be read; only its search snippet is available.",
    "[2] The page could not be read; only its search snippet is available.",
    "[3] Only selected passages fit the evidence budget.",
  ]), ["Some pages could not be opened; only their search previews were available.", "Some sources were read in part."]);
  assert.deepEqual(publicWebNotices([null, {}, "SearXNG HTTP 429"]), ["Some source information could not be checked."]);
});

test("search availability preserves meaningful degradation without billing or routing commentary", () => {
  assert.equal(webSearchStatus({available:true,unmetered_available:true}), "Web search is available.");
  assert.equal(webSearchStatus({available:true,degraded:true}), "Web search is available with limited coverage.");
  assert.equal(webSearchStatus({available:false}), "Web search is currently unavailable.");
  assert.deepEqual(publicWebNotices(["Fresh search failed; cached/prior evidence was used."]),
    ["Some current sources could not be checked; the answer uses the information available."]);
});
