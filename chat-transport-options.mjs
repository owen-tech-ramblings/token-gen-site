const API_BASE = "https://token-gen-api.owenonthenet.com";

export async function requestChatStream(payload, userId, loopback, fetchImpl = fetch, signal = undefined, requestId = undefined) {
  const hasProjectMedia = Array.isArray(payload?.project_media) && payload.project_media.length > 0;
  let body = "";
  try {
    body = JSON.stringify(payload);
  } finally {
    delete payload.project_media;
  }
  const request = hasProjectMedia
    ? ["/api/private/projects/chat/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(requestId ? { "x-token-gen-request-id": requestId } : {}),
      },
        credentials: "include",
        body,
        ...(signal ? { signal } : {}),
      }]
    : [`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-token-gen-user": userId,
          "x-token-gen-user-source": loopback ? "local-development" : "cloudflare-access",
          ...(requestId ? { "x-token-gen-request-id": requestId } : {}),
        },
        body,
        ...(signal ? { signal } : {}),
      }];
  try {
    return await fetchImpl(...request);
  } finally {
    body = "";
  }
}
