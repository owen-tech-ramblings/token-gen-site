import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generationSettings, requestIdentity, jobPath, verifyArtifact, sha256, PRINTER_PROFILE } from '../chat-three-d.mjs';
import * as threeD from '../chat-three-d.mjs';
import bridge from '../cloudflare/private-api-bridge/worker.js';
let artifacts = {};
try { artifacts = await import('../chat-artifacts.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

test('3D settings, retry identity and partial artifact integrity follow the API contract', async () => {
  assert.deepEqual(generationSettings({}), { model: 'trellis2', resolution: 1536, triangle_target: 1000000, texture_size: 4096, output_format: 'glb' });
  const values = { resolution: '512', triangle_target: '50000', texture_size: '1024', output_format: 'glb', seed: '', max_dimension_mm: '100' };
  assert.deepEqual(generationSettings(values), { model: 'trellis2', resolution: 512, triangle_target: 50000, texture_size: 1024, output_format: 'glb' });
  assert.equal(generationSettings({ ...values, output_format: 'both' }).max_dimension_mm, 100);
  const highest = generationSettings({ ...values, resolution: '1536', texture_size: '4096', triangle_target: '1000000', sampling_steps: '12', output_format: 'both', stl_repair: 'false' });
  assert.equal(highest.resolution, 1536);
  assert.equal(highest.texture_size, 4096);
  assert.equal(highest.triangle_target, 1000000);
  assert.equal(highest.sampling_steps, 12);
  assert.equal(highest.stl_repair, false);
  assert.equal(generationSettings({ ...values, output_format: 'stl', stl_repair: 'true' }).stl_repair, true);
  assert.equal(generationSettings({ ...values, output_format: 'stl', stl_repair: 'true', printer_profile: PRINTER_PROFILE }).printer_profile, PRINTER_PROFILE);
  assert.throws(() => generationSettings({ ...values, output_format: 'stl', stl_repair: 'false', printer_profile: PRINTER_PROFILE }));
  assert.throws(() => generationSettings({ ...values, printer_profile: PRINTER_PROFILE }));
  assert.throws(() => generationSettings({ ...values, output_format: 'stl', printer_profile: 'other-printer' }));
  assert.equal(generationSettings({ ...values, texture_size: '3072' }).texture_size, 3072);
  for (const invalid of [{ triangle_target: 1000001 }, { resolution: 2048 }, { sampling_steps: 51 }, { seed: -1 }, { output_format: 'both', max_dimension_mm: '' }])
    assert.throws(() => generationSettings({ ...values, ...invalid }));
  const previous = requestIdentity(null, 'same-image-settings', 'once');
  assert.equal(requestIdentity(previous, 'same-image-settings', 'unused'), previous);
  assert.throws(() => requestIdentity(previous, 'different-image-settings', 'unused'));
  assert.throws(() => jobPath('../other'));
  const bytes = new TextEncoder().encode('GLB from failed STL export');
  const metadata = { bytes: bytes.byteLength, sha256: await sha256(bytes) };
  await verifyArtifact(bytes, metadata);
  await assert.rejects(verifyArtifact(new Uint8Array([1]), metadata));
  assert.equal(typeof artifacts.normalizeArtifacts, 'function', 'Saved artifact references require safe browser normalization');
  const aid = '11111111-1111-4111-8111-111111111111';
  const cid = '22222222-2222-4222-8222-222222222222';
  const record = { artifact_id: aid, kind: 'video', format: 'zip', mime_type: 'application/zip',
    sha256: 'a'.repeat(64), size_bytes: 36000000000, state: 'saved', content_url: 'https://hostile.invalid/secret',
    owner_scope: 'private-owner', locator: { path: '/private/NAS' }, provider_token: 'private-token',
    native_metadata: { width: 3840, height: 2176, output_role: 'master', prompt: 'private prompt' } };
  const normalized = artifacts.normalizeArtifacts([record, record, { ...record, artifact_id: '../other' }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].content_url, `/api/private/artifacts/${aid}/content`);
  assert.doesNotMatch(JSON.stringify(normalized), /hostile|private-owner|private-token|private prompt|\/private\/NAS/);
  assert.deepEqual(artifacts.artifactReferences(normalized), [{ artifact_id: aid, kind: 'video', format: 'zip' }]);
  assert.equal(artifacts.mergeArtifacts(normalized, [{ artifact_id: aid, kind: 'video', format: 'zip' }])[0].state, 'saved');
  assert.equal(artifacts.mergeArtifacts(normalized, [{ artifact_id: aid, kind: 'video', format: 'zip', state: 'expired' }])[0].content_url, undefined);
  assert.equal(artifacts.normalizeArtifacts([record, { ...record, state: 'deleted' }])[0].content_url, undefined);
  assert.equal(artifacts.normalizeArtifacts([{ ...record, created_at: 1791690000, expires_at: 1791691800 }])[0].expires_at, 1791691800);
  assert.deepEqual(artifacts.artifactContext({ retention: 'none' }), { retention: 'none' });
  assert.deepEqual(artifacts.artifactContext({ retention: '30_days', conversationId: cid, messageId: 'stable-existing-id' }),
    { retention: '30_days', conversation_id: cid, message_id: 'stable-existing-id' });
  assert.throws(() => artifacts.artifactContext({ retention: '30_days', messageId: 'unsaved' }));
  assert.throws(() => artifacts.artifactContentPath('../other'));
  assert.equal(artifacts.privateArtifactJobPath('/api/video/generations/'+'a'.repeat(32)), '/api/private/video/generations/'+'a'.repeat(32));
  assert.equal(artifacts.privateArtifactJobPath('/api/3d/generations/'+'a'.repeat(32)), '/api/private/3d/generations/'+'a'.repeat(32));
  const speechJobId = 'e3b03e9a-31b9-4898-a359-cc8083831945';
  assert.equal(artifacts.privateArtifactJobPath(`/api/tts/generations/${speechJobId}`),
    '/api/private/tts/generations/e3b03e9a-31b9-4898-a359-cc8083831945', 'Poll the canonical UUID created by the TTS API');
  assert.equal(artifacts.privateArtifactJobPath('/api/image/history/runpod-job-1'), '/api/private/image/history/runpod-job-1');
  for (const value of ['https://other.invalid/api/image/history/job', '/api/image/history/../private', '/api/video/generations/job?secret=token', '/api/conversations/private',
    '/api/tts/generations/'+'b'.repeat(32), `/api/tts/generations/${speechJobId}?secret=token`,
    `/api/tts/generations/${speechJobId}/audio`, `/api/tts/generations/${speechJobId}#fragment`,
    `/api/tts/generations/${speechJobId}/../other`, `/api/video/generations/${speechJobId}`, `/api/3d/generations/${speechJobId}`])
    assert.equal(artifacts.privateArtifactJobPath(value), '');
  assert.match(artifacts.archiveLabel('pending'), /pending/i);
  assert.match(artifacts.archiveLabel('saved'), /saved/i);
  assert.doesNotMatch(artifacts.archiveLabel('pending'), /saved/i);
  // An artifact-only refresh must not acknowledge remote text/messages that
  // this tab has not applied: the next save still needs its old If-Match.
  const chatSource = readFileSync(new URL('../chat.js', import.meta.url), 'utf8');
  const refreshSource = chatSource.match(/async function refreshConversationArtifacts\(\) \{[\s\S]*?\n\}/)[0];
  const historyState = { currentId: cid, available: true, saving: false, currentVersion: 'applied-v1' };
  const remote = [{ id: 'remote-message', role: 'user', content: 'Edited in another tab', artifacts: normalized }];
  let hydrated;
  const refresh = new Function('historyState', 'historyRequest', 'hydrateMessageArtifacts', 'renderMessages',
    `return (${refreshSource});`)(historyState, async () => ({ json: { conversation: { messages: remote, version: 'remote-v2' } }, etag: 'remote-v2' }),
      values => { hydrated = values; }, () => {});
  await refresh();
  assert.equal(hydrated, remote, 'The actual refresh still hydrates private output references');
  assert.equal(historyState.currentVersion, 'applied-v1', 'Unapplied remote text must still trigger a save conflict');
  assert.equal(typeof threeD.printerValidationView, 'function', 'The native printer report needs inspectable safe fields');
  const printerView = threeD.printerValidationView({ profile_id: PRINTER_PROFILE, status: 'passed',
    dimensions_mm: [20, 20, 2], build_volume_mm: [320, 335, 310], layer_height_mm: .08, nozzle_mm: .4,
    toolpath: { layer_count: 22 }, warnings: ['thin_components', 'local_wall_thickness_unchecked', 'physical_print_unverified', 'PRIVATE_WARNING'],
    binary_sha256: 'PRIVATE_HASH', slicer_release: 'PRIVATE_PATH', provider_token: 'PRIVATE_TOKEN' });
  assert.equal(printerView.result, 'Passed native dry slice');
  assert.deepEqual(printerView.fields, [['Model dimensions', '20 × 20 × 2 mm'], ['Build volume', '320 × 335 × 310 mm'],
    ['Layer height', '0.08 mm'], ['Nozzle', '0.4 mm'], ['Deposited layers', '22']]);
  assert.equal(printerView.warnings.length, 3);
  assert.doesNotMatch(JSON.stringify(printerView), /PRIVATE_|<script>/);
  const failedView = threeD.printerValidationView({ profile_id: PRINTER_PROFILE, status: 'failed', code: 'outside_build_volume',
    message: '<script>PRIVATE_MESSAGE</script>', dimensions_mm: [Infinity, 20, 2], toolpath: { layer_count: true } });
  assert.equal(failedView.result, 'Failed native dry slice');
  assert.match(failedView.failure, /build volume/);
  assert.deepEqual(failedView.fields, []);
  assert.doesNotMatch(JSON.stringify(failedView), /PRIVATE_|<script>/);
});

test('private bridge adds 3D while preserving existing owner routes and credential stripping', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };
  try {
  for (const resource of ['conversations', 'projects', 'jobs', '3d/generations', 'artifacts', 'image/generations', 'chat/stream', 'tts/generations', 'video/generations']) {
      const response = await bridge.fetch(new Request(`https://token-gen.owenonthenet.com/api/private/${resource}`, {
        method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': 'verified-fixture', Authorization: 'Bearer untrusted', Cookie: 'unrelated',
          'X-Token-Gen-User': 'untrusted', 'Idempotency-Key': 'same-key', Range: 'bytes=0-3', 'Content-Type': 'application/json' }, body: '{}' }));
      assert.equal(response.status, 200);
      const { url, init } = calls.at(-1);
      assert.equal(url, `https://token-gen-api.owenonthenet.com/api/${resource}`);
      assert.equal(init.headers.get('authorization'), null);
      assert.equal(init.headers.get('x-token-gen-user'), null);
      assert.equal(init.headers.get('cookie'), 'CF_Authorization=verified-fixture');
      assert.equal(init.headers.get('X-Token-Gen-Site-Access-JWT'), 'verified-fixture');
      assert.equal(init.headers.get('Idempotency-Key'), 'same-key');
      assert.equal(init.headers.get('Range'), 'bytes=0-3');
      assert.equal(init.redirect, 'manual');
    }
    assert.equal((await bridge.fetch(new Request('https://token-gen.owenonthenet.com/api/private/3d/generations'))).status, 401);
    assert.equal((await bridge.fetch(new Request('https://token-gen.owenonthenet.com/api/private/unknown'))).status, 404);
    assert.equal((await bridge.fetch(new Request('https://untrusted.invalid/api/private/3d/generations'))).status, 404);
    for (const resource of ['artifacts', 'image/generations', 'chat/stream', 'tts/generations', 'video/generations'])
      assert.equal((await bridge.fetch(new Request(`https://token-gen.owenonthenet.com/api/private/${resource}`))).status, 401);
    const aid = '11111111-1111-4111-8111-111111111111';
    await bridge.fetch(new Request(`https://token-gen.owenonthenet.com/api/private/artifacts/${aid}/content`, {
      method: 'HEAD', headers: { 'Cf-Access-Jwt-Assertion': 'verified-fixture', Range: 'bytes=0-3' } }));
    assert.equal(calls.at(-1).url, `https://token-gen-api.owenonthenet.com/api/artifacts/${aid}/content`);
    assert.equal(calls.at(-1).init.method, 'HEAD');
    assert.equal(calls.at(-1).init.headers.get('Range'), 'bytes=0-3');
    assert.equal(calls.length, 10);
  } finally { globalThis.fetch = original; }
});
