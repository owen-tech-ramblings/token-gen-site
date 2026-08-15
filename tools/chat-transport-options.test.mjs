import assert from "node:assert/strict";
import test from "node:test";

async function loadTransport() {
  return import("../chat-transport-options.mjs");
}

test("project media selects private credentials without browser identity and clears after success", async () => {
  const { requestChatStream } = await loadTransport();
  const payload = { project_media: [{ type: "image", reference: "opaque", label: "chart" }] };
  let request;
  await requestChatStream(payload, "browser-user", false, async (url, options) => {
    request = { url, options };
    return new Response("stream");
  });
  assert.equal(request.url, "/api/private/projects/chat/stream");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(request.options.headers, { "content-type": "application/json" });
  assert.match(request.options.body, /opaque/);
  assert.equal("project_media" in payload, false);
});

test("ordinary chat retains its exact public transport and cleanup runs after a thrown fetch", async () => {
  const { requestChatStream } = await loadTransport();
  const publicPayload = { messages: [] };
  let request;
  await requestChatStream(publicPayload, "browser-user", true, async (url, options) => {
    request = { url, options };
    return new Response("stream");
  });
  assert.equal(request.url, "https://token-gen-api.owenonthenet.com/api/chat/stream");
  assert.deepEqual(request.options.headers, {
    "content-type": "application/json",
    "x-token-gen-user": "browser-user",
    "x-token-gen-user-source": "local-development",
  });

  const privatePayload = { project_media: [{ type: "image", reference: "opaque", label: "chart" }] };
  await assert.rejects(
    requestChatStream(privatePayload, "browser-user", false, async () => { throw new Error("network down"); }),
    /network down/,
  );
  assert.equal("project_media" in privatePayload, false);
});
