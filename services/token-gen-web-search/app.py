from __future__ import annotations

import os
from typing import Any
from urllib.parse import parse_qs, urlparse

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
    provider: str = "tavily"
    max_results: int = Field(default=5, ge=1, le=10)


class FetchConfig(BaseModel):
    mode: str = "direct"
    proxy: str | None = None
    timeout_seconds: float | None = None


class CompactionConfig(BaseModel):
    context_token_budget: int = Field(default=10000, ge=500, le=10000)


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


def tavily_api_key() -> str:
    key = os.getenv("TAVILY_API_KEY") or os.getenv("TAVILY_SEARCH_API_KEY")
    if key:
        return key

    mcp_url = os.getenv("TAVILY_MCP_URL") or os.getenv("TAVILY_MCP")
    if mcp_url:
        parsed = urlparse(mcp_url)
        query = parse_qs(parsed.query)
        key = (query.get("tavilyApiKey") or query.get("apiKey") or [""])[0]
        if key:
            return key

    raise HTTPException(status_code=503, detail="TAVILY_API_KEY is not configured.")


def tavily_headers() -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {tavily_api_key()}",
    }


def tavily_configured() -> bool:
    try:
        return bool(tavily_api_key())
    except HTTPException:
        return False


async def tavily_search(question: str, *, max_results: int) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.tavily.com/search",
            headers=tavily_headers(),
            json={
                "query": question,
                "search_depth": "basic",
                "max_results": max_results,
                "include_answer": False,
                "include_raw_content": False,
                "include_usage": True,
            },
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Tavily Search returned {response.status_code}.")

    data = response.json()
    results = data.get("results", [])[:max_results]

    parsed: list[SearchResult] = []
    for index, item in enumerate(results):
        if not item.get("url"):
            continue

        parsed.append(
            SearchResult(
                index=index + 1,
                title=item.get("title") or "Untitled",
                url=item.get("url") or "",
                snippet=item.get("content") or item.get("raw_content") or "",
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
            extraction_method="tavily-snippet",
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
    message = data.get("choices", [{}])[0].get("message", {}) or {}
    content = message.get("content") or ""
    return str(content).strip() or evidence


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": "tavily",
        "tavily_configured": tavily_configured(),
        "fetch_mode": os.getenv("WEB_FETCH_MODE", "direct"),
    }


@app.post("/search")
async def search(request: WebSearchRequest) -> dict[str, Any]:
    results = await tavily_search(request.question, max_results=request.search.max_results)
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
            "Tavily receives the search query under your Tavily API key.",
            *(["Destination pages were fetched through a proxy/Tor setting." if settings.proxy else "Destination pages were fetched directly by this service."]),
        ],
    }
