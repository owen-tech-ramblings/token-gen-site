const CLIENT_ERROR_ENDPOINT = "/api/private/conversations/client-errors";

const SAFE_SERVER_CODE = /^[a-z][a-z0-9_]{2,63}(?: \([a-z][a-z0-9_]{2,63}\))?$/;

export function createChatRequestId(cryptoImpl = globalThis.crypto) {
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoImpl.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function classifyChatClientError(error, httpStatus = null) {
  const name = String(error?.name || "");
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (name === "AbortError" || lower.includes("aborted")) return "request_aborted";
  if (lower.includes("cloudflare access identity")) return "access_identity_unavailable";
  if (lower.includes("failed to fetch") || lower.includes("network down")) return "network_fetch_failed";
  if (lower.includes("reasoned but did not return")) return "missing_final_answer";
  if (lower.includes("empty response")) return "empty_response";
  if (lower.includes("could not repair")) return "repair_failed";
  if (Number(httpStatus) >= 500) return "api_unavailable";
  if (SAFE_SERVER_CODE.test(message)) return "api_error";
  return "client_chat_error";
}

export function buildChatClientErrorEvent({
  error,
  requestId,
  stage = "unknown",
  httpStatus = null,
  streamStarted = false,
  chatMode = "auto",
  online = globalThis.navigator?.onLine,
}) {
  return {
    request_id: requestId,
    stage,
    error_code: classifyChatClientError(error, httpStatus),
    http_status: Number.isInteger(httpStatus) ? httpStatus : null,
    stream_started: Boolean(streamStarted),
    online: typeof online === "boolean" ? online : null,
    chat_mode: chatMode,
  };
}

export async function reportChatClientError(event, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch {
    return false;
  }
}
