# Token Gen Source Of Truth

Last updated: 2026-08-16

This file is the current routing, source, and release authority for Token Gen.
Read it before changing the site, API, Cloudflare routing, bot integration, or
generated client helpers.

## Canonical source and release contract

- Site source: `/home/zenfree/token-gen-site`, remote
  `https://github.com/owen-tech-ramblings/token-gen-site.git`.
- API source and runtime: `/home/zenfree/server-details-api`, remote
  `https://github.com/owen-tech-ramblings/token-gen-api.git`.
- Both repositories develop directly on `dev`, run their complete check, then
  fast-forward `master`. Stable rest has only `dev` and `master`, with local
  `dev`, local `master`, `origin/dev`, and `origin/master` equal and clean.
- The API deploys locally through the self-contained
  `bash scripts/install_token_gen_api.sh --deploy` transaction. The site
  deploys from `master` through GitHub Pages.
- Lil Zen, OpenClaw, SSH, a PC-side gateway, and a separate control plane are
  not Token Gen source, promotion, runtime, or release dependencies.

## Cycle 4B product baseline

- The current four-way-aligned API and site tips are the golden source. The API
  serves exactly one loopback-only `Qwen-Qwen3.8-27B` through vLLM 0.26 with
  FP8 weights, BF16 activations/KV, 524,288 context, `xhigh` reasoning and no
  offload, secondary model or MTP fallback.
- Private Project videos accept resumable encrypted MP4/WebM/MOV/MKV uploads up
  to 4 GiB and 30 minutes. One durable job processes one to six five-minute
  segments sequentially. Sampling is server-owned at 2 fps, at most 768 frames
  and 12,288 video tokens per segment; local CPU INT8 faster-whisper handles
  audio.
- The browser keeps video bytes and opaque references in current-page memory,
  renders upload/job progress and timestamp citations, and exposes no FPS or
  frame controls. Failed video jobs use the idempotent completion route.
- `/api/agent.json` and `/.well-known/token-gen-api.json` are the authoritative
  machine contract for limits, sampling, routes, job kind and stable errors.
  Clients including Lil Zen must read that additive contract instead of
  copying the policy.
- Cycle 4A image ordering, scanned-PDF/chart project intelligence, signed visual
  evidence and private follow-up behavior remain supported.
- Release proof passed exact image and five-minute video token parity and one
  complete 1,800-second/six-segment project job with signed-range follow-up and
  full private cleanup. The site aggregate passed 119 tests plus its contract.

## Live surfaces

- Website: `https://token-gen.owenonthenet.com`
- Public API: `https://token-gen-api.owenonthenet.com`
- API contract: `https://token-gen-api.owenonthenet.com/api/agent.json`
- Well-known contract:
  `https://token-gen-api.owenonthenet.com/.well-known/token-gen-api.json`

Production chat, projects, and web search run on the Token Gen server. The API
uses its pinned loopback-only SearXNG service; the static-site repository and a
development workstation are not production API, search, Tor, or page-fetch
dependencies. Managed API runtime files must be changed only through the
canonical repository and its installer.

## Historical integrations (non-authoritative)

Older records refer to a Lil Zen/OpenClaw control plane, a PC-side Node gateway,
and Windows mirrors. Those entries are retained in dated history only. They do
not identify a current authoring root, release transport, fallback, or runtime
dependency. The checked-in `services/` examples are also historical reference
material and are not a deployment source.

## Required preflight

Before changing API behaviour:

```bash
git -C /home/zenfree/server-details-api rev-parse --show-toplevel
git -C /home/zenfree/server-details-api remote -v
git -C /home/zenfree/server-details-api status --short
bash /home/zenfree/server-details-api/scripts/run_complete_checks.sh
```

Before changing the site:

```bash
git -C /home/zenfree/token-gen-site rev-parse --show-toplevel
git -C /home/zenfree/token-gen-site remote -v
git -C /home/zenfree/token-gen-site status --short
cd /home/zenfree/token-gen-site && npm test
```

For read-only integration verification, use the public API rather than a local
gateway:

```bash
curl -fsS https://token-gen-api.owenonthenet.com/api/agent.json
curl -fsS https://token-gen-api.owenonthenet.com/api/web-search/health
```

## Safety rules

- Never put `SERVER_DETAILS_TOKEN`, `TOKEN_GEN_BOT_API_KEY`, Access assertions,
  or another private token in browser JavaScript or tracked evidence.
- Do not work around missing API behaviour with frontend fallback data; fix or
  document the canonical API route.
- Do not change Cloudflare tunnel, DNS, Worker, or Access state without proving
  which service currently serves the hostname and having explicit authority.
- Verify API changes against the public hostname, not only localhost or a
  private network route.
- vLLM stays private; public access goes through the canonical API.

## Required public API routes

- `/api/health`
- `/api/public-status`
- `/api/agent.json`
- `/.well-known/token-gen-api.json`
- `/api/chat/models`
- `/api/chat/completions`
- `/api/chat/stream`
- `/api/web-search/health`

## Required protected bot routes

- `/api/discord-auth-check`
- `/api/discord/chat/models`
- `/api/discord/chat/completions`
- `/api/discord/chat/stream`

These routes require `Authorization: Bearer <TOKEN_GEN_BOT_API_KEY>`. The
credential remains runtime-only and must never be printed or committed.
