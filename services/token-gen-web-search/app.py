from __future__ import annotations

import os
from typing import Any
from urllib.parse import parse_qs, urlparse
from datetime import datetime

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
    time_range: str | None = Field(default="year")
    tavily_api_key: str | None = Field(default=None, max_length=512)


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


class TavilyPlanExhausted(Exception):
    pass


def configured_tavily_api_key() -> str | None:
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

    return None


def tavily_api_key() -> str:
    key = configured_tavily_api_key()
    if key:
        return key
    raise HTTPException(status_code=503, detail="TAVILY_API_KEY is not configured.")


def tavily_headers(api_key: str) -> dict[str, str]:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }


def tavily_configured() -> bool:
    try:
        return bool(tavily_api_key())
    except HTTPException:
        return False


def parse_result_date(value: Any) -> datetime:
    if not value:
        return datetime.min
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text[:10] if len(text) >= 10 else text)
    except ValueError:
        return datetime.min


def result_date(item: dict[str, Any]) -> str | None:
    for key in ("published_date", "publishedDate", "date", "last_updated", "lastUpdated"):
        if item.get(key):
            return str(item[key])
    return None


async def tavily_search(
    question: str,
    *,
    api_key: str,
    max_results: int,
    time_range: str | None,
) -> list[SearchResult]:
    allowed_time_ranges = {"day", "week", "month", "year", "d", "w", "m", "y"}
    payload: dict[str, Any] = {
        "query": question,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": False,
        "include_usage": True,
    }
    if time_range in allowed_time_ranges:
        payload["time_range"] = time_range

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.tavily.com/search",
            headers=tavily_headers(api_key),
            json=payload,
        )

    if response.status_code == 432:
        raise TavilyPlanExhausted("Tavily plan limit exceeded.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Tavily Search returned {response.status_code}.")

    data = response.json()
    results = sorted(
        data.get("results", [])[:max_results],
        key=lambda item: parse_result_date(result_date(item)),
        reverse=True,
    )

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
                published_date=result_date(item),
            )
        )

    return parsed


def searxng_base_url() -> str:
    return (os.getenv("SEARXNG_BASE_URL") or "http://127.0.0.1:8888").rstrip("/")


def searxng_configured() -> bool:
    return bool(searxng_base_url())


async def searxng_available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{searxng_base_url()}/")
        return response.status_code < 500
    except Exception:
        return False


async def searxng_search(question: str, *, max_results: int, time_range: str | None) -> list[SearchResult]:
    normalized_time_range = {
        "d": "day",
        "w": "week",
        "m": "month",
        "y": "year",
    }.get(time_range or "", time_range)
    params: dict[str, Any] = {
        "q": question,
        "format": "json",
        "language": "all",
        "safesearch": 1,
    }
    if normalized_time_range in {"day", "month", "year"}:
        params["time_range"] = normalized_time_range

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{searxng_base_url()}/search", params=params)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"SearXNG returned {response.status_code}.")

    data = response.json()
    parsed: list[SearchResult] = []
    for item in data.get("results", [])[:max_results]:
        if not item.get("url"):
            continue
        parsed.append(
            SearchResult(
                index=len(parsed) + 1,
                title=item.get("title") or "Untitled",
                url=item.get("url") or "",
                snippet=item.get("content") or "",
                published_date=result_date(item),
            )
        )
    return parsed


async def search_with_fallback(question: str, search_config: SearchConfig) -> tuple[list[SearchResult], dict[str, Any]]:
    candidates: list[tuple[str, str]] = []
    user_key = (search_config.tavily_api_key or "").strip()
    site_key = configured_tavily_api_key() or ""
    if user_key:
        candidates.append(("user", user_key))
    if site_key and site_key != user_key:
        candidates.append(("site", site_key))

    exhausted_key_sources: list[str] = []
    for key_source, api_key in candidates:
        try:
            results = await tavily_search(
                question,
                api_key=api_key,
                max_results=search_config.max_results,
                time_range=search_config.time_range,
            )
            return results, {
                "provider": "tavily",
                "key_source": key_source,
                "fallback": False,
            }
        except TavilyPlanExhausted:
            exhausted_key_sources.append(key_source)

    fallback_reason = "tavily_plan_exhausted" if exhausted_key_sources else "tavily_unconfigured"
    results = await searxng_search(
        question,
        max_results=search_config.max_results,
        time_range=search_config.time_range,
    )
    return results, {
        "provider": "searxng",
        "mode": "balanced",
        "fallback": True,
        "fallback_reason": fallback_reason,
        "exhausted_key_sources": exhausted_key_sources,
    }


async def fetch_page(result: SearchResult, fetch_config: FetchConfig) -> ExtractedPage:
    try:
        settings = normalize_fetch_settings(fetch_config.model_dump(exclude_none=True))
    except ValueError as error:
        return ExtractedPage(
            source=result,
            text=result.snippet,
            fetched=False,
            extraction_method="search-snippet",
            error=str(error),
        )
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
            extraction_method="search-snippet",
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
    tavily_ready = tavily_configured()
    searxng_ready = await searxng_available()
    return {
        "ok": tavily_ready or searxng_ready,
        "available": tavily_ready or searxng_ready,
        "provider": "tavily",
        "provider_chain": ["tavily", "searxng"],
        "tavily_configured": tavily_ready,
        "searxng_configured": searxng_configured(),
        "searxng_available": searxng_ready,
        "searxng_mode": "balanced",
        "fetch_mode": os.getenv("WEB_FETCH_MODE", "direct"),
        "proxy_configured": bool(os.getenv("WEB_FETCH_PROXY")),
        "tor_proxy": "socks5h://127.0.0.1:9050",
    }


@app.post("/search")
async def search(request: WebSearchRequest) -> dict[str, Any]:
    results, search_route = await search_with_fallback(request.question, request.search)
    pages = [await fetch_page(result, request.fetch) for result in results]

    chunks = []
    for page in pages:
        chunks.extend(chunk_text(page.text, source_index=page.source.index))

    ranked = rerank_chunks(request.question, chunks, limit=12)
    evidence = format_ranked_evidence(pages, ranked, token_budget=request.compaction.context_token_budget)
    compacted = await compact_with_vllm(request, evidence)
    try:
        settings = normalize_fetch_settings(request.fetch.model_dump(exclude_none=True))
    except ValueError:
        settings = None

    return {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "query": request.question,
        "provider": search_route["provider"],
        "search_route": search_route,
        "fetch_mode": settings.mode if settings else request.fetch.mode,
        "context": compacted,
        "sources": [
            {
                "index": page.source.index,
                "title": page.source.title,
                "url": page.source.url,
                "published_date": page.source.published_date,
                "fetched": page.fetched,
                "extraction_method": page.extraction_method,
                "score": max((chunk.score for chunk in ranked if chunk.source_index == page.source.index), default=0),
                "error": page.error,
            }
            for page in pages
        ],
        "warnings": [
            *(
                ["Tavily receives the search query under the selected Tavily API key."]
                if search_route["provider"] == "tavily"
                else ["Tavily was exhausted or unavailable; balanced SearXNG performed the search directly."]
            ),
            *(["Destination pages were fetched through a proxy/Tor setting." if settings and settings.proxy else "Destination pages were fetched directly by this service."]),
        ],
    }
