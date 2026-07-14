import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOUD_PROFILE_MAX_BYTES,
  CLOUD_QUEUE_STORAGE_KEY,
  CLOUD_RECOVERY_STORAGE_KEY,
  createCloudProfileSync,
} from "../games/vampire-survival-src/cloud-sync.mjs";

function storageFixture() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

function response(status, body, etag = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "etag" ? etag : null },
    json: async () => body,
  };
}

const normalise = (value) => JSON.parse(JSON.stringify(value));
const profile = (revision, score = 0) => ({ schemaVersion: 2, profileId: "local:test", revision, score });

function controller(options = {}) {
  const storage = options.storage || storageFixture();
  let local = options.local || profile(1);
  const changes = [];
  const scheduled = [];
  const sync = createCloudProfileSync({
    storage,
    fetchImpl: options.fetchImpl,
    getLocalProfile: () => local,
    replaceLocalProfile: (next) => { local = normalise(next); return local; },
    normalise,
    onChange: (state) => changes.push(state),
    navigatorObject: options.navigatorObject || { onLine: true },
    windowObject: { addEventListener() {}, open: () => ({}) },
    randomId: () => "00000000-0000-4000-8000-000000000039",
    now: () => "2026-07-15T05:00:00.000Z",
    schedule: (callback) => scheduled.push(callback),
  });
  return { sync, storage, changes, scheduled, get local() { return local; }, set local(value) { local = value; } };
}

test("connecting to an empty account never uploads without a deliberate choice", async () => {
  const requests = [];
  const fixture = controller({ fetchImpl: async (_url, init) => { requests.push(init); return response(404, { ok: false }); } });
  await fixture.sync.refresh();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "GET");
  assert.equal(fixture.sync.snapshot().phase, "no-remote");
  assert.equal(fixture.sync.snapshot().remotePresent, false);
});

test("first upload uses If-Match star and an idempotency key", async () => {
  const requests = [];
  const fixture = controller({ fetchImpl: async (_url, init) => {
    requests.push(init);
    return response(201, { ok: true, revision: 1, profile: JSON.parse(init.body).profile }, '"v1-1-created"');
  } });
  await fixture.sync.uploadLocal();
  assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].headers["if-match"], "*");
  assert.match(requests[0].headers["idempotency-key"], /^vampire-.{16,}/);
  assert.equal(fixture.sync.snapshot().phase, "synced");
  assert.equal(fixture.storage.getItem(CLOUD_QUEUE_STORAGE_KEY), null);
});

test("a stale ETag creates a visible conflict and never replaces local progress", async () => {
  const cloud = profile(7, 700);
  const fixture = controller({
    local: profile(8, 800),
    fetchImpl: async () => response(412, { ok: false, error: "changed", current: { etag: '"v1-7-cloud"', revision: 7, profile: cloud } }, '"v1-7-cloud"'),
  });
  await fixture.sync.uploadLocal();
  assert.equal(fixture.sync.snapshot().phase, "conflict");
  assert.equal(fixture.sync.snapshot().conflict, true);
  assert.deepEqual(fixture.local, profile(8, 800));

  const replacement = fixture.sync.useCloud();
  assert.deepEqual(replacement, cloud);
  assert.deepEqual(fixture.local, cloud);
  const recovery = JSON.parse(fixture.storage.getItem(CLOUD_RECOVERY_STORAGE_KEY));
  assert.deepEqual(recovery.profile, profile(8, 800));
});

test("a remotely deleted copy returns to an explicit create choice", async () => {
  const storage = storageFixture();
  storage.setItem("vampire_survival_cloud_state_v1", JSON.stringify({ enabled: true, etag: '"v1-4"', remotePresent: true, remoteRevision: 4 }));
  const fixture = controller({
    storage,
    local: profile(5, 500),
    fetchImpl: async () => response(412, { ok: false, error: "missing", current: null }),
  });
  await fixture.sync.uploadLocal();
  assert.equal(fixture.sync.snapshot().phase, "no-remote");
  assert.equal(fixture.sync.snapshot().conflict, false);
  assert.equal(fixture.sync.snapshot().remotePresent, false);
  assert.equal(fixture.sync.snapshot().queued, true);
  assert.deepEqual(fixture.local, profile(5, 500));
});

test("offline local changes remain queued and never call the network", async () => {
  let calls = 0;
  const storage = storageFixture();
  storage.setItem("vampire_survival_cloud_state_v1", JSON.stringify({ enabled: true, etag: '"v1-1"', remotePresent: true }));
  const fixture = controller({
    storage,
    navigatorObject: { onLine: false },
    fetchImpl: async () => { calls += 1; return response(500, {}); },
  });
  fixture.sync.noteLocalProfile(profile(2, 20));
  assert.equal(fixture.sync.snapshot().phase, "offline");
  assert.equal(fixture.sync.snapshot().queued, true);
  for (const callback of fixture.scheduled.splice(0)) await callback();
  assert.equal(calls, 0);
  assert.ok(storage.getItem(CLOUD_QUEUE_STORAGE_KEY));
});

test("cloud deletion preserves the local profile", async () => {
  const storage = storageFixture();
  storage.setItem("vampire_survival_cloud_state_v1", JSON.stringify({ enabled: true, etag: '"v1-2"', remotePresent: true, remoteRevision: 2 }));
  const fixture = controller({ storage, local: profile(2, 50), fetchImpl: async (_url, init) => {
    assert.equal(init.method, "DELETE");
    assert.equal(init.headers["if-match"], '"v1-2"');
    return response(200, { ok: true, deleted: true });
  } });
  await fixture.sync.deleteCloud();
  assert.deepEqual(fixture.local, profile(2, 50));
  assert.equal(fixture.sync.snapshot().remotePresent, false);
  assert.equal(fixture.sync.snapshot().phase, "no-remote");
});

test("an oversized cloud payload stays local and recommends export", async () => {
  let calls = 0;
  const large = { ...profile(9, 900), padding: "x".repeat(CLOUD_PROFILE_MAX_BYTES) };
  const fixture = controller({
    local: large,
    fetchImpl: async () => { calls += 1; return response(500, {}); },
  });
  await fixture.sync.uploadLocal();
  assert.equal(calls, 0);
  assert.equal(fixture.sync.snapshot().phase, "too-large");
  assert.equal(fixture.sync.snapshot().queued, true);
  assert.match(fixture.sync.snapshot().message, /Export the local save/);
  assert.deepEqual(fixture.local, large);
});
