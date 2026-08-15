# Token Gen private API bridge

This Cloudflare Worker is the same-origin identity bridge for Token Gen's private conversation, project, and background-job APIs.

The route is deliberately limited to `token-gen.owenonthenet.com/api/private/*`. Cloudflare Access supplies a signed user assertion to the Worker. The Worker strips browser cookies and authorization headers, then re-presents only that assertion as the API domain's `CF_Authorization` cookie because both hosts belong to the same Token Gen Access application. The assertion is also forwarded in `X-Token-Gen-Site-Access-JWT` so the Token Gen API can apply its existing issuer, audience, signature, expiry, and email checks to the end user.

Public chat, image, web-search, monitoring, and integration API traffic does not use this Worker. Project-media chat is the sole chat exception: the site sends it to `/api/private/projects/chat/stream`, which stays within the existing `projects` mapping and forwards the verified Access assertion to `/api/projects/chat/stream`.
