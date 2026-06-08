# Token Gen Site Architecture Design

## Goal

`token-gen.owenonthenet.com` is a protected website for selected users. It consumes API data from the token-gen server and provides three primary destinations: Monitor, Chat, and Games.

## Access Control

Cloudflare Access protects `token-gen.owenonthenet.com/*` with Google authentication. The initial allowed emails are:

- `jesse@owenonthenet.com`
- `li-zen@owenonthenet.com`
- `gusulei@gmail.com`

The allowlist must live in Cloudflare Access policy/configuration so more email addresses can be added later without changing website JavaScript.

## Architecture

The static website is only a consumer. It must not own API production, API secrets, token-gen telemetry collection, vLLM routing, or web-search service runtime.

`https://token-gen-api.owenonthenet.com` is the API front door owned by the token-gen server. The current live API is the Python Server Details API on token-gen. The dormant PC-side Node gateway is not part of the active architecture unless a future feature explicitly reintroduces it.

## Website Pages

The homepage is a polished app launcher with first-screen access to:

- Monitor
- Chat
- Games

Games initially includes the existing vampire survivor game and should allow more games later.

The monitor page shows all fields available from the public API response. It must not invent fallback data. If the API is unavailable or malformed, it shows a clear API error state.

The chat page uses API model discovery. It must not silently swap to an invalid fallback model when the API is broken. If model discovery fails, chat is unavailable until the API works.

Web search is disabled when the API reports `tavily_configured: false` or unavailable. The UI should say that web search is not configured, not that the whole Token Gen API needs an update.

## Data Rules

Public browser JavaScript can call public-safe API endpoints only. Private endpoints that require `SERVER_DETAILS_TOKEN` remain unavailable to public browser JavaScript until there is a server-side authenticated admin path.

The monitor should render every field that exists in `/api/public-status`, including nested GPU, vLLM, counters, rates, services, memory, load, timestamp, and host data. Fields that only exist in authenticated endpoints are not shown as blank public fields.

## Verification

Before release:

- Cloudflare Access policy protects the site for the three allowed emails.
- Homepage loads after Access login and links to Monitor, Chat, and Games.
- Monitor renders live `/api/public-status` data.
- Monitor shows an error if `/api/public-status` fails.
- Chat model discovery uses `/api/chat/models`.
- Chat does not use fallback model data when the API is broken.
- Games launcher links to the existing vampire survivor game.
