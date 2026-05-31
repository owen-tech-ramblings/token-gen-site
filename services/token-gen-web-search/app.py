from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from pipeline import (
    ExtractedPage,
    SearchResult,
    chunk_text,
    extract_main_text,
    format_ranked_evidence,
    normalize_fetch_settings,
    rerank_chunks,
)


app = FastAPI(title="Token-Gen Web Search Service", version="0.1.0")


class SearchConfig(BaseModel):
    provider: str = "brave"
    max_results: int = Field(default=5, ge=1, le=10)


class FetchConfig(BaseModel):
    mode: str = "direct"
    proxy: str | None = None
    timeout_seconds: float | None = None


class CompactionConfig(BaseModel):
    context_token_budget: int = Field(default=2500, ge=500, le=8000)


class VllmConfig(BaseModel):
    base_url: str
    api_key: str | None = None
    model: str


class WebSearchRequest(BaseModel):
    question: str = Field(min_length=1)
    search: SearchConfig = SearchConfig()
    fetch: FetchConfig = FetchConfig()
    compaction: CompactionConfig = CompactionConfig()
    vllm: VllmConfig


def brave_headers() -> dict[str, str]:
    key = os.getenv("BRAVE_SEARCH_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="BRAVE_SEARCH_API_KEY is not configured.")
    return {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
    }


async def brave_search(question: str, *, max_results: int) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers=brave_headers(),
            params={
                "q": question,
                "count": max_results,
                "safesearch": "moderate",
                "text_decorations": "false",
            },
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Brave Search returned {response.status_code}.")

    data = response.json()
    results = data.get("web", {}).get("results", [])[:max_results]

    parsed: list[SearchResult] = []
    for index, item in enumerate(results):
        if not item.get("url"):
            continue

        extra_snippets = item.get("extra_snippets") or []
        parsed.append(
            SearchResult(
                index=index + 1,
                title=item.get("title") or "Untitled",
                url=item.get("url") or "",
                snippet=item.get("description") or (extra_snippets[0] if extra_snippets else ""),
            )
        )

    return parsed


async def fetch_page(result: SearchResult, fetch_config: FetchConfig) -> ExtractedPage:
    settings = normalize_fetch_settings(fetch_config.model_dump(exclude_none=True))
    transport_kwargs: dict[str, Any] = {}
    if settings.proxy:
        transport_kwargs["proxy"] = settings.proxy

    try:
        async with httpx.AsyncClient(
            timeout=settings.timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": os.getenv("WEB_FETCH_USER_AGENT", "Token-Gen-WebContext/0.1")},
            **transport_kwargs,
        ) as client:
            response = await client.get(result.url)
            response.raise_for_status()

        text, method = extract_main_text(response.text)
        return ExtractedPage(source=result, text=text or result.snippet, fetched=True, extraction_method=method)
    except Exception as error:
        return ExtractedPage(
            source=result,
            text=result.snippet,
            fetched=False,
            extraction_method="brave-snippet",
            error=str(error),
        )


async def compact_with_vllm(request: WebSearchRequest, evidence: str) -> str:
    if not evidence.strip():
        return ""

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if request.vllm.api_key:
        headers["Authorization"] = f"Bearer {request.vllm.api_key}"

    prompt = (
        "Compress the evidence for a later answer by a local model. "
        "Keep only facts relevant to the user's question. Preserve source numbers like [1]. "
        "Do not add facts that are not in the evidence.\n\n"
        f"Question: {request.question}\n\nEvidence:\n{evidence}"
    )

    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(
            f"{request.vllm.base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json={
                "model": request.vllm.model,
                "messages": [
                    {"role": "system", "content": "You compact web evidence faithfully for local retrieval augmented generation."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
                "max_tokens": min(1200, max(256, request.compaction.context_token_budget // 2)),
                "stream": False,
            },
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"vLLM evidence compaction returned {response.status_code}.")

    data = response.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip() or evidence


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "brave_configured": bool(os.getenv("BRAVE_SEARCH_API_KEY")),
        "fetch_mode": os.getenv("WEB_FETCH_MODE", "direct"),
    }


@app.post("/search")
async def search(request: WebSearchRequest) -> dict[str, Any]:
    results = await brave_search(request.question, max_results=request.search.max_results)
    pages = [await fetch_page(result, request.fetch) for result in results]

    chunks = []
    for page in pages:
        chunks.extend(chunk_text(page.text, source_index=page.source.index))

    ranked = rerank_chunks(request.question, chunks, limit=12)
    evidence = format_ranked_evidence(pages, ranked, token_budget=request.compaction.context_token_budget)
    compacted = await compact_with_vllm(request, evidence)
    settings = normalize_fetch_settings(request.fetch.model_dump(exclude_none=True))

    return {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "query": request.question,
        "fetch_mode": settings.mode,
        "context": compacted,
        "sources": [
            {
                "index": page.source.index,
                "title": page.source.title,
                "url": page.source.url,
                "fetched": page.fetched,
                "extraction_method": page.extraction_method,
                "score": max((chunk.score for chunk in ranked if chunk.source_index == page.source.index), default=0),
                "error": page.error,
            }
            for page in pages
        ],
        "warnings": [
            "Brave receives the search query under your Brave API key.",
            *(["Destination pages were fetched through a proxy/Tor setting." if settings.proxy else "Destination pages were fetched directly by this service."]),
        ],
    }
