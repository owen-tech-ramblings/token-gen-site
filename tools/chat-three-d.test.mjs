import test from 'node:test';
import assert from 'node:assert/strict';
import { generationSettings, requestIdentity, jobPath, verifyArtifact, sha256 } from '../chat-three-d.mjs';
import bridge from '../cloudflare/private-api-bridge/worker.js';

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
});

test('private bridge adds 3D while preserving existing owner routes and credential stripping', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };
  try {
    for (const resource of ['conversations', 'projects', 'jobs', '3d/generations']) {
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
    assert.equal(calls.length, 4);
  } finally { globalThis.fetch = original; }
});
