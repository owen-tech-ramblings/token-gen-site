import { archiveLabel, normalizeArtifacts } from './chat-artifacts.mjs?v=20261011-artifacts-1';
export const THREE_D_BASE = '/api/private/3d';
export const ACTIVE = new Set(['IN_QUEUE', 'IN_PROGRESS', 'CANCEL_REQUESTED']);
export const PRINTER_PROFILE = 'snapmaker_a350t_quick_swap_single_pla_0_4_fine';

export function jobPath(id, suffix = '') {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid 3D job ID.');
  return `${THREE_D_BASE}/generations/${id}${suffix}`;
}

export function generationSettings(values = {}) {
  const result = { model: 'trellis2', resolution: Number(values.resolution ?? 1536),
    triangle_target: Number(values.triangle_target ?? 1000000), texture_size: Number(values.texture_size ?? 4096),
    output_format: values.output_format ?? 'glb' };
  if (![512, 1024, 1536].includes(result.resolution) || ![512, 1024, 2048, 3072, 4096].includes(result.texture_size) ||
      !Number.isInteger(result.triangle_target) || result.triangle_target < 1000 || result.triangle_target > 1000000 ||
      !['glb', 'stl', 'both'].includes(result.output_format)) throw new Error('Check the 3D generation settings.');
  if (result.output_format !== 'glb') {
    result.max_dimension_mm = Number(values.max_dimension_mm);
    if (!Number.isFinite(result.max_dimension_mm) || result.max_dimension_mm < .1 || result.max_dimension_mm > 10000)
      throw new Error('Set the STL longest dimension between 0.1 and 10,000 mm.');
  }
  if (values.seed !== '' && values.seed != null) {
    result.seed = Number(values.seed);
    if (!Number.isInteger(result.seed) || result.seed < 0 || result.seed > 4294967295) throw new Error('Seed must be an unsigned 32-bit integer.');
  }
  if (values.sampling_steps !== '' && values.sampling_steps != null) {
    result.sampling_steps = Number(values.sampling_steps);
    if (!Number.isInteger(result.sampling_steps) || result.sampling_steps < 1 || result.sampling_steps > 50)
      throw new Error('Sampling steps must be between 1 and 50.');
  }
  if (result.output_format !== 'glb' && values.stl_repair != null) {
    if (!['true', 'false'].includes(String(values.stl_repair))) throw new Error('Choose the STL geometry option.');
    result.stl_repair = String(values.stl_repair) === 'true';
  }
  if (values.printer_profile) {
    if (result.output_format === 'glb' || values.printer_profile !== PRINTER_PROFILE || result.stl_repair === false)
      throw new Error('The Quick Swap printer target requires repaired STL geometry. Choose generic geometry for raw inspection.');
    result.printer_profile = PRINTER_PROFILE;
  }
  return result;
}

export async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}

export async function verifyArtifact(bytes, metadata) {
  if (bytes.byteLength !== metadata?.bytes || await sha256(bytes) !== metadata?.sha256)
    throw new Error('The download did not match the saved model. Please download it again.');
}

export function requestIdentity(previous, digest, newKey) {
  if (previous && previous.digest !== digest)
    throw new Error('Use New model to start a different request. Retry keeps the original image and settings.');
  return previous || { digest, key: newKey };
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', redirect: 'error', ...options,
    headers: { Accept: 'application/json', ...options.headers } });
  if (!response.ok) {
    const messages = { 401: 'Sign in to Token Gen again to access your models.', 403: 'This account cannot access that model.',
      409: 'That request key belongs to different settings. Keep the original request or choose New model.',
      503: '3D generation is currently unavailable. Your existing jobs are retained.' };
    // API validation errors are useful for PNG transparency and supported settings.
    const detail = await response.json().catch(() => null);
    throw new Error(messages[response.status] || detail?.error?.message || `3D request failed (${response.status}).`);
  }
  return response.json();
}

async function pngData(file) {
  if (!file || file.size > 6 * 1024 * 1024) throw new Error('Choose a transparent PNG up to 6 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    throw new Error('Choose a PNG image.');
  const view = new DataView(bytes.buffer);
  if (view.getUint32(16) > 4096 || view.getUint32(20) > 4096) throw new Error('PNG dimensions must be at most 4096 by 4096.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0); bitmap.close();
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let foreground = false, transparent = false;
  for (let i = 3; i < rgba.length; i += 4) { foreground ||= rgba[i] > 0; transparent ||= rgba[i] < 255; }
  if (!foreground || !transparent) throw new Error('The PNG needs a visible subject and a transparent background.');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export function mountThreeD(doc = document, options = {}) {
  const open = doc.querySelector('#chatThreeDOpen');
  if (!open) return;
  const dialog = doc.createElement('dialog');
  dialog.className = 'three-d-dialog';
  dialog.setAttribute('aria-labelledby', 'threeDHeading');
  // Static, trusted template. API strings are assigned only through textContent.
  dialog.innerHTML = `
    <header><div><small>IMAGE TO 3D</small><h2 id="threeDHeading">Create a 3D model</h2></div><button type="button" data-close aria-label="Close 3D models">✕</button></header>
    <p>Create a textured model or a repaired, geometry-validated STL. Highest quality is selected by default; choose lower settings for previews.</p>
    <p class="three-d-health" data-health role="status">Checking 3D availability…</p>
    <form class="three-d-form">
      <label class="three-d-file">Source image<input name="image" type="file" accept="image/png" required><small>Transparent PNG · up to 6 MiB · 4096 × 4096 px</small></label>
      <div class="three-d-fields">
        <label>Output<select name="output_format"><option value="glb">GLB · textured model</option><option value="stl">STL · geometry only</option><option value="both">GLB and STL</option></select></label>
        <label>Resolution<select name="resolution"><option>512</option><option>1024</option><option selected>1536</option></select></label>
        <label>Triangle target<input name="triangle_target" type="number" min="1000" max="1000000" step="1" value="1000000" required></label>
        <label>Texture size<select name="texture_size"><option>512</option><option>1024</option><option>2048</option><option>3072</option><option selected>4096</option></select></label>
        <label>Sampling steps<input name="sampling_steps" type="number" min="1" max="50" step="1" value="12" required><small>12 recommended; more is not always better.</small></label>
        <label data-stl hidden>Longest dimension (mm)<input name="max_dimension_mm" type="number" min="0.1" max="10000" step="any" value="100"></label>
        <label data-stl hidden>STL geometry<select name="stl_repair"><option value="true">Repaired and validated</option><option value="false">Raw · for inspection</option></select></label>
        <label data-stl hidden>Printer target<select name="printer_profile"><option value="">Generic geometry · no printer validation</option><option value="${PRINTER_PROFILE}">A350T Quick Swap · single extrusion · PLA · 0.4 mm · fine 0.08 mm</option></select><small data-printer>Checking the confirmed printer profile…</small></label>
        <label>Seed <small>(optional)</small><input name="seed" type="number" min="0" max="4294967295" step="1" placeholder="Random"></label>
      </div>
      <p data-message role="status" aria-live="polite"></p>
      <div class="three-d-actions"><button type="submit" class="three-d-primary">Generate model</button><button type="button" data-new>New model</button></div>
      <small>Generation uses the Token Gen 3D service. One generation supplies both formats.</small>
    </form>
    <section aria-labelledby="threeDJobsHeading"><div class="three-d-jobs-heading"><h3 id="threeDJobsHeading">Your models</h3><button type="button" data-refresh>Refresh</button></div><div data-jobs></div></section>`;
  doc.body.append(dialog);
  const query = selector => dialog.querySelector(selector);
  const form = query('form'), message = query('[data-message]'), submit = query('[type=submit]');
  const storageKey = 'token-gen-three-d-request-v1';
  let previous = null, timer, busy = false, available = false, printerChosen = false, targetAvailable = false;
  try { previous = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { /* Storage can be disabled. */ }
  const save = value => { previous = value; try { value ? localStorage.setItem(storageKey, JSON.stringify(value)) : localStorage.removeItem(storageKey); } catch { /* Same-tab retries still retain identity. */ } };
  if (previous) message.textContent = 'A request is saved. Reselect its PNG and settings to retry, or use New model for another generation.';
  function report(error) { message.textContent = error.message || 'The 3D request could not be completed.'; }
  async function download(job, format, button) {
    button.disabled = true;
    try {
      const response = await fetch(jobPath(job.id, '/content?format=' + format), { credentials: 'same-origin', redirect: 'error' });
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const bytes = await response.arrayBuffer();
      await verifyArtifact(bytes, job.artifacts[format]);
      const url = URL.createObjectURL(new Blob([bytes]));
      const link = doc.createElement('a'); link.href = url; link.download = `token-gen-${job.id}.${format}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      message.textContent = `Downloaded and verified ${format.toUpperCase()}.`;
    } catch (error) { report(error); } finally { button.disabled = false; }
  }
  function renderJobs(jobs) {
    const host = query('[data-jobs]'); host.replaceChildren();
    if (!jobs.length) { host.textContent = 'Your generated models will appear here.'; return; }
    for (const job of jobs) {
      const item = doc.createElement('article'); item.className = 'three-d-job';
      const title = doc.createElement('strong'); title.textContent = `${job.output_format?.toUpperCase() || '3D model'} · ${job.id.slice(0, 8)}`;
      const status = doc.createElement('p'); status.textContent = `${job.status} · ${job.stage || 'generation'}${job.seed != null ? ` · seed ${job.seed}` : ''}`;
      item.append(title, status);
      if (archiveLabel(job.archive_state)) { const archive = doc.createElement('p'); archive.dataset.archiveState = job.archive_state; archive.textContent = archiveLabel(job.archive_state); item.append(archive); }
      if (job.status === 'SUBMISSION_UNKNOWN') { const note = doc.createElement('p'); note.textContent = 'Submission acknowledgement is unknown. Keep this job; it will not be resubmitted automatically.'; item.append(note); }
      if (job.error) { const error = doc.createElement('p'); error.textContent = typeof job.error === 'string' ? job.error : job.error.message || 'Generation failed.'; item.append(error); }
      if (job.stl_validation?.printer_validation) {
        const validation = doc.createElement('p'); validation.textContent = 'Printer validation report is available in the saved job.';
        item.append(validation);
      }
      const actions = doc.createElement('div'); actions.className = 'three-d-actions';
      for (const artifact of normalizeArtifacts(job.generated_artifacts)) if (artifact.content_url) {
        const link = doc.createElement('a'); link.href = artifact.content_url; link.download = `token-gen-${artifact.artifact_id}.${artifact.format}`;
        link.textContent = `Saved ${artifact.format.toUpperCase()}`; actions.append(link);
      }
      for (const format of ['glb', 'stl']) if (job.artifacts?.[format]) {
        const button = doc.createElement('button'); button.type = 'button'; button.textContent = `Download ${format.toUpperCase()}`;
        button.addEventListener('click', () => download(job, format, button)); actions.append(button);
      }
      if (ACTIVE.has(job.status)) {
        const cancel = doc.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.disabled = job.status === 'CANCEL_REQUESTED';
        cancel.addEventListener('click', async () => { cancel.disabled = true; try { await api(jobPath(job.id, '/cancel'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); await refresh(); } catch (error) { report(error); cancel.disabled = false; } }); actions.append(cancel);
      }
      item.append(actions); host.append(item);
    }
  }
  async function refresh() {
    clearTimeout(timer);
    try {
      const result = await api(`${THREE_D_BASE}/generations`);
      const jobs = await Promise.all((Array.isArray(result.jobs) ? result.jobs : []).map(async job => {
        // The status endpoint refreshes provider state; history alone is a saved projection.
        if (!ACTIVE.has(job.status) && job.archive_state !== 'pending') return job;
        return (await api(jobPath(job.id))).job;
      }));
      jobs.forEach(job => options.onJob?.(job, previous?.jobId === job.id ? previous.binding : null));
      renderJobs(jobs);
      if (jobs.some(job => ACTIVE.has(job.status) || job.archive_state === 'pending')) timer = setTimeout(refresh, 3000);
    } catch (error) { query('[data-jobs]').textContent = error.message; }
  }
  async function health() {
    try {
      const result = await api(`${THREE_D_BASE}/health`);
      const model = result.models?.find(model => model.id === 'trellis2');
      available = result.ok === true && model?.available === true;
      targetAvailable = model?.stl?.default_printer_profile === PRINTER_PROFILE && model?.printer_profiles?.some(profile =>
        profile.id === PRINTER_PROFILE && profile.available === true) === true;
      form.elements.printer_profile.querySelector(`option[value="${PRINTER_PROFILE}"]`).disabled = !targetAvailable;
      if (!printerChosen) form.elements.printer_profile.value = targetAvailable ? PRINTER_PROFILE : '';
      query('[data-printer]').textContent = targetAvailable
        ? 'Confirmed Quick Swap target: 320 × 335 × 310 mm. Fine 0.08 mm layers; longest dimension remains your explicit choice.'
        : 'The confirmed Quick Swap profile is unavailable. Generic geometry does not include printer-specific validation.';
      query('[data-health]').textContent = available ? 'TRELLIS.2 is ready for image-to-3D generation.' : '3D generation is currently unavailable. You can still view saved models.';
    } catch { available = false; query('[data-health]').textContent = 'Could not check 3D availability. Refresh to try again.'; }
    submit.disabled = busy || !available;
  }
  open.addEventListener('click', () => { dialog.showModal(); void health(); void refresh(); });
  query('[data-close]').addEventListener('click', () => dialog.close());
  query('[data-refresh]').addEventListener('click', () => { void health(); void refresh(); });
  const showStl = () => { for (const field of dialog.querySelectorAll('[data-stl]')) field.hidden = form.elements.output_format.value === 'glb'; };
  form.elements.output_format.addEventListener('change', showStl);
  form.elements.printer_profile.addEventListener('change', () => { printerChosen = true; });
  query('[data-new]').addEventListener('click', () => { if (busy) return; save(null); form.reset(); printerChosen = false; showStl(); void health(); message.textContent = 'Ready for a new model.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true; submit.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      if (values.output_format !== 'glb' && form.elements.printer_profile.value === PRINTER_PROFILE && !targetAvailable)
        throw new Error('The chosen Quick Swap printer profile is unavailable. Retry when it is restored or explicitly choose generic geometry.');
      if (values.output_format === 'glb') delete values.printer_profile;
      const payload = { ...generationSettings(values), image: await pngData(form.elements.image.files[0]) };
      const digest = await sha256(new TextEncoder().encode(JSON.stringify(payload)));
      let identity = requestIdentity(previous, digest, crypto.randomUUID());
      if (!previous && options.prepareSubmission) identity = { ...identity, binding: await options.prepareSubmission({ filename: form.elements.image.files[0]?.name }) };
      save(identity);
      if (identity.binding?.context) payload.artifact_context = identity.binding.context;
      message.textContent = 'Submitting model…';
      const result = await api(`${THREE_D_BASE}/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': identity.key }, body: JSON.stringify(payload) });
      save({ ...identity, jobId: result.job.id });
      options.onJob?.(result.job, identity.binding);
      message.textContent = `Model request saved: ${result.job.id}. Use New model to create another.`;
      await refresh();
    } catch (error) { report(error); } finally { busy = false; submit.disabled = !available; }
  });
  if (location.hash === '#3d') open.click();
  else void refresh();
  return { refresh };
}
