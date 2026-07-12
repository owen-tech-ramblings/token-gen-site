import unittest
from unittest.mock import AsyncMock, patch

import app as web_app
from pipeline import FetchSettings, chunk_text, lexical_rank_chunks, normalize_fetch_settings
from pipeline import SearchResult


class PipelineTests(unittest.TestCase):
    def test_normalize_fetch_settings_defaults_to_direct(self):
        settings = normalize_fetch_settings({})

        self.assertEqual(settings, FetchSettings(mode="direct", proxy=None, timeout_seconds=20.0))

    def test_normalize_fetch_settings_uses_tor_proxy_default(self):
        settings = normalize_fetch_settings({"mode": "tor"})

        self.assertEqual(settings.mode, "tor")
        self.assertEqual(settings.proxy, "socks5h://127.0.0.1:9050")

    def test_normalize_fetch_settings_requires_proxy_url_for_proxy_mode(self):
        with self.assertRaises(ValueError):
            normalize_fetch_settings({"mode": "proxy"})

    def test_chunk_text_splits_with_overlap(self):
        text = " ".join(f"token{i}" for i in range(120))
        chunks = chunk_text(text, max_words=50, overlap_words=10)

        self.assertEqual(len(chunks), 3)
        self.assertIn("token0", chunks[0].text)
        self.assertIn("token40", chunks[1].text)
        self.assertEqual(chunks[0].source_index, 0)

    def test_lexical_rank_chunks_prefers_query_terms(self):
        chunks = chunk_text(
            "alpha beta gamma. " * 20 + "tor privacy tavily search socks proxy. " * 20,
            max_words=30,
            overlap_words=0,
        )
        ranked = lexical_rank_chunks("How does Tor proxy protect Tavily search fetching?", chunks, limit=2)

        self.assertGreaterEqual(ranked[0].score, ranked[1].score)
        self.assertIn("tor", ranked[0].text.lower())


class SearchFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_user_tavily_key_is_used_before_site_key(self):
        result = SearchResult(index=1, title="Result", url="https://example.com", snippet="Evidence")
        tavily = AsyncMock(return_value=[result])
        searxng = AsyncMock()

        with (
            patch.object(web_app, "configured_tavily_api_key", return_value="site-key"),
            patch.object(web_app, "tavily_search", tavily),
            patch.object(web_app, "searxng_search", searxng),
        ):
            results, route = await web_app.search_with_fallback(
                "latest token gen status",
                web_app.SearchConfig(tavily_api_key="user-key"),
            )

        self.assertEqual(results, [result])
        self.assertEqual(route, {"provider": "tavily", "key_source": "user", "fallback": False})
        self.assertEqual(tavily.await_args.kwargs["api_key"], "user-key")
        searxng.assert_not_awaited()

    async def test_searxng_is_used_after_user_and_site_tavily_keys_are_exhausted(self):
        result = SearchResult(index=1, title="Fallback", url="https://example.org", snippet="Balanced evidence")
        tavily = AsyncMock(side_effect=[
            web_app.TavilyPlanExhausted("user exhausted"),
            web_app.TavilyPlanExhausted("site exhausted"),
        ])
        searxng = AsyncMock(return_value=[result])

        with (
            patch.object(web_app, "configured_tavily_api_key", return_value="site-key"),
            patch.object(web_app, "tavily_search", tavily),
            patch.object(web_app, "searxng_search", searxng),
        ):
            results, route = await web_app.search_with_fallback(
                "latest token gen status",
                web_app.SearchConfig(tavily_api_key="user-key", max_results=4, time_range="month"),
            )

        self.assertEqual(results, [result])
        self.assertEqual(tavily.await_count, 2)
        self.assertEqual([call.kwargs["api_key"] for call in tavily.await_args_list], ["user-key", "site-key"])
        searxng.assert_awaited_once_with("latest token gen status", max_results=4, time_range="month")
        self.assertEqual(route["provider"], "searxng")
        self.assertEqual(route["fallback_reason"], "tavily_plan_exhausted")
        self.assertEqual(route["exhausted_key_sources"], ["user", "site"])

    async def test_searxng_is_used_when_no_tavily_key_is_configured(self):
        result = SearchResult(index=1, title="Fallback", url="https://example.net", snippet="Evidence")
        tavily = AsyncMock()
        searxng = AsyncMock(return_value=[result])

        with (
            patch.object(web_app, "configured_tavily_api_key", return_value=None),
            patch.object(web_app, "tavily_search", tavily),
            patch.object(web_app, "searxng_search", searxng),
        ):
            results, route = await web_app.search_with_fallback(
                "latest token gen status",
                web_app.SearchConfig(),
            )

        self.assertEqual(results, [result])
        tavily.assert_not_awaited()
        searxng.assert_awaited_once()
        self.assertEqual(route["fallback_reason"], "tavily_unconfigured")


if __name__ == "__main__":
    unittest.main()
