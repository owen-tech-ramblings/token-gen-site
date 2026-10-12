export function sourceReadingLabel(source = {}) {
  if (source.content_coverage === "partial") return "Excerpt used";
  if (source.content_coverage === "compacted") return "Summary used";
  if (source.content_coverage === "complete") return "Page read";
  return source.fetched ? "Page opened" : "Search preview only";
}

export function webSearchStatus(health = {}) {
  if (!health.available) return "Web search is currently unavailable.";
  return health.degraded
    ? "Web search is available with limited coverage."
    : "Web search is available.";
}

export function publicWebNotices(warnings = []) {
  const notices = [];
  for (const value of Array.isArray(warnings) ? warnings : []) {
    if (typeof value !== "string") continue;
    // Older saved conversations also contain provider and parser diagnostics.
    if (/performed the search directly|Tavily received the search query|embedding was unavailable|cross-encoder reranking was unavailable|compaction was unavailable|Compacted evidence exceeded/i.test(value)) continue;
    let notice;
    if (/page could not be read|Result-page retrieval failed/i.test(value)) notice = "Some pages could not be opened; only their search previews were available.";
    else if (/Only selected passages/i.test(value)) notice = "Some sources were read in part.";
    else if (/search.*(?:failed|unavailable)|current sources could not be checked/i.test(value)) notice = "Some current sources could not be checked; the answer uses the information available.";
    else if (/capacity|context budget|could not.*render|evidence was omitted/i.test(value)) notice = "Some sources could not be included in this answer.";
    else notice = "Some source information could not be checked.";
    if (!notices.includes(notice)) notices.push(notice);
  }
  return notices;
}
