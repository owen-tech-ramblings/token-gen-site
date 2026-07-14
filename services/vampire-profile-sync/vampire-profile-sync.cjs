"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROFILE_ROUTE = "/api/vampire-profile";
const MAX_PROFILE_BYTES = 512 * 1024;
const MAX_IDEMPOTENCY_ENTRIES = 32;

function base64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Access assertion encoding");
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAccessVerifier(options = {}) {
  const teamDomain = String(options.teamDomain || process.env.VAMPIRE_PROFILE_ACCESS_TEAM_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const expectedAudience = String(options.audience || process.env.VAMPIRE_PROFILE_ACCESS_AUD || "");
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => Date.now());
  const cacheTtlMs = options.cacheTtlMs || 60 * 60 * 1000;
  let certificateCache = null;

  if (!teamDomain || !expectedAudience) throw new Error("Vampire profile Access verification is not configured");
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required for Access verification");

  async function certificates() {
    if (certificateCache && certificateCache.expiresAt > now()) return certificateCache.keys;
    const response = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Access certificate request failed (${response.status})`);
    const document = await response.json();
    const keys = new Map();
    for (const jwk of Array.isArray(document.keys) ? document.keys : []) {
      if (jwk?.kid) keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    }
    for (const collection of [document.public_certs, document.public_cert]) {
      const certificates = Array.isArray(collection) ? collection : collection && typeof collection === "object" ? [collection] : [];
      for (const certificate of certificates) {
        const kid = certificate?.kid;
        const pem = certificate?.cert;
        if (typeof kid === "string" && typeof pem === "string" && !keys.has(kid)) {
          keys.set(kid, new crypto.X509Certificate(pem).publicKey);
        }
      }
    }
    if (!keys.size) throw new Error("Access certificate document contained no usable keys");
    certificateCache = { keys, expiresAt: now() + cacheTtlMs };
    return keys;
  }

  return async function verifyAccessAssertion(assertion) {
    if (typeof assertion !== "string" || !assertion) throw new Error("Missing Access assertion");
    const parts = assertion.split(".");
    if (parts.length !== 3) throw new Error("Invalid Access assertion");
    const header = base64UrlJson(parts[0]);
    const claims = base64UrlJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported Access assertion signature");
    const keys = await certificates();
    const publicKey = keys.get(header.kid);
    if (!publicKey) {
      certificateCache = null;
      throw new Error("Unknown Access assertion key");
    }
    const validSignature = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], "base64url"));
    if (!validSignature) throw new Error("Invalid Access assertion signature");

    const seconds = Math.floor(now() / 1000);
    const issuer = `https://${teamDomain}`;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!safeEqual(claims.iss || "", issuer)) throw new Error("Invalid Access assertion issuer");
    if (!audiences.some((audience) => safeEqual(audience || "", expectedAudience))) throw new Error("Invalid Access assertion audience");
    if (!Number.isFinite(claims.exp) || claims.exp <= seconds) throw new Error("Expired Access assertion");
    if (Number.isFinite(claims.nbf) && claims.nbf > seconds + 30) throw new Error("Access assertion is not active");
    if (typeof claims.email !== "string" || !claims.email.trim()) throw new Error("Access assertion has no identity");
    return { email: claims.email.trim().toLowerCase(), subject: typeof claims.sub === "string" ? claims.sub : null };
  };
}

function createProfileStore(options = {}) {
  const directory = path.resolve(options.directory || process.env.VAMPIRE_PROFILE_STORE_DIR || path.join(process.env.HOME || process.cwd(), ".local", "share", "token-gen-api", "vampire-profiles"));
  const now = options.now || (() => new Date().toISOString());
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* Best effort on non-POSIX test hosts. */ }

  const secretPath = path.join(directory, ".identity-secret");
  function identitySecret() {
    try {
      return fs.readFileSync(secretPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const temporary = `${secretPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temporary, crypto.randomBytes(32), { mode: 0o600, flag: "wx" });
      try {
        fs.renameSync(temporary, secretPath);
      } catch (renameError) {
        try { fs.unlinkSync(temporary); } catch { /* Another process won creation. */ }
        if (renameError?.code !== "EEXIST" && !fs.existsSync(secretPath)) throw renameError;
      }
      return fs.readFileSync(secretPath);
    }
  }
  const secret = identitySecret();

  function identityHash(email) {
    return crypto.createHmac("sha256", secret).update(String(email).trim().toLowerCase()).digest("hex");
  }

  function fileFor(identity) {
    if (!/^[a-f0-9]{64}$/.test(identity)) throw new Error("Invalid profile identity");
    return path.join(directory, `${identity}.json`);
  }

  function read(identity) {
    try {
      const envelope = JSON.parse(fs.readFileSync(fileFor(identity), "utf8"));
      if (envelope?.schemaVersion !== 1 || envelope.identityHash !== identity || !Number.isInteger(envelope.revision)
        || envelope.revision < 1 || typeof envelope.etag !== "string" || !envelope.profile || typeof envelope.profile !== "object") {
        throw new Error("Stored cloud profile is invalid");
      }
      return envelope;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  function requestDigest(profile) {
    return crypto.createHash("sha256").update(JSON.stringify(profile)).digest("hex");
  }

  function makeEtag(revision, profile) {
    return `"v1-${revision}-${requestDigest(profile).slice(0, 24)}"`;
  }

  function atomicWrite(identity, envelope) {
    const destination = fileFor(identity);
    const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, destination);
    try { fs.chmodSync(destination, 0o600); } catch { /* Best effort on non-POSIX test hosts. */ }
  }

  function put(identity, profile, ifMatch, idempotencyKey) {
    const current = read(identity);
    const digest = requestDigest(profile);
    const prior = current?.idempotency?.find((entry) => entry.key === idempotencyKey);
    if (prior) {
      if (!safeEqual(prior.digest, digest)) return { status: 409, error: "Idempotency key was already used for different profile data", current };
      return { status: 200, envelope: current, replay: true };
    }
    if (!current && ifMatch !== "*") return { status: 412, error: "Cloud profile does not exist", current: null };
    if (current && !safeEqual(ifMatch, current.etag)) return { status: 412, error: "Cloud profile changed", current };

    const revision = (current?.revision || 0) + 1;
    const etag = makeEtag(revision, profile);
    const idempotency = [...(current?.idempotency || []), { key: idempotencyKey, digest, etag }].slice(-MAX_IDEMPOTENCY_ENTRIES);
    const envelope = {
      schemaVersion: 1,
      identityHash: identity,
      revision,
      etag,
      updatedAt: now(),
      profile,
      idempotency,
    };
    atomicWrite(identity, envelope);
    return { status: current ? 200 : 201, envelope, replay: false };
  }

  function remove(identity, ifMatch) {
    const current = read(identity);
    if (!current) return { status: 404, error: "Cloud profile does not exist", current: null };
    if (!safeEqual(ifMatch, current.etag)) return { status: 412, error: "Cloud profile changed", current };
    fs.unlinkSync(fileFor(identity));
    return { status: 200, deleted: true };
  }

  return { directory, identityHash, read, put, remove };
}

function createVampireProfileHandler(options = {}) {
  const allowedOrigin = options.allowedOrigin || process.env.TOKEN_GEN_ALLOWED_ORIGIN || "https://token-gen.owenonthenet.com";
  const verifyAccessAssertion = options.verifyAccessAssertion || createAccessVerifier(options.access || {});
  const store = options.store || createProfileStore(options.storeOptions || {});
  const logger = options.logger || console;

  function corsHeaders(req) {
    const origin = req.headers.origin || "";
    if (origin && origin !== allowedOrigin) return null;
    return {
      "access-control-allow-origin": origin || allowedOrigin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, if-match, idempotency-key",
      "access-control-expose-headers": "etag",
      "cache-control": "no-store, no-transform",
      vary: "Origin",
    };
  }

  function sendJson(req, res, status, body, extraHeaders = {}) {
    const cors = corsHeaders(req);
    if (!cors) {
      res.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: false, error: "Origin is not allowed" }));
      return;
    }
    res.writeHead(status, { ...cors, "content-type": "application/json; charset=utf-8", ...extraHeaders });
    res.end(status === 204 ? undefined : JSON.stringify(body));
  }

  function publicEnvelope(envelope) {
    if (!envelope) return null;
    return { revision: envelope.revision, updatedAt: envelope.updatedAt, profile: envelope.profile };
  }

  function conflictBody(result) {
    return {
      ok: false,
      error: result.error,
      current: result.current ? { ...publicEnvelope(result.current), etag: result.current.etag } : null,
    };
  }

  function readJsonBody(req, maxBytes = MAX_PROFILE_BYTES) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(Object.assign(new Error("Profile payload is too large"), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
        catch { reject(Object.assign(new Error("Request body must be valid JSON"), { status: 400 })); }
      });
      req.on("error", reject);
    });
  }

  function matches(pathname) {
    return pathname === PROFILE_ROUTE || pathname.startsWith(`${PROFILE_ROUTE}/`);
  }

  async function handle(req, res, url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)) {
    if (!corsHeaders(req)) {
      sendJson(req, res, 403, { ok: false, error: "Origin is not allowed" });
      return;
    }
    if (req.method === "OPTIONS") {
      sendJson(req, res, 204, null);
      return;
    }

    let identity;
    try {
      const assertion = req.headers["cf-access-jwt-assertion"];
      const accessIdentity = await verifyAccessAssertion(Array.isArray(assertion) ? assertion[0] : assertion);
      identity = store.identityHash(accessIdentity.email);
    } catch (error) {
      logger.warn?.(`[vampire-profile] Access verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
      sendJson(req, res, 401, { ok: false, error: "A valid Cloudflare Access session is required" });
      return;
    }

    if (url.pathname === `${PROFILE_ROUTE}/session`) {
      if (req.method !== "GET") {
        sendJson(req, res, 405, { ok: false, error: "Method not allowed" });
        return;
      }
      const targetOrigin = JSON.stringify(allowedOrigin).replace(/</g, "\\u003c");
      const html = `<!doctype html><meta charset="utf-8"><title>Cloud save connected</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#08050b;color:#f5e9ec;font:16px system-ui}main{max-width:32rem;padding:2rem;text-align:center}</style><main><h1>Cloud save connected</h1><p>You can return to Vampire Survival.</p></main><script>if(window.opener){window.opener.postMessage({type:"vampire-cloud-session"},${targetOrigin});window.close()}<\/script>`;
      res.writeHead(200, { ...corsHeaders(req), "content-type": "text/html; charset=utf-8", "cache-control": "no-store, no-transform", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" });
      res.end(html);
      return;
    }

    if (url.pathname !== PROFILE_ROUTE) {
      sendJson(req, res, 404, { ok: false, error: "Not found" });
      return;
    }

    if (req.method === "GET") {
      const current = store.read(identity);
      if (!current) {
        sendJson(req, res, 404, { ok: false, error: "Cloud profile does not exist" });
        return;
      }
      sendJson(req, res, 200, { ok: true, ...publicEnvelope(current) }, { etag: current.etag });
      return;
    }

    if (req.method === "PUT") {
      const ifMatch = String(req.headers["if-match"] || "");
      const idempotencyKey = String(req.headers["idempotency-key"] || "");
      if (!ifMatch) {
        sendJson(req, res, 428, { ok: false, error: "If-Match is required" });
        return;
      }
      if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
        sendJson(req, res, 400, { ok: false, error: "A valid Idempotency-Key is required" });
        return;
      }
      try {
        const body = await readJsonBody(req);
        if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) throw Object.assign(new Error("profile must be an object"), { status: 400 });
        const result = store.put(identity, body.profile, ifMatch, idempotencyKey);
        if (result.status === 409 || result.status === 412) {
          sendJson(req, res, result.status, conflictBody(result), result.current ? { etag: result.current.etag } : {});
          return;
        }
        sendJson(req, res, result.status, { ok: true, ...publicEnvelope(result.envelope), idempotentReplay: result.replay }, { etag: result.envelope.etag });
      } catch (error) {
        sendJson(req, res, error?.status || 500, { ok: false, error: error?.status ? String(error.message) : "Cloud profile could not be saved" });
      }
      return;
    }

    if (req.method === "DELETE") {
      const ifMatch = String(req.headers["if-match"] || "");
      if (!ifMatch) {
        sendJson(req, res, 428, { ok: false, error: "If-Match is required" });
        return;
      }
      const result = store.remove(identity, ifMatch);
      if (result.status === 404 || result.status === 412) {
        sendJson(req, res, result.status, conflictBody(result), result.current ? { etag: result.current.etag } : {});
        return;
      }
      sendJson(req, res, 200, { ok: true, deleted: true });
      return;
    }

    sendJson(req, res, 405, { ok: false, error: "Method not allowed" });
  }

  return { matches, handle, store };
}

module.exports = {
  MAX_PROFILE_BYTES,
  PROFILE_ROUTE,
  createAccessVerifier,
  createProfileStore,
  createVampireProfileHandler,
};
