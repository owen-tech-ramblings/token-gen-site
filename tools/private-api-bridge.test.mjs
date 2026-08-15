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
