# Token Gen private API bridge

This Cloudflare Worker is the same-origin identity bridge for Token Gen's private conversation, project, and background-job APIs.

The route is deliberately limited to `token-gen.owenonthenet.com/api/private/*`. Cloudflare Access supplies a signed user assertion to the Worker. The Worker strips browser cookies and authorization headers, then forwards only that signed assertion in `X-Token-Gen-Site-Access-JWT` to the Token Gen API, where the existing issuer, audience, signature, expiry, and email checks are applied.

Public chat, image, web-search, monitoring, and integration API traffic does not use this Worker.
