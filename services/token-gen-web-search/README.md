# Token-Gen Web Search Service

This optional service augments the Token-Gen vLLM chat UI with Tavily Search context. It does not answer questions itself. It searches, fetches, extracts, ranks, and asks the configured Token-Gen vLLM endpoint to compact evidence for the final local chat answer.

## Privacy Model

- Tavily receives the search query through your Tavily API key.
- The app does not log queries.
- Destination webpages see either the service IP (`direct`) or the configured proxy/Tor exit (`tor` or `proxy`).
- Use `socks5h://` for Tor so DNS resolution goes through Tor too.
- `sentence-transformers` is intentionally not installed by default. The service falls back to lexical ranking to avoid pulling a heavy Torch/CUDA stack.

## Setup

```powershell
cd services\token-gen-web-search
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:TAVILY_API_KEY="..."
$env:WEB_FETCH_MODE="tor"
$env:WEB_FETCH_PROXY="socks5h://127.0.0.1:9050"
uvicorn app:app --host 127.0.0.1 --port 8767
```

For direct testing without Tor:

```powershell
$env:WEB_FETCH_MODE="direct"
uvicorn app:app --host 127.0.0.1 --port 8767
```

Configure the Token Gen API proxy with:

```env
WEB_SEARCH_SERVICE_URL=http://127.0.0.1:8767
```
