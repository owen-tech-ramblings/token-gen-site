# Token Gen private API bridge

This Cloudflare Worker is the same-origin identity bridge for Token Gen's private conversation, project, background-job, generated artifact and media job APIs.

The route is deliberately limited to `token-gen.owenonthenet.com/api/private/*`. Cloudflare Access supplies a signed user assertion to the Worker. The Worker strips browser cookies and authorization headers, then re-presents only that assertion as the API domain's `CF_Authorization` cookie because both hosts belong to the same Token Gen Access application. The assertion is also forwarded in `X-Token-Gen-Site-Access-JWT` so the Token Gen API can apply its existing issuer, audience, signature, expiry, and email checks to the end user.

Ordinary chat, web-search, monitoring, and integration API traffic retain their existing routes. Project-media chat uses `/api/private/projects/chat/stream`. Agent chat carrying trusted artifact context uses `/api/private/chat/stream`; both forward the verified Access assertion. Image fallback uses `/api/private/image/generations|edits|upscale` only when no private job submission has occurred. A failed or ambiguous submission never falls back to another transport.

The additive `artifacts` mapping supports owner-scoped catalogue pages and
metadata/content reads, with HEAD and Range forwarded unchanged. Download URLs
come from validated artifact UUIDs, never provider URLs or physical paths. The
Worker streams upstream responses; native ZIP masters are browser downloads
and are not buffered by site JavaScript. `tts` and `video` mappings consume
fixed authenticated Agent job poll URLs alongside existing `image` and `3d`
polling. Every upstream request uses the same canonical API origin, stripped
credentials, signed Access assertion and manual redirect rule.

Deploy the reviewed bridge before adopting these resources in the site and
verify API PR #63's `capabilities.artifacts.agent_parent_context` contract.
Retained image/3D/Agent work first saves an assistant placeholder and passes
matching context plus a stable Idempotency-Key. Don't-save requests pass only
temporary retention; the API still durably admits paid work before submission.
Provider completion can precede `archive_state=saved`; pending capture is shown
separately. Catalogue refresh and downloads perform no generation.

The 3D panel maps `/api/private/3d/*` to `/api/3d/*`, retaining Idempotency-Key
and Range headers. Downloads and saved jobs use the same signed owner identity.
The API retains its separate privileged monitoring authorisation. Deploy the
reviewed Worker with the existing Wrangler configuration; record its previous
deployment version and use `wrangler rollback <version-id>` if post-checks fail.
