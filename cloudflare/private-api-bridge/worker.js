const PRIVATE_PREFIX = "/api/private";
const PRIVATE_RESOURCES = new Set(["conversations", "projects", "jobs"]);
const SITE_HOST = "token-gen.owenonthenet.com";
const SITE_ORIGIN = `https://${SITE_HOST}`;
const API_ORIGIN = "https://token-gen-api.owenonthenet.com";
const ACCESS_PATH = `${PRIVATE_PREFIX}/access`;
const ACCESS_OWNER = "jesse@owenonthenet.com";
const ACCESS_ACCOUNT_ID = "017717ec4c34e46041a4bf3dd0873e4a";
const ACCESS_APP_ID = "d6a8b0d7-99da-47c3-aa07-5098036ca239";
const ACCESS_POLICY_ID = "b4291dfb-e2c2-4693-a7d2-065259a1d469";
const ADMIN_AUDIENCE = "f485326fa929b7373f7cd46047d3b4848b46c3ee2872f912e58923dfaedacc27";
const ACCESS_ISSUER = "https://zen-free.cloudflareaccess.com";
const ACCESS_JWKS_URL = `${ACCESS_ISSUER}/cdn-cgi/access/certs`;
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const MAX_BODY_BYTES = 4096;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const JWKS_TTL_MS = 5 * 60 * 1000;

let jwksCache = { expiresAt: 0, keys: [] };

class RequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function responseHeaders() {
  return {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function jsonError(status, code, message) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: responseHeaders(),
  });
}

function jsonData(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: responseHeaders(),
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function fetchJwks(url, force = false) {
  if (!force && jwksCache.expiresAt > Date.now() && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");
  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  if (!keys.length) throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");
  jwksCache = { expiresAt: Date.now() + JWKS_TTL_MS, keys };
  return keys;
}

async function verifyAccessJwt(assertion, env) {
  if (!assertion) throw new RequestError(401, "access_required", "Please sign in again.");
  const parts = assertion.split(".");
  if (parts.length !== 3) throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");

  let header;
  let claims;
  try {
    header = decodeJwtPart(parts[0]);
    claims = decodeJwtPart(parts[1]);
  } catch {
    throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");
  }

  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");
  }

  const jwksUrl = env.ACCESS_JWKS_URL || ACCESS_JWKS_URL;
  let keys = await fetchJwks(jwksUrl);
  let jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) {
    keys = await fetchJwks(jwksUrl, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  }
  if (!jwk) throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");

  let validSignature = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    validSignature = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    validSignature = false;
  }
  if (!validSignature) throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");

  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const issuer = String(claims.iss || "").replace(/\/$/, "");
  if (
    issuer !== ACCESS_ISSUER ||
    !audience.includes(ADMIN_AUDIENCE) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now - 30 ||
    (Number.isFinite(claims.nbf) && claims.nbf > now + 30)
  ) {
    throw new RequestError(401, "invalid_session", "Your sign-in could not be verified.");
  }

  const email = String(claims.email || "").trim().toLowerCase();
  if (email !== ACCESS_OWNER) throw new RequestError(403, "not_allowed", "You do not have access to this page.");
  return { email };
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    /[\s\u0000-\u001f\u007f]/.test(email) ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(email)
  ) {
    throw new RequestError(400, "invalid_email", "Enter a valid email address.");
  }
  return email;
}

function normalizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length > MAX_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new RequestError(400, "invalid_name", "Name must be 80 characters or fewer.");
  }
  return name;
}

async function readJsonBody(request) {
  if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    throw new RequestError(415, "invalid_content_type", "Send changes as JSON.");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RequestError(413, "request_too_large", "The request is too large.");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new RequestError(413, "request_too_large", "The request is too large.");
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value;
  } catch {
    throw new RequestError(400, "invalid_json", "The request could not be read.");
  }
}

function requireSameOriginMutation(request) {
  if (request.headers.get("origin") !== SITE_ORIGIN) {
    throw new RequestError(403, "invalid_origin", "The request was not accepted.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new RequestError(403, "invalid_origin", "The request was not accepted.");
  }
  if (request.headers.get("x-token-gen-admin") !== "1") {
    throw new RequestError(403, "invalid_request", "The request was not accepted.");
  }
}

async function cloudflareRequest(env, path, { method = "GET", query, body } = {}) {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new RequestError(503, "not_configured", "Access management is temporarily unavailable.");
  }
  const url = new URL(`${env.CLOUDFLARE_API_BASE || CLOUDFLARE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.success !== true) {
    throw new RequestError(502, "cloudflare_error", "Cloudflare could not complete the request.");
  }
  return payload.result;
}

function policyPath() {
  return `/accounts/${ACCESS_ACCOUNT_ID}/access/apps/${ACCESS_APP_ID}/policies/${ACCESS_POLICY_ID}`;
}

function usersPath(userId = "") {
  return `/accounts/${ACCESS_ACCOUNT_ID}/access/users${userId ? `/${encodeURIComponent(userId)}` : ""}`;
}

function emailFromRule(rule) {
  return typeof rule?.email?.email === "string" ? rule.email.email.trim().toLowerCase() : "";
}

function authorisedEmails(policy) {
  return (Array.isArray(policy?.include) ? policy.include : []).map(emailFromRule).filter(Boolean);
}

function policyBody(policy, include) {
  const body = {
    name: policy.name,
    decision: policy.decision,
    include,
    exclude: Array.isArray(policy.exclude) ? policy.exclude : [],
    require: Array.isArray(policy.require) ? policy.require : [],
  };
  const optionalFields = [
    "precedence",
    "session_duration",
    "approval_groups",
    "approval_required",
    "isolation_required",
    "purpose_justification_prompt",
    "purpose_justification_required",
    "connection_rules",
    "mfa_config",
  ];
  for (const field of optionalFields) {
    if (policy[field] !== undefined && policy[field] !== null) body[field] = policy[field];
  }
  return body;
}

function requirePolicyVersion(policy, supplied) {
  if (!supplied || String(supplied) !== String(policy.updated_at || "")) {
    throw new RequestError(409, "stale_policy", "Access changed elsewhere. Refresh and try again.");
  }
}

async function listUsers(env) {
  const result = await cloudflareRequest(env, usersPath(), { query: { page: 1, per_page: 1000 } });
  return Array.isArray(result) ? result : [];
}

async function upsertUser(env, users, email, name) {
  const existing = users.find((user) => String(user.email || "").trim().toLowerCase() === email);
  if (existing) {
    if (String(existing.name || "") === name) return existing;
    return cloudflareRequest(env, usersPath(existing.id), { method: "PUT", body: { email, name } });
  }
  return cloudflareRequest(env, usersPath(), { method: "POST", body: { email, name } });
}

function latestTimestamp(values) {
  const valid = values.filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime()))).toISOString();
}

function sanitizeLogs(logs) {
  const seen = new Set();
  const sanitized = [];
  for (const log of Array.isArray(logs) ? logs : []) {
    if (log?.app_uid !== ACCESS_APP_ID || typeof log?.user_email !== "string") continue;
    const entry = {
      allowed: log.allowed === true,
      at: typeof log.created_at === "string" ? log.created_at : null,
      country: typeof log.country === "string" ? log.country.toUpperCase() : "",
      email: log.user_email.trim().toLowerCase(),
      method: typeof log.connection === "string" ? log.connection : "",
    };
    const key = `${entry.email}|${entry.allowed}|${entry.at}|${entry.country}|${entry.method}`;
    if (!seen.has(key)) {
      seen.add(key);
      sanitized.push(entry);
    }
  }
  return sanitized.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

async function loadDirectory(env) {
  const [policy, users, rawLogs] = await Promise.all([
    cloudflareRequest(env, policyPath()),
    listUsers(env),
    cloudflareRequest(env, `/accounts/${ACCESS_ACCOUNT_ID}/access/logs/access_requests`, {
      query: { app_uid: ACCESS_APP_ID, app_uidOp: "eq", direction: "desc", limit: 100 },
    }),
  ]);
  const logs = sanitizeLogs(rawLogs);
  const people = authorisedEmails(policy).map((email) => {
    const user = users.find((candidate) => String(candidate.email || "").trim().toLowerCase() === email);
    const attempts = logs
      .filter((entry) => entry.email === email)
      .map(({ email: _email, ...entry }) => entry);
    return {
      attempts,
      email,
      lastSuccessfulLogin: latestTimestamp([
        user?.last_successful_login,
        ...attempts.filter((attempt) => attempt.allowed).map((attempt) => attempt.at),
      ]),
      name: typeof user?.name === "string" ? user.name : "",
      recentFailureCount: attempts.filter((attempt) => !attempt.allowed).length,
      recentSuccessCount: attempts.filter((attempt) => attempt.allowed).length,
    };
  });
  return {
    capturedAt: new Date().toISOString(),
    people,
    policyVersion: String(policy.updated_at || ""),
  };
}

async function addPerson(env, input) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  const [policy, users] = await Promise.all([cloudflareRequest(env, policyPath()), listUsers(env)]);
  requirePolicyVersion(policy, input.policyVersion);
  if (authorisedEmails(policy).includes(email)) {
    throw new RequestError(409, "already_authorised", "That email already has access.");
  }
  await upsertUser(env, users, email, name);
  await cloudflareRequest(env, policyPath(), {
    method: "PUT",
    body: policyBody(policy, [...policy.include, { email: { email } }]),
  });
  return { changed: true };
}

async function editPerson(env, input) {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);
  const [policy, users] = await Promise.all([cloudflareRequest(env, policyPath()), listUsers(env)]);
  if (!authorisedEmails(policy).includes(email)) {
    throw new RequestError(404, "not_found", "That person is no longer authorised.");
  }
  await upsertUser(env, users, email, name);
  return { changed: true };
}

async function removePerson(env, input) {
  const email = normalizeEmail(input.email);
  if (email === ACCESS_OWNER) throw new RequestError(400, "owner_required", "The owner cannot be removed.");
  const policy = await cloudflareRequest(env, policyPath());
  requirePolicyVersion(policy, input.policyVersion);
  const include = policy.include.filter((rule) => emailFromRule(rule) !== email);
  if (include.length === policy.include.length) {
    throw new RequestError(404, "not_found", "That person is no longer authorised.");
  }
  await cloudflareRequest(env, policyPath(), { method: "PUT", body: policyBody(policy, include) });
  return { changed: true };
}

async function handleAccessRequest(request, env) {
  await verifyAccessJwt(request.headers.get("Cf-Access-Jwt-Assertion"), env);
  if (request.method === "GET") return jsonData(await loadDirectory(env));
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) {
    return jsonError(405, "method_not_allowed", "Method not allowed.");
  }
  requireSameOriginMutation(request);
  const input = await readJsonBody(request);
  if (request.method === "POST") return jsonData(await addPerson(env, input), 201);
  if (request.method === "PATCH") return jsonData(await editPerson(env, input));
  return jsonData(await removePerson(env, input));
}

async function proxyPrivateRequest(request, incoming) {
  const relativePath = incoming.pathname.slice(PRIVATE_PREFIX.length);
  const resource = relativePath.split("/").filter(Boolean)[0];
  if (!PRIVATE_RESOURCES.has(resource)) return jsonError(404, "not_found", "Private Token Gen route not found.");

  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) return jsonError(401, "access_required", "Cloudflare Access authentication is required.");

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
}

export const __test = {
  resetJwks() {
    jwksCache = { expiresAt: 0, keys: [] };
  },
  sanitizeLogs,
};

export default {
  async fetch(request, env = {}) {
    try {
      const incoming = new URL(request.url);
      if (incoming.hostname !== SITE_HOST || !incoming.pathname.startsWith(`${PRIVATE_PREFIX}/`)) {
        return jsonError(404, "not_found", "Private Token Gen route not found.");
      }
      if (incoming.pathname === ACCESS_PATH || incoming.pathname === `${ACCESS_PATH}/`) {
        return await handleAccessRequest(request, env);
      }
      return await proxyPrivateRequest(request, incoming);
    } catch (error) {
      if (error instanceof RequestError) return jsonError(error.status, error.code, error.message);
      return jsonError(500, "internal_error", "The request could not be completed.");
    }
  },
};
