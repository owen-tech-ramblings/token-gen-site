const PRIVATE_PREFIX = "/api/private";
const PRIVATE_RESOURCES = new Set(["conversations", "projects", "jobs"]);
const SITE_HOST = "token-gen.owenonthenet.com";
const API_ORIGIN = "https://token-gen-api.owenonthenet.com";

function json(status, code, message) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.hostname !== SITE_HOST || !incoming.pathname.startsWith(`${PRIVATE_PREFIX}/`)) {
      return json(404, "not_found", "Private Token Gen route not found.");
    }

    const relativePath = incoming.pathname.slice(PRIVATE_PREFIX.length);
    const resource = relativePath.split("/").filter(Boolean)[0];
    if (!PRIVATE_RESOURCES.has(resource)) {
      return json(404, "not_found", "Private Token Gen route not found.");
    }

    const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!assertion) {
      return json(401, "access_required", "Cloudflare Access authentication is required.");
    }

    const target = new URL(API_ORIGIN);
    target.pathname = `/api${relativePath}`;
    target.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.delete("cookie");
    headers.delete("cf-access-jwt-assertion");
    headers.delete("host");
    headers.set("cookie", `CF_Authorization=${assertion}`);
    headers.set("X-Token-Gen-Site-Access-JWT", assertion);

    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
    return fetch(target, init);
  },
};
