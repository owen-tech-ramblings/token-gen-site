"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");

const {
  MAX_PROFILE_BYTES,
  createAccessVerifier,
  createProfileStore,
  createVampireProfileHandler,
} = require("../services/vampire-profile-sync/vampire-profile-sync.cjs");

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vampire-profile-sync-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function signAssertion(privateKey, kid, claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT", kid })}.${encode(claims)}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

function handlerRequest(handler, options = {}) {
  const req = new PassThrough();
  req.method = options.method || "GET";
  req.url = options.url || "/api/vampire-profile";
  req.headers = { origin: "https://token-gen.owenonthenet.com", "cf-access-jwt-assertion": "test-assertion", ...(options.headers || {}) };
  return new Promise((resolve, reject) => {
    let status = 0;
    let headers = {};
    const chunks = [];
    const res = {
      writeHead(nextStatus, nextHeaders) { status = nextStatus; headers = nextHeaders || {}; },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve({ status, headers, raw, body: raw ? JSON.parse(raw) : null });
      },
    };
    handler.handle(req, res, new URL(req.url, "https://vampire-save.owenonthenet.com")).catch(reject);
    req.end(options.body || "");
  });
}

test("Access identity requires a valid signature, issuer, audience, and lifetime", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: "jwk" });
  publicJwk.kid = "test-key";
  const nowMs = Date.parse("2026-07-15T04:00:00Z");
  const verifier = createAccessVerifier({
    teamDomain: "zen-free.cloudflareaccess.com",
    audience: "vampire-audience",
    now: () => nowMs,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        keys: [publicJwk],
        public_certs: [{ kid: "test-key", cert: "ignored-because-the-JWK-is-present" }],
        public_cert: { kid: "test-key", cert: "ignored-because-the-JWK-is-present" },
      }),
    }),
  });
  const baseClaims = {
    iss: "https://zen-free.cloudflareaccess.com",
    aud: ["vampire-audience"],
    exp: Math.floor(nowMs / 1000) + 300,
    email: "Player@Example.com",
    sub: "access-user-1",
  };

  assert.deepEqual(await verifier(signAssertion(privateKey, "test-key", baseClaims)), {
    email: "player@example.com",
    subject: "access-user-1",
  });

  const forged = signAssertion(crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey, "test-key", baseClaims);
  await assert.rejects(() => verifier(forged), /signature/);
  await assert.rejects(() => verifier(signAssertion(privateKey, "test-key", { ...baseClaims, aud: "wrong" })), /audience/);
  await assert.rejects(() => verifier(signAssertion(privateKey, "test-key", { ...baseClaims, exp: Math.floor(nowMs / 1000) - 1 })), /Expired/);
});

test("store hashes identity and never persists the mailbox address", (t) => {
  const directory = temporaryDirectory(t);
  const store = createProfileStore({ directory, now: () => "2026-07-15T04:00:00.000Z" });
  const mailbox = "player@example.com";
  const identity = store.identityHash(mailbox);
  assert.match(identity, /^[a-f0-9]{64}$/);
  assert.equal(identity.includes("player"), false);

  const result = store.put(identity, { schemaVersion: 2, profileId: "local:test", revision: 3 }, "*", "iteration39-create-0001");
  assert.equal(result.status, 201);
  const names = fs.readdirSync(directory);
  assert.deepEqual(names.sort(), [".identity-secret", `${identity}.json`].sort());
  const storedText = fs.readFileSync(path.join(directory, `${identity}.json`), "utf8");
  assert.equal(storedText.includes(mailbox), false);
  assert.equal(storedText.includes("player@example"), false);
});

test("ETag conflicts are explicit and idempotent replays cannot duplicate a save", (t) => {
  const directory = temporaryDirectory(t);
  let tick = 0;
  const store = createProfileStore({ directory, now: () => `2026-07-15T04:00:0${tick++}.000Z` });
  const identity = store.identityHash("player@example.com");
  const profile1 = { schemaVersion: 2, profileId: "local:test", revision: 1, economy: { events: { first: { amount: 1 } } } };
  const profile2 = { ...profile1, revision: 2 };

  const created = store.put(identity, profile1, "*", "iteration39-write-0001");
  assert.equal(created.status, 201);
  assert.equal(created.envelope.revision, 1);

  const replay = store.put(identity, profile1, "wrong-etag", "iteration39-write-0001");
  assert.equal(replay.status, 200);
  assert.equal(replay.replay, true);
  assert.equal(replay.envelope.revision, 1);

  const reused = store.put(identity, profile2, created.envelope.etag, "iteration39-write-0001");
  assert.equal(reused.status, 409);

  const conflict = store.put(identity, profile2, "\"stale\"", "iteration39-write-0002");
  assert.equal(conflict.status, 412);
  assert.equal(conflict.current.etag, created.envelope.etag);

  const updated = store.put(identity, profile2, created.envelope.etag, "iteration39-write-0002");
  assert.equal(updated.status, 200);
  assert.equal(updated.envelope.revision, 2);
  assert.notEqual(updated.envelope.etag, created.envelope.etag);
});

test("delete requires the latest ETag and removes only the profile", (t) => {
  const directory = temporaryDirectory(t);
  const store = createProfileStore({ directory });
  const identity = store.identityHash("player@example.com");
  const created = store.put(identity, { schemaVersion: 2, profileId: "local:test", revision: 1 }, "*", "iteration39-delete-0001");

  assert.equal(store.remove(identity, "\"stale\"").status, 412);
  assert.equal(store.read(identity).etag, created.envelope.etag);
  assert.deepEqual(store.remove(identity, created.envelope.etag), { status: 200, deleted: true });
  assert.equal(store.read(identity), null);
  assert.equal(fs.existsSync(path.join(directory, ".identity-secret")), true);
});

test("HTTP handler preserves strong ETags through no-transform responses", async (t) => {
  const directory = temporaryDirectory(t);
  const handler = createVampireProfileHandler({
    verifyAccessAssertion: async () => ({ email: "player@example.com" }),
    storeOptions: { directory, now: () => "2026-07-15T06:00:00.000Z" },
    logger: { warn() {} },
  });
  const profile = { schemaVersion: 2, profileId: "local:http", revision: 1 };
  const created = await handlerRequest(handler, {
    method: "PUT",
    headers: { "content-type": "application/json", "if-match": "*", "idempotency-key": "iteration40-http-create" },
    body: JSON.stringify({ profile }),
  });
  assert.equal(created.status, 201);
  assert.match(created.headers.etag, /^"v1-1-/);
  assert.equal(created.headers["cache-control"], "no-store, no-transform");

  const readBack = await handlerRequest(handler);
  assert.equal(readBack.status, 200);
  assert.equal(readBack.headers.etag, created.headers.etag);
  assert.deepEqual(readBack.body.profile, profile);
});

test("HTTP handler rejects disallowed origins before identity verification", async (t) => {
  let verified = false;
  const handler = createVampireProfileHandler({
    verifyAccessAssertion: async () => { verified = true; return { email: "player@example.com" }; },
    storeOptions: { directory: temporaryDirectory(t) },
    logger: { warn() {} },
  });
  const result = await handlerRequest(handler, { headers: { origin: "https://attacker.example" } });
  assert.equal(result.status, 403);
  assert.equal(verified, false);
});

test("HTTP handler returns 413 without destroying the request stream", async (t) => {
  const handler = createVampireProfileHandler({
    verifyAccessAssertion: async () => ({ email: "player@example.com" }),
    storeOptions: { directory: temporaryDirectory(t) },
    logger: { warn() {} },
  });
  const result = await handlerRequest(handler, {
    method: "PUT",
    headers: { "content-type": "application/json", "if-match": "*", "idempotency-key": "iteration40-oversized" },
    body: JSON.stringify({ profile: { padding: "x".repeat(MAX_PROFILE_BYTES) } }),
  });
  assert.equal(result.status, 413);
  assert.match(result.body.error, /too large/);
});
