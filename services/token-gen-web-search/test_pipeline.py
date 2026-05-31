import unittest

from pipeline import FetchSettings, chunk_text, lexical_rank_chunks, normalize_fetch_settings


class PipelineTests(unittest.TestCase):
    def test_normalize_fetch_settings_defaults_to_direct(self):
        settings = normalize_fetch_settings({})

        self.assertEqual(settings, FetchSettings(mode="direct", proxy=None, timeout_seconds=20.0))

    def test_normalize_fetch_settings_uses_tor_proxy_default(self):
        settings = normalize_fetch_settings({"mode": "tor"})

        self.assertEqual(settings.mode, "tor")
        self.assertEqual(settings.proxy, "socks5h://127.0.0.1:9050")

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


if __name__ == "__main__":
    unittest.main()
