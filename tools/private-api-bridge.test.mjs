import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/private-api-bridge/worker.js";

test("generic projects mapping forwards the signed assertion for private project-media chat", async () => {
  const originalFetch = globalThis.fetch;
  let target;
  globalThis.fetch = async (url, init) => {
    target = { url: String(url), init };
    return new Response("ok");
  };
  try {
    const request = new Request("https://token-gen.owenonthenet.com/api/private/projects/chat/stream", {
      method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": "verified-access" },
      body: "{}",
    });
    await worker.fetch(request);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(target.url, "https://token-gen-api.owenonthenet.com/api/projects/chat/stream");
  assert.equal(target.init.headers.get("X-Token-Gen-Site-Access-JWT"), "verified-access");
  assert.equal(target.init.headers.get("cookie"), "CF_Authorization=verified-access");
});

test("bridge streams the body and response while stripping hostile browser credentials", async () => {
  const originalFetch = globalThis.fetch;
  let target;
  globalThis.fetch = async (url, init) => {
    target = { url: String(url), init, body: await new Response(init.body).text() };
    return new Response("upstream stream", { status: 207, headers: { "x-upstream": "yes" } });
  };
  try {
    const response = await worker.fetch(new Request("https://token-gen.owenonthenet.com/api/private/projects/chat/stream", {
      method: "POST",
      headers: {
        "Cf-Access-Jwt-Assertion": "verified-access",
        "Authorization": "Bearer hostile",
        "Cookie": "hostile=true",
        "X-Token-Gen-User": "attacker@example.com",
        "X-Token-Gen-User-Source": "hostile",
      },
      body: "{\"project_media\":[\"opaque\"]}",
    }));
    assert.equal(response.status, 207);
    assert.equal(await response.text(), "upstream stream");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(target.body, "{\"project_media\":[\"opaque\"]}");
  assert.equal(target.init.headers.get("cookie"), "CF_Authorization=verified-access");
  assert.equal(target.init.headers.get("X-Token-Gen-Site-Access-JWT"), "verified-access");
  assert.equal(target.init.headers.get("authorization"), null);
  assert.equal(target.init.headers.get("x-token-gen-user"), null);
  assert.equal(target.init.headers.get("x-token-gen-user-source"), null);
});
