# Token Gen private API bridge

This Cloudflare Worker is the same-origin identity bridge for Token Gen's private conversation, project, and background-job APIs.

The route is deliberately limited to `token-gen.owenonthenet.com/api/private/*`. Cloudflare Access supplies a signed user assertion to the Worker. The Worker strips browser cookies and authorization headers, then re-presents only that assertion as the API domain's `CF_Authorization` cookie because both hosts belong to the same Token Gen Access application. The assertion is also forwarded in `X-Token-Gen-Site-Access-JWT` so the Token Gen API can apply its existing issuer, audience, signature, expiry, and email checks to the end user.

The same Worker also serves the exact owner route
`token-gen.owenonthenet.com/api/private/access`. Its dedicated Cloudflare
Access application admits only `jesse@owenonthenet.com`; the Worker verifies
that signed assertion again before reading or changing the main Token Gen
Access policy. Cloudflare management calls use the server-side
`CLOUDFLARE_API_TOKEN` secret. Never put that token in browser JavaScript or a
Wrangler config file.

Public chat, image, web-search, monitoring, and integration API traffic does not use this Worker.
