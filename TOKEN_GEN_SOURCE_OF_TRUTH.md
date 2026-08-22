# Token Gen Source Of Truth

Last updated: 2026-08-22

This file is the current routing, source, and release authority for Token Gen.
Read it before changing the site, API, Cloudflare routing, bot integration, or
generated client helpers.

## Canonical source and release contract

- Site source: `/home/jesse/.openclaw/workspace/token-gen-site-pages`, remote
  `https://github.com/owen-tech-ramblings/token-gen-site.git`.
- API source: `/home/jesse/.openclaw/workspace/token-gen-api`, remote
  `https://github.com/owen-tech-ramblings/token-gen-api.git`.
- Development uses a receipt-bound managed worktree from an aligned `dev` and
  `master`. The reviewed feature merges to `master`; the one master-only CI run
  contains no more than ten change-specific checks. A successful release
  aligns local and origin `dev` to the deployed `master` and removes the
  temporary branch.
- The API runtime target is `/home/zenfree/server-details-api` on `token-gen`;
  it is never an authoring source. API activation uses the repository's
  rollback-protected release command. The site uses the registered GitHub
  Pages cutover from the exact reviewed `master` commit.
- The Lil Zen control plane provides release admission and exact-source
  reconciliation. Token Gen chat, vLLM and web search still run entirely on
  the Token Gen server and never depend on a developer PC relay.

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

Older records that name `/home/zenfree` as an authoring checkout, direct `dev`
development, a PC-side Node gateway, or a Windows mirror are retained only as
dated history. They do not override the current roots or release path above.
The checked-in `services/` examples are reference material, not a deployment
source.

## Required preflight

Before changing API behaviour:

```bash
git -C /home/jesse/.openclaw/workspace/token-gen-api rev-parse --show-toplevel
git -C /home/jesse/.openclaw/workspace/token-gen-api remote -v
git -C /home/jesse/.openclaw/workspace/token-gen-api status --short
# Run only the receipt-selected, change-specific checks in the managed worktree.
```

Before changing the site:

```bash
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages rev-parse --show-toplevel
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages remote -v
git -C /home/jesse/.openclaw/workspace/token-gen-site-pages status --short
# Run only the receipt-selected, change-specific checks in the managed worktree.
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
