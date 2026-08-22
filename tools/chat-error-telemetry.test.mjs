import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatClientErrorEvent,
  classifyChatClientError,
  createChatRequestId,
  reportChatClientError,
} from "../chat-error-telemetry.mjs";
import { requestChatStream } from "../chat-transport-options.mjs";

test("chat attempts carry one opaque correlation id through public and private transports", async () => {
  const requestId = createChatRequestId({ randomUUID: () => "07a1bd14-1ab4-40d1-bd54-c30bdc7934df" });
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response("stream");
  };
  await requestChatStream({ messages: [] }, "browser-user", false, fetchImpl, undefined, requestId);
  await requestChatStream(
    { messages: [], project_media: [{ type: "image", reference: "opaque" }] },
    "browser-user",
    false,
    fetchImpl,
    undefined,
    requestId,
  );
  assert.equal(requests[0].options.headers["x-token-gen-request-id"], requestId);
  assert.equal(requests[1].options.headers["x-token-gen-request-id"], requestId);
});

test("client telemetry contains only bounded operational fields", () => {
  const event = buildChatClientErrorEvent({
    error: new TypeError("Failed to fetch secret@example.com https://private.example"),
    requestId: "07a1bd14-1ab4-40d1-bd54-c30bdc7934df",
    stage: "request",
    chatMode: "web",
    online: true,
  });
  assert.deepEqual(event, {
    request_id: "07a1bd14-1ab4-40d1-bd54-c30bdc7934df",
    stage: "request",
    error_code: "network_fetch_failed",
    http_status: null,
    stream_started: false,
    online: true,
    chat_mode: "web",
  });
  assert.equal(JSON.stringify(event).includes("example.com"), false);
  assert.equal(classifyChatClientError(new Error("The model reasoned but did not return a usable final answer.")), "missing_final_answer");
});

test("error reporting uses the existing authenticated private bridge and never throws", async () => {
  let request;
  const ok = await reportChatClientError({ request_id: "opaque" }, async (url, options) => {
    request = { url, options };
    return new Response("{}", { status: 202 });
  });
  assert.equal(ok, true);
  assert.equal(request.url, "/api/private/conversations/client-errors");
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.keepalive, true);
  assert.equal(await reportChatClientError({}, async () => { throw new Error("offline"); }), false);
});
