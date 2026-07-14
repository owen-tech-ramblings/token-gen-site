export const CLOUD_PROFILE_API = "https://vampire-save.owenonthenet.com/api/vampire-profile";
export const CLOUD_STATE_STORAGE_KEY = "vampire_survival_cloud_state_v1";
export const CLOUD_QUEUE_STORAGE_KEY = "vampire_survival_cloud_queue_v1";
export const CLOUD_RECOVERY_STORAGE_KEY = "vampire_survival_cloud_recovery_v1";
export const CLOUD_PROFILE_MAX_BYTES = 512 * 1024;

function cloudClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readStoredJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function cloudProfilesEquivalent(left, right, normalise) {
  try {
    return JSON.stringify(normalise(left)) === JSON.stringify(normalise(right));
  } catch {
    return false;
  }
}

export function createCloudProfileSync(options = {}) {
  const storage = options.storage;
  const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const getLocalProfile = options.getLocalProfile;
  const replaceLocalProfile = options.replaceLocalProfile;
  const normalise = options.normalise;
  const apiBase = options.apiBase || CLOUD_PROFILE_API;
  const onChange = options.onChange || (() => {});
  const navigatorObject = options.navigatorObject || globalThis.navigator || { onLine: true };
  const windowObject = options.windowObject || globalThis.window;
  const now = options.now || (() => new Date().toISOString());
  const randomId = options.randomId || (() => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") throw new Error("Cloud sync needs Web Storage");
  if (typeof fetchImpl !== "function" || typeof getLocalProfile !== "function" || typeof replaceLocalProfile !== "function" || typeof normalise !== "function") throw new Error("Cloud sync dependencies are incomplete");

  let persisted = {
    enabled: false,
    etag: null,
    remotePresent: false,
    remoteRevision: 0,
    lastSyncedAt: null,
    lastSyncedLocalRevision: null,
    ...readStoredJson(storage, CLOUD_STATE_STORAGE_KEY, {}),
  };
  let queue = readStoredJson(storage, CLOUD_QUEUE_STORAGE_KEY, null);
  let conflictRemote = null;
  let phase = persisted.enabled ? "idle" : "local-only";
  let message = persisted.enabled ? "Cloud save is ready to check." : "This device is the only save location.";
  let busy = false;
  let flushScheduled = false;

  function storeState() {
    storage.setItem(CLOUD_STATE_STORAGE_KEY, JSON.stringify(persisted));
  }

  function storeQueue(value) {
    queue = value;
    if (value) storage.setItem(CLOUD_QUEUE_STORAGE_KEY, JSON.stringify(value));
    else storage.removeItem(CLOUD_QUEUE_STORAGE_KEY);
  }

  function publish(nextPhase = phase, nextMessage = message) {
    phase = nextPhase;
    message = nextMessage;
    onChange(snapshot());
  }

  function snapshot() {
    return {
      enabled: Boolean(persisted.enabled),
      etag: persisted.etag,
      remotePresent: Boolean(persisted.remotePresent),
      remoteRevision: persisted.remoteRevision || 0,
      lastSyncedAt: persisted.lastSyncedAt,
      lastSyncedLocalRevision: persisted.lastSyncedLocalRevision,
      queued: Boolean(queue),
      queuedAt: queue?.queuedAt || null,
      conflict: Boolean(conflictRemote),
      phase,
      message,
      busy,
    };
  }

  async function responseJson(response) {
    try { return await response.json(); }
    catch { return {}; }
  }

  function setRemoteMetadata(etag, body) {
    persisted.etag = etag || body?.etag || null;
    persisted.remotePresent = true;
    persisted.remoteRevision = Number.isInteger(body?.revision) ? body.revision : persisted.remoteRevision;
    storeState();
  }

  function rememberConflict(current, fallbackMessage = "This device and the cloud both changed. Choose which copy to keep.") {
    if (current?.profile) conflictRemote = normalise(current.profile);
    if (current?.etag) persisted.etag = current.etag;
    if (Number.isInteger(current?.revision)) persisted.remoteRevision = current.revision;
    persisted.remotePresent = Boolean(current);
    storeState();
    publish("conflict", fallbackMessage);
  }

  function rememberRemoteMissing(message = "The cloud copy was removed. Upload this device only if you want to recreate it.") {
    conflictRemote = null;
    persisted.etag = null;
    persisted.remotePresent = false;
    persisted.remoteRevision = 0;
    storeState();
    publish("no-remote", message);
  }

  async function request(method, { profile, etag, idempotencyKey } = {}) {
    const headers = { accept: "application/json" };
    if (etag) headers["if-match"] = etag;
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const init = { method, headers, credentials: "include", cache: "no-store" };
    if (profile) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify({ profile });
      if (new TextEncoder().encode(init.body).byteLength > CLOUD_PROFILE_MAX_BYTES) {
        throw Object.assign(new Error("Cloud profile exceeds the backup size limit"), { code: "PROFILE_TOO_LARGE" });
      }
    }
    const response = await fetchImpl(apiBase, init);
    const body = await responseJson(response);
    return { response, body, etag: response.headers?.get?.("etag") || body?.current?.etag || null };
  }

  async function refresh() {
    persisted.enabled = true;
    storeState();
    busy = true;
    publish("checking", "Checking the protected cloud copy…");
    try {
      const { response, body, etag } = await request("GET");
      if (response.status === 401 || response.status === 403) {
        publish("needs-session", "Open a protected Cloudflare session to connect this save.");
        return snapshot();
      }
      if (response.status === 404) {
        persisted.etag = null;
        persisted.remotePresent = false;
        persisted.remoteRevision = 0;
        conflictRemote = null;
        storeState();
        publish("no-remote", "Connected. No cloud copy exists yet; upload this device when ready.");
        return snapshot();
      }
      if (!response.ok || !body?.profile) throw new Error(body?.error || `Cloud check failed (${response.status})`);
      const remote = normalise(body.profile);
      setRemoteMetadata(etag, body);
      if (cloudProfilesEquivalent(getLocalProfile(), remote, normalise)) {
        conflictRemote = null;
        persisted.lastSyncedAt = now();
        persisted.lastSyncedLocalRevision = normalise(getLocalProfile()).revision;
        storeState();
        storeQueue(null);
        publish("synced", "This device matches the cloud copy.");
      } else {
        rememberConflict({ ...body, profile: remote, etag });
      }
    } catch {
      publish(navigatorObject.onLine === false ? "offline" : "unavailable", navigatorObject.onLine === false
        ? "Offline. Local play and saves continue; cloud changes will wait."
        : "Cloud save is unavailable. Local play and saves are unaffected.");
    } finally {
      busy = false;
      onChange(snapshot());
    }
    return snapshot();
  }

  function makeQueue(profile, baseEtag = persisted.etag) {
    return {
      profile: normalise(profile),
      baseEtag: baseEtag || "*",
      idempotencyKey: `vampire-${randomId()}`.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 128),
      queuedAt: now(),
    };
  }

  async function sendQueued(expectedQueue = queue) {
    if (!expectedQueue || busy) return snapshot();
    if (navigatorObject.onLine === false) {
      publish("offline", "Offline. The latest local save is queued without blocking play.");
      return snapshot();
    }
    busy = true;
    publish("syncing", "Uploading the latest local save…");
    try {
      const { response, body, etag } = await request("PUT", {
        profile: expectedQueue.profile,
        etag: expectedQueue.baseEtag,
        idempotencyKey: expectedQueue.idempotencyKey,
      });
      if (response.status === 401 || response.status === 403) {
        publish("needs-session", "Cloud session expired. The local save remains queued.");
        return snapshot();
      }
      if (response.status === 409) {
        publish("conflict", "Cloud rejected a reused write key. The local save remains queued for review.");
        return snapshot();
      }
      if (response.status === 412) {
        if (body?.current?.profile) rememberConflict(body.current);
        else rememberRemoteMissing();
        return snapshot();
      }
      if (!response.ok || !body?.profile) throw new Error(body?.error || `Cloud upload failed (${response.status})`);
      setRemoteMetadata(etag, body);
      conflictRemote = null;
      persisted.lastSyncedAt = now();
      persisted.lastSyncedLocalRevision = expectedQueue.profile.revision;
      storeState();
      if (queue?.idempotencyKey === expectedQueue.idempotencyKey) storeQueue(null);
      else if (queue) {
        queue.baseEtag = persisted.etag;
        storeQueue(queue);
        scheduleFlush(0);
      }
      publish("synced", body.idempotentReplay ? "Queued save was already safely stored in the cloud." : "Local progress is backed up to the cloud.");
    } catch (error) {
      publish(error?.code === "PROFILE_TOO_LARGE" ? "too-large" : navigatorObject.onLine === false ? "offline" : "unavailable", error?.code === "PROFILE_TOO_LARGE"
        ? "This profile is too large for cloud backup. Export the local save; local play still works."
        : navigatorObject.onLine === false
          ? "Offline. The latest local save remains queued."
          : "Cloud upload failed. The local save remains safe and queued.");
    } finally {
      busy = false;
      onChange(snapshot());
    }
    return snapshot();
  }

  function scheduleFlush(delay = 300) {
    if (flushScheduled) return;
    flushScheduled = true;
    schedule(() => {
      flushScheduled = false;
      sendQueued(queue);
    }, delay);
  }

  function noteLocalProfile(candidate) {
    if (!persisted.enabled) return snapshot();
    storeQueue(makeQueue(candidate));
    if (conflictRemote) publish("conflict", "Local progress changed while a cloud conflict awaits your choice.");
    else if (!persisted.remotePresent || !persisted.etag) publish("no-remote", "Local progress is ready. Choose Upload this device to create the cloud copy.");
    else {
      publish(navigatorObject.onLine === false ? "offline" : "queued", navigatorObject.onLine === false
        ? "Offline. The latest local save is queued without blocking play."
        : "Local progress queued for cloud backup.");
      scheduleFlush();
    }
    return snapshot();
  }

  async function uploadLocal() {
    persisted.enabled = true;
    storeState();
    const pending = makeQueue(getLocalProfile(), persisted.remotePresent ? persisted.etag : "*");
    storeQueue(pending);
    conflictRemote = null;
    return sendQueued(pending);
  }

  function useCloud() {
    if (!conflictRemote) throw new Error("There is no cloud conflict to resolve");
    const currentLocal = normalise(getLocalProfile());
    storage.setItem(CLOUD_RECOVERY_STORAGE_KEY, JSON.stringify({ preservedAt: now(), profile: currentLocal }));
    const replacement = replaceLocalProfile(cloudClone(conflictRemote));
    const normalisedReplacement = normalise(replacement || conflictRemote);
    conflictRemote = null;
    storeQueue(null);
    persisted.lastSyncedAt = now();
    persisted.lastSyncedLocalRevision = normalisedReplacement.revision;
    storeState();
    publish("synced", "The cloud copy now replaces this device. The previous local copy is preserved for recovery.");
    return normalisedReplacement;
  }

  async function deleteCloud() {
    if (!persisted.remotePresent || !persisted.etag) throw new Error("There is no cloud copy to delete");
    busy = true;
    publish("deleting", "Deleting the cloud copy…");
    try {
      const { response, body } = await request("DELETE", { etag: persisted.etag });
      if (response.status === 412) {
        rememberConflict(body?.current || null, "The cloud copy changed before deletion. Review it before trying again.");
        return snapshot();
      }
      if (response.status === 401 || response.status === 403) {
        publish("needs-session", "Cloud session expired. Nothing was deleted.");
        return snapshot();
      }
      if (!response.ok && response.status !== 404) throw new Error(body?.error || `Cloud deletion failed (${response.status})`);
      persisted.etag = null;
      persisted.remotePresent = false;
      persisted.remoteRevision = 0;
      persisted.lastSyncedAt = null;
      persisted.lastSyncedLocalRevision = null;
      conflictRemote = null;
      storeQueue(null);
      storeState();
      publish("no-remote", "Cloud copy deleted. This device's local save remains unchanged.");
    } catch {
      publish("unavailable", "Cloud deletion failed. Both local and cloud copies remain unchanged.");
    } finally {
      busy = false;
      onChange(snapshot());
    }
    return snapshot();
  }

  function openSession() {
    persisted.enabled = true;
    storeState();
    publish("needs-session", "Complete Cloudflare Access in the new window, then return here.");
    const popup = windowObject?.open?.(`${apiBase}/session`, "vampire-cloud-session", "popup,width=560,height=680");
    if (!popup) publish("needs-session", "Pop-up blocked. Allow the cloud connection window and try again.");
    return Boolean(popup);
  }

  function start() {
    windowObject?.addEventListener?.("message", (event) => {
      if (event.origin === new URL(apiBase).origin && event.data?.type === "vampire-cloud-session") refresh();
    });
    windowObject?.addEventListener?.("online", () => {
      if (persisted.enabled && queue && !conflictRemote) scheduleFlush(0);
    });
    if (persisted.enabled) schedule(() => refresh(), 0);
    else publish();
    return snapshot();
  }

  return {
    deleteCloud,
    noteLocalProfile,
    openSession,
    refresh,
    snapshot,
    start,
    uploadLocal,
    useCloud,
  };
}
