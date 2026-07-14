# Vampire Survival cloud profile service

This CommonJS module adds a path-scoped, local-disk cloud profile API to the
active Token Gen Node gateway. The dedicated public hostname is
`vampire-save.owenonthenet.com`; the existing Token Gen API hostname remains
on its established Python/gateway route.

## Runtime contract

- Cloudflare Access protects `/api/vampire-profile` and its child paths.
- The gateway verifies the `cf-access-jwt-assertion` RS256 signature, issuer,
  audience, expiry, and identity before handling any profile operation.
- The mailbox address is HMAC-hashed with a generated server-only secret. It
  is never written to profile files, responses, or logs.
- `GET` returns an `ETag`; `PUT` requires `If-Match` and `Idempotency-Key`;
  `DELETE` requires the latest `If-Match` value.
- New profiles use `If-Match: *`. Existing profiles require the exact current
  ETag. Conflicts return HTTP 412 with the current record for deliberate client
  resolution.

The runtime gateway requires:

```js
const vampireProfile = require("./vampire-profile-sync.cjs").createVampireProfileHandler();
```

Its request handler must construct the request URL before its generic OPTIONS
branch, then delegate matching paths:

```js
if (vampireProfile.matches(url.pathname)) {
  vampireProfile.handle(req, res, url);
  return;
}
```

Runtime environment:

- `VAMPIRE_PROFILE_ACCESS_TEAM_DOMAIN=zen-free.cloudflareaccess.com`
- `VAMPIRE_PROFILE_ACCESS_AUD=<audience from the path-scoped Access app>`
- `VAMPIRE_PROFILE_STORE_DIR` is optional; the default is a mode-0700 folder
  under the service user's local data directory.

The browser remains local-first. This service is never on the gameplay start,
run completion, or local-save critical path.
