// Safe browser values for the owner-scoped generated artifact catalogue.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FORMATS = {
  image: { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' },
  audio: { wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac' },
  video: { zip: 'application/zip', mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', mov: 'video/quicktime' },
  three_d: { glb: 'model/gltf-binary', stl: 'model/stl' },
};
const LABELS = {
  pending: 'Archive pending', saved: 'Saved to private storage', temporary: 'Temporary output',
  failed: 'Archive failed', expired: 'Saved output expired', deleted: 'Saved output deleted',
};

export function archiveLabel(state) { return LABELS[state] || ''; }

export function artifactContentPath(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Invalid saved output ID.');
  return `/api/private/artifacts/${id}/content`;
}

export function privateArtifactJobPath(value) {
  if (typeof value !== 'string') return '';
  const ttsPrefix = '/api/tts/generations/';
  const ttsId = value.startsWith(ttsPrefix) ? value.slice(ttsPrefix.length) : '';
  if (/^\/api\/image\/history\/[a-z0-9_-]{1,128}$/i.test(value) ||
      /^\/api\/(?:video|3d)\/generations\/[a-f0-9]{32}$/.test(value) ||
      (ttsId.length === 36 && UUID.test(ttsId)))
    return value.replace('/api/', '/api/private/');
  return '';
}

export function normalizeArtifacts(values) {
  const records = new Map();
  for (const value of (Array.isArray(values) ? values : []).slice(0, 64)) {
    const { artifact_id: id, kind, format } = value || {};
    if (typeof id !== 'string' || !UUID.test(id) || !Object.hasOwn(FORMATS, kind) || !Object.hasOwn(FORMATS[kind], format)) continue;
    const item = { artifact_id: id, kind, format };
    if (Object.hasOwn(LABELS, value.state)) item.state = value.state;
    if (typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)) item.sha256 = value.sha256;
    if (Number.isSafeInteger(value.size_bytes) && value.size_bytes > 0) item.size_bytes = value.size_bytes;
    if (['saved', 'temporary'].includes(item.state) && item.sha256 && item.size_bytes) {
      item.mime_type = FORMATS[kind][format];
      item.content_url = artifactContentPath(id);
    }
    for (const key of ['created_at', 'expires_at']) {
      if ((Number.isFinite(value[key]) && value[key] >= 0 && value[key] < 8640000000000) || value[key] === null) item[key] = value[key];
      else if (typeof value[key] === 'string' && value[key].length <= 128) item[key] = value[key];
    }
    if (typeof value.revision === 'string' && value.revision.length <= 128) item.revision = value.revision;
    if (value.native_metadata && typeof value.native_metadata === 'object') {
      item.native_metadata = {};
      for (const key of ['width', 'height', 'sample_rate', 'channels', 'duration_seconds', 'fps'])
        if (Number.isFinite(value.native_metadata[key]) && value.native_metadata[key] > 0)
          item.native_metadata[key] = value.native_metadata[key];
      for (const key of ['output_role', 'encoding_fidelity'])
        if (typeof value.native_metadata[key] === 'string' && value.native_metadata[key].length <= 64)
          item.native_metadata[key] = value.native_metadata[key];
    }
    const merged = { ...records.get(id), ...item };
    delete merged.content_url;
    if (['saved', 'temporary'].includes(merged.state) && merged.sha256 && merged.size_bytes)
      merged.content_url = artifactContentPath(id);
    records.set(id, merged);
  }
  return [...records.values()];
}

export function artifactReferences(values) {
  return normalizeArtifacts(values).map(({ artifact_id, kind, format }) => ({ artifact_id, kind, format }));
}

export function mergeArtifacts(...groups) {
  const records = new Map();
  for (const group of groups) for (const item of normalizeArtifacts(group))
    records.set(item.artifact_id, normalizeArtifacts([{ ...records.get(item.artifact_id), ...item }])[0]);
  return [...records.values()].slice(0, 64);
}

export function artifactContext({ retention, conversationId, messageId }) {
  if (!['none', '30_days', 'forever'].includes(retention)) throw new Error('Choose a valid history retention.');
  if (retention === 'none') {
    if (conversationId || messageId) throw new Error('Temporary output cannot bind to a saved chat.');
    return { retention };
  }
  if (typeof conversationId !== 'string' || !UUID.test(conversationId) ||
      typeof messageId !== 'string' || !messageId.trim() || messageId.length > 256)
    throw new Error('Save this chat before generating a retained output.');
  return { conversation_id: conversationId, message_id: messageId, retention };
}
