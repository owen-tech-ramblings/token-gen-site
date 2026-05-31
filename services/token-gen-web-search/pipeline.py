from __future__ import annotations

import html
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class FetchSettings:
    mode: str
    proxy: str | None
    timeout_seconds: float


@dataclass(frozen=True)
class SearchResult:
    index: int
    title: str
    url: str
    snippet: str


@dataclass(frozen=True)
class TextChunk:
    text: str
    source_index: int
    chunk_index: int
    score: float = 0.0


@dataclass(frozen=True)
class ExtractedPage:
    source: SearchResult
    text: str
    fetched: bool
    extraction_method: str
    error: str | None = None


def normalize_fetch_settings(raw: dict[str, Any] | None) -> FetchSettings:
    raw = raw or {}
    mode = raw.get("mode") or os.getenv("WEB_FETCH_MODE") or "direct"
    if mode not in {"direct", "tor", "proxy"}:
        mode = "direct"

    proxy = raw.get("proxy") or os.getenv("WEB_FETCH_PROXY")
    if mode == "tor" and not proxy:
        proxy = "socks5h://127.0.0.1:9050"
    if mode == "direct":
        proxy = None

    timeout_seconds = float(raw.get("timeout_seconds") or os.getenv("WEB_FETCH_TIMEOUT_SECONDS") or 20)

    return FetchSettings(mode=mode, proxy=proxy, timeout_seconds=timeout_seconds)


def clean_text(value: str) -> str:
    decoded = html.unescape(value or "")
    decoded = re.sub(r"<(script|style).*?</\1>", " ", decoded, flags=re.IGNORECASE | re.DOTALL)
    decoded = re.sub(r"<[^>]+>", " ", decoded)
    decoded = re.sub(r"\s+", " ", decoded)
    return decoded.strip()


def extract_main_text(page_html: str) -> tuple[str, str]:
    try:
        import trafilatura

        extracted = trafilatura.extract(page_html, include_comments=False, include_tables=False)
        if extracted and len(extracted.strip()) >= 200:
            return clean_text(extracted), "trafilatura"
    except Exception:
        pass

    try:
        from readability import Document

        document = Document(page_html)
        extracted = document.summary(html_partial=True)
        if extracted and len(clean_text(extracted)) >= 120:
            return clean_text(extracted), "readability-lxml"
    except Exception:
        pass

    return clean_text(page_html), "html-strip"


def chunk_text(text: str, *, max_words: int = 220, overlap_words: int = 40, source_index: int = 0) -> list[TextChunk]:
    words = clean_text(text).split()
    if not words:
        return []

    chunks: list[TextChunk] = []
    step = max(1, max_words - overlap_words)
    for start in range(0, len(words), step):
        end = min(len(words), start + max_words)
        chunks.append(TextChunk(text=" ".join(words[start:end]), source_index=source_index, chunk_index=len(chunks)))
        if end >= len(words):
            break

    return chunks


def tokenize(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{3,}", value.lower()) if token not in STOP_WORDS}


STOP_WORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "but",
    "can",
    "for",
    "from",
    "has",
    "how",
    "into",
    "not",
    "that",
    "the",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
}


def lexical_rank_chunks(question: str, chunks: Iterable[TextChunk], *, limit: int = 12) -> list[TextChunk]:
    query_terms = tokenize(question)

    def score(chunk: TextChunk) -> float:
        terms = tokenize(chunk.text)
        if not terms:
            return 0.0
        overlap = len(query_terms & terms)
        density = overlap / math.sqrt(len(terms))
        return density + (0.05 if overlap else 0)

    ranked = [TextChunk(text=chunk.text, source_index=chunk.source_index, chunk_index=chunk.chunk_index, score=score(chunk)) for chunk in chunks]
    return sorted(ranked, key=lambda item: item.score, reverse=True)[:limit]


def rerank_chunks(question: str, chunks: list[TextChunk], *, limit: int = 12, model_name: str | None = None) -> list[TextChunk]:
    if not chunks:
        return []

    model_name = model_name or os.getenv("WEB_RERANKER_MODEL") or "cross-encoder/ms-marco-MiniLM-L-6-v2"
    try:
        from sentence_transformers import CrossEncoder

        reranker = CrossEncoder(model_name)
        scores = reranker.predict([(question, chunk.text) for chunk in chunks])
        ranked = [
          TextChunk(text=chunk.text, source_index=chunk.source_index, chunk_index=chunk.chunk_index, score=float(score))
          for chunk, score in zip(chunks, scores)
        ]
        return sorted(ranked, key=lambda item: item.score, reverse=True)[:limit]
    except Exception:
        return lexical_rank_chunks(question, chunks, limit=limit)


def format_ranked_evidence(pages: list[ExtractedPage], chunks: list[TextChunk], *, token_budget: int) -> str:
    budget_chars = max(1000, token_budget * 4)
    parts: list[str] = []
    used_chars = 0

    for chunk in chunks:
        source = next((page.source for page in pages if page.source.index == chunk.source_index), None)
        if not source:
            continue
        block = f"[{source.index}] {source.title}\nURL: {source.url}\nExcerpt: {chunk.text}\n"
        if used_chars + len(block) > budget_chars:
            break
        parts.append(block)
        used_chars += len(block)

    return "\n".join(parts).strip()
