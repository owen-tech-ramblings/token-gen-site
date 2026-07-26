import assert from "node:assert/strict";
import test from "node:test";
import worker, { __test } from "../cloudflare/private-api-bridge/worker.js";

const SITE_URL = "https://token-gen.owenonthenet.com/api/private/access";
const JWKS_URL = "https://access.test/certs";
const API_BASE = "https://api.test";
const ADMIN_AUDIENCE = "f485326fa929b7373f7cd46047d3b4848b46c3ee2872f912e58923dfaedacc27";
const APP_ID = "d6a8b0d7-99da-47c3-aa07-5098036ca239";
const POLICY_PATH = "/accounts/017717ec4c34e46041a4bf3dd0873e4a/access/apps/d6a8b0d7-99da-47c3-aa07-5098036ca239/policies/b4291dfb-e2c2-4693-a7d2-065259a1d469";
const USERS_PATH = "/accounts/017717ec4c34e46041a4bf3dd0873e4a/access/users";
const LOGS_PATH = "/accounts/017717ec4c34e46041a4bf3dd0873e4a/access/logs/access_requests";

const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", keyPair.publicKey)), alg: "RS256", kid: "test-key", use: "sig" };

function base64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assertion(email = "jesse@owenonthenet.com", overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      aud: ADMIN_AUDIENCE,
      email,
      exp: now + 300,
      iat: now,
      iss: "https://zen-free.cloudflareaccess.com",
      nbf: now - 5,
      ...overrides,
    }),
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64Url(signature)}`;
}

function apiResponse(result, status = 200) {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, errors: [], messages: [], result }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createHarness() {
  const state = {
    calls: [],
    policy: {
      decision: "allow",
      exclude: [],
      id: "policy-1",
      include: [
        { email: { email: "jesse@owenonthenet.com" } },
        { email: { email: "guest@example.com" } },
        { group: { id: "managed-elsewhere" } },
      ],
      name: "allow-token-gen-users",
      precedence: 1,
      require: [],
      session_duration: "24h",
      updated_at: "v1",
    },
    users: [
      { email: "jesse@owenonthenet.com", id: "u1", last_successful_login: "2026-07-19T00:14:19Z", name: "Jesse Owen" },
      { email: "guest@example.com", id: "u2", last_successful_login: null, name: "" },
    ],
  };

  async function fetchMock(input, init = {}) {
    const url = new URL(input instanceof URL ? input.href : typeof input === "string" ? input : input.url);
    const method = init.method || "GET";
    if (url.href === JWKS_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), { headers: { "content-type": "application/json" } });
    }

    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ auth: init.headers?.authorization, body, method, path: url.pathname, search: url.search });
    assert.equal(init.headers.authorization, "Bearer test-cloudflare-token");

    if (url.pathname === POLICY_PATH && method === "GET") return apiResponse(structuredClone(state.policy));
    if (url.pathname === POLICY_PATH && method === "PUT") {
      state.policy = { ...state.policy, ...structuredClone(body), updated_at: `v${Number(state.policy.updated_at.slice(1)) + 1}` };
      return apiResponse(structuredClone(state.policy));
    }
    if (url.pathname === USERS_PATH && method === "GET") return apiResponse(structuredClone(state.users));
    if (url.pathname === USERS_PATH && method === "POST") {
      const user = { id: `u${state.users.length + 1}`, last_successful_login: null, ...body };
      state.users.push(user);
      return apiResponse(structuredClone(user));
    }
    if (url.pathname.startsWith(`${USERS_PATH}/`) && method === "PUT") {
      const id = url.pathname.slice(USERS_PATH.length + 1);
      const user = state.users.find((candidate) => candidate.id === id);
      Object.assign(user, body);
      return apiResponse(structuredClone(user));
    }
    if (url.pathname === LOGS_PATH && method === "GET") {
      return apiResponse([
        {
          allowed: true,
          app_uid: APP_ID,
          connection: "onetimepin",
          country: "au",
          created_at: "2026-07-19T11:56:56Z",
          ip_address: "203.0.113.10",
          ray_id: "secret-ray",
          user_email: "jesse@owenonthenet.com",
        },
        {
          allowed: true,
          app_uid: APP_ID,
          connection: "onetimepin",
          country: "au",
          created_at: "2026-07-19T11:56:56Z",
          ip_address: "203.0.113.10",
          ray_id: "secret-ray",
          user_email: "jesse@owenonthenet.com",
        },
        {
          allowed: false,
          app_uid: "another-app",
          connection: "onetimepin",
          country: "nz",
          created_at: "2026-07-19T12:00:00Z",
          user_email: "guest@example.com",
        },
      ]);
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  }

  return {
    env: { ACCESS_JWKS_URL: JWKS_URL, CLOUDFLARE_API_BASE: API_BASE, CLOUDFLARE_API_TOKEN: "test-cloudflare-token" },
    fetchMock,
    state,
  };
}

async function requestFor(method = "GET", body, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.withAssertion !== false) headers.set("Cf-Access-Jwt-Assertion", await assertion(options.email, options.claims));
  if (body !== undefined) {
    headers.set("content-type", "application/json");
    headers.set("origin", "https://token-gen.owenonthenet.com");
    headers.set("sec-fetch-site", "same-origin");
    headers.set("x-token-gen-admin", "1");
  }
  return new Request(SITE_URL, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function withHarness(run) {
  const originalFetch = globalThis.fetch;
  const harness = createHarness();
  globalThis.fetch = harness.fetchMock;
  __test.resetJwks();
  try {
    await run(harness);
  } finally {
    globalThis.fetch = originalFetch;
    __test.resetJwks();
  }
}

test("Access API requires a signed Cloudflare assertion", { concurrency: false }, async () => {
  await withHarness(async ({ env }) => {
    const response = await worker.fetch(await requestFor("GET", undefined, { withAssertion: false }), env);
    assert.equal(response.status, 401);
  });
});

test("Access API rejects a valid token for a non-owner", { concurrency: false }, async () => {
  await withHarness(async ({ env }) => {
    const response = await worker.fetch(await requestFor("GET", undefined, { email: "guest@example.com" }), env);
    assert.equal(response.status, 403);
  });
});

test("Access API validates audience and expiry", { concurrency: false }, async () => {
  await withHarness(async ({ env }) => {
    const response = await worker.fetch(await requestFor("GET", undefined, { claims: { aud: "wrong-audience" } }), env);
    assert.equal(response.status, 401);
  });
});

test("owner directory is live, deduplicated, and redacts network identifiers", { concurrency: false }, async () => {
  await withHarness(async ({ env, state }) => {
    const response = await worker.fetch(await requestFor(), env);
    assert.equal(response.status, 200, `calls: ${JSON.stringify(state.calls)}`);
    const text = await response.text();
    const payload = JSON.parse(text);
    assert.equal(payload.data.people.length, 2);
    assert.equal(payload.data.people[0].recentSuccessCount, 1);
    assert.equal(payload.data.people[0].lastSuccessfulLogin, "2026-07-19T11:56:56.000Z");
    assert.doesNotMatch(text, /203\.0\.113\.10|secret-ray|ip_address|ray_id/);
  });
});

test("owner can add a person while preserving unmanaged policy rules", { concurrency: false }, async () => {
  await withHarness(async ({ env, state }) => {
    const response = await worker.fetch(
      await requestFor("POST", { email: "new.person@example.com", name: "New Person", policyVersion: "v1" }),
      env,
    );
    assert.equal(response.status, 201);
    assert.ok(state.users.some((user) => user.email === "new.person@example.com" && user.name === "New Person"));
    assert.ok(state.policy.include.some((rule) => rule.group?.id === "managed-elsewhere"));
    assert.ok(state.policy.include.some((rule) => rule.email?.email === "new.person@example.com"));
  });
});

test("owner can edit a real name", { concurrency: false }, async () => {
  await withHarness(async ({ env, state }) => {
    const response = await worker.fetch(
      await requestFor("PATCH", { email: "guest@example.com", name: "Guest Person" }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(state.users.find((user) => user.email === "guest@example.com").name, "Guest Person");
  });
});

test("owner can remove a person while preserving unmanaged policy rules", { concurrency: false }, async () => {
  await withHarness(async ({ env, state }) => {
    const response = await worker.fetch(
      await requestFor("DELETE", { email: "guest@example.com", policyVersion: "v1" }),
      env,
    );
    assert.equal(response.status, 200);
    assert.ok(state.policy.include.some((rule) => rule.group?.id === "managed-elsewhere"));
    assert.ok(!state.policy.include.some((rule) => rule.email?.email === "guest@example.com"));
  });
});

test("stale policy versions fail closed before mutation", { concurrency: false }, async () => {
  await withHarness(async ({ env, state }) => {
    const response = await worker.fetch(
      await requestFor("POST", { email: "new.person@example.com", name: "New Person", policyVersion: "stale" }),
      env,
    );
    assert.equal(response.status, 409);
    assert.ok(!state.users.some((user) => user.email === "new.person@example.com"));
    assert.equal(state.calls.filter((call) => call.method !== "GET").length, 0);
  });
});

test("mutations require the same site origin", { concurrency: false }, async () => {
  await withHarness(async ({ env }) => {
    const request = await requestFor("PATCH", { email: "guest@example.com", name: "Guest" });
    request.headers.set("origin", "https://example.com");
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 403);
  });
});

test("the owner entry cannot be removed", { concurrency: false }, async () => {
  await withHarness(async ({ env }) => {
    const response = await worker.fetch(
      await requestFor("DELETE", { email: "jesse@owenonthenet.com", policyVersion: "v1" }),
      env,
    );
    assert.equal(response.status, 400);
  });
});
