const MIB = 1024 * 1024;
const GIB = 1024 ** 3;

export const DEFAULT_PROJECT_VIDEO_CONTRACT = Object.freeze({
  available: true,
  chunkBytes: 32 * MIB,
  maxFileBytes: 4 * GIB,
  maxDurationSeconds: 1800,
  acceptedMimeTypes: Object.freeze([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
  ]),
});

const VIDEO_TYPES_BY_EXTENSION = Object.freeze({
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
});

const EXPECTED_UPLOAD_ROUTES = Object.freeze({
  create_route: "/api/projects/{project_id}/video-uploads",
  status_abort_route: "/api/projects/{project_id}/video-uploads/{upload_id}",
  chunk_route: "/api/projects/{project_id}/video-uploads/{upload_id}/chunks/{index}",
  complete_route: "/api/projects/{project_id}/video-uploads/{upload_id}/complete",
});

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function resolveProjectVideoContract(discovery = {}) {
  const video = discovery?.capabilities?.video;
  if (!video || typeof video !== "object") return { ...DEFAULT_PROJECT_VIDEO_CONTRACT };
  const upload = video.upload && typeof video.upload === "object" ? video.upload : {};
  const routesMatch = Object.entries(EXPECTED_UPLOAD_ROUTES).every(([key, route]) => (
    upload[key] === undefined || upload[key] === route
  ));
  const accepted = Array.isArray(video.accepted_mime_types)
    ? video.accepted_mime_types.filter((value) => DEFAULT_PROJECT_VIDEO_CONTRACT.acceptedMimeTypes.includes(value))
    : [];
  return {
    available: video.available !== false && routesMatch,
    chunkBytes: positiveInteger(upload.chunk_bytes, DEFAULT_PROJECT_VIDEO_CONTRACT.chunkBytes),
    maxFileBytes: positiveInteger(upload.max_file_bytes, DEFAULT_PROJECT_VIDEO_CONTRACT.maxFileBytes),
    maxDurationSeconds: positiveInteger(video.max_duration_seconds, DEFAULT_PROJECT_VIDEO_CONTRACT.maxDurationSeconds),
    acceptedMimeTypes: accepted.length ? [...new Set(accepted)] : [...DEFAULT_PROJECT_VIDEO_CONTRACT.acceptedMimeTypes],
  };
}

export function formatVideoBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < MIB) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < GIB) return `${(bytes / MIB).toFixed(bytes < 10 * MIB ? 1 : 0)} MB`;
  return `${(bytes / GIB).toFixed(1)} GB`;
}

function projectVideoMimeType(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  const expected = VIDEO_TYPES_BY_EXTENSION[extension] || "";
  return file?.type && file.type !== expected ? "" : expected;
}

export function projectVideoFileProblem(file, contract = DEFAULT_PROJECT_VIDEO_CONTRACT) {
  if (!file) return "Choose an MP4, WebM, MOV, or MKV video.";
  const mimeType = projectVideoMimeType(file);
  if (!mimeType || !contract.acceptedMimeTypes.includes(mimeType)) {
    return "Choose an MP4, WebM, MOV, or MKV video.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "The selected video is empty.";
  if (file.size > contract.maxFileBytes) {
    return `${file.name} is larger than ${formatVideoBytes(contract.maxFileBytes)}.`;
  }
  return "";
}

export function projectVideoUploadPresentation(state = {}) {
  const fileName = String(state.fileName || "video");
  const progress = Math.max(0, Math.min(100, Math.trunc(Number(state.percent) || 0)));
  if (state.phase === "failed") {
    return { label: `Upload paused for ${fileName} / ${progress}%`, state: "bad", progress, canResume: true, canAbort: true };
  }
  if (state.phase === "processing") {
    return { label: `Validating ${fileName} and queuing private analysis...`, state: "busy", progress: 100, canResume: false, canAbort: true };
  }
  const action = state.phase === "uploading" ? "Uploading" : "Checking";
  return { label: `${action} ${fileName} / ${progress}%`, state: "busy", progress, canResume: false, canAbort: true };
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

class Sha256 {
  constructor() {
    this.state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.bytesHashed = 0;
    this.words = new Uint32Array(64);
  }

  update(bytes) {
    this.bytesHashed += bytes.length;
    let offset = 0;
    while (offset < bytes.length) {
      const length = Math.min(bytes.length - offset, 64 - this.bufferLength);
      this.buffer.set(bytes.subarray(offset, offset + length), this.bufferLength);
      this.bufferLength += length;
      offset += length;
      if (this.bufferLength === 64) {
        this.process(this.buffer);
        this.bufferLength = 0;
      }
    }
  }

  process(block) {
    const words = this.words;
    for (let index = 0; index < 16; index += 1) {
      const offset = index * 4;
      words[index] = ((block[offset] << 24) | (block[offset + 1] << 16) | (block[offset + 2] << 8) | block[offset + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const before15 = words[index - 15];
      const before2 = words[index - 2];
      const sigma0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
      const sigma1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const first = (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const second = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0;
      d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      this.state[index] = (this.state[index] + value) >>> 0;
    });
  }

  hex() {
    const finalLength = this.bufferLength < 56 ? 64 : 128;
    const finalBlock = new Uint8Array(finalLength);
    finalBlock.set(this.buffer.subarray(0, this.bufferLength));
    finalBlock[this.bufferLength] = 0x80;
    const bitHigh = Math.floor(this.bytesHashed / 0x20000000);
    const bitLow = (this.bytesHashed << 3) >>> 0;
    const view = new DataView(finalBlock.buffer);
    view.setUint32(finalLength - 8, bitHigh, false);
    view.setUint32(finalLength - 4, bitLow, false);
    for (let offset = 0; offset < finalLength; offset += 64) this.process(finalBlock.subarray(offset, offset + 64));
    return Array.from(this.state, (word) => word.toString(16).padStart(8, "0")).join("");
  }
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

export async function sha256Blob(blob, { chunkBytes = 32 * MIB, onProgress = () => {}, signal } = {}) {
  const hasher = new Sha256();
  const size = Number(blob?.size || 0);
  for (let start = 0; start < size; start += chunkBytes) {
    throwIfAborted(signal);
    const end = Math.min(size, start + chunkBytes);
    const bytes = new Uint8Array(await blob.slice(start, end).arrayBuffer());
    throwIfAborted(signal);
    hasher.update(bytes);
    onProgress({ phase: "hashing", completedBytes: end, totalBytes: size, percent: Math.floor(end / size * 100) });
  }
  return hasher.hex();
}

function sessionMatchesFile(session, file, projectId) {
  const mimeType = projectVideoMimeType(file);
  return session
    && session.projectId === projectId
    && session.filename === file.name
    && session.mimeType === mimeType
    && session.sizeBytes === file.size;
}

export async function uploadProjectVideo({
  file,
  projectId,
  request,
  contract = DEFAULT_PROJECT_VIDEO_CONTRACT,
  session = null,
  onSession = () => {},
  onProgress = () => {},
  signal,
}) {
  const problem = projectVideoFileProblem(file, contract);
  if (problem) throw new Error(problem);
  if (!projectId) throw new Error("Choose a project before uploading a video.");
  let activeSession = sessionMatchesFile(session, file, projectId) ? { ...session } : null;
  if (!activeSession) {
    const mimeType = projectVideoMimeType(file);
    const sha256 = await sha256Blob(file, { chunkBytes: contract.chunkBytes, onProgress, signal });
    throwIfAborted(signal);
    const { json } = await request(`/${encodeURIComponent(projectId)}/video-uploads`, {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mime_type: mimeType, size_bytes: file.size, sha256 }),
      signal,
    });
    if (!json?.upload?.id) throw new Error("Project video upload returned an invalid response.");
    activeSession = {
      id: json.upload.id,
      projectId,
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      sha256,
    };
    onSession(activeSession);
  }

  const base = `/${encodeURIComponent(projectId)}/video-uploads/${encodeURIComponent(activeSession.id)}`;
  const { json: statusJson } = await request(base, { signal });
  const upload = statusJson?.upload;
  if (!upload?.id) throw new Error("Project video upload status returned an invalid response.");
  const chunkBytes = positiveInteger(upload.chunk_bytes, contract.chunkBytes);
  const totalChunks = positiveInteger(upload.total_chunks, Math.ceil(file.size / chunkBytes));
  const received = new Set(Array.isArray(upload.received_chunks) ? upload.received_chunks.map(Number) : []);
  let uploadedBytes = 0;
  for (const index of received) {
    if (Number.isInteger(index) && index >= 0 && index < totalChunks) {
      uploadedBytes += Math.min(chunkBytes, file.size - index * chunkBytes);
    }
  }
  onProgress({ phase: "uploading", completedBytes: uploadedBytes, totalBytes: file.size, percent: Math.floor(uploadedBytes / file.size * 100) });
  for (let index = 0; index < totalChunks; index += 1) {
    if (received.has(index)) continue;
    throwIfAborted(signal);
    const start = index * chunkBytes;
    const end = Math.min(file.size, start + chunkBytes);
    await request(`${base}/chunks/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file.slice(start, end),
      signal,
    });
    uploadedBytes += end - start;
    onProgress({ phase: "uploading", completedBytes: uploadedBytes, totalBytes: file.size, percent: Math.floor(uploadedBytes / file.size * 100) });
  }
  onProgress({ phase: "processing", completedBytes: file.size, totalBytes: file.size, percent: 100 });
  const { json } = await request(`${base}/complete`, { method: "POST", signal });
  if (!json?.document?.id || !json?.job?.id) throw new Error("Project video completion returned an invalid response.");
  onSession(null);
  return json;
}
