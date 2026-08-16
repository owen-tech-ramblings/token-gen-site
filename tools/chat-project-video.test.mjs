import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROJECT_VIDEO_CONTRACT,
  projectVideoFileProblem,
  projectVideoUploadPresentation,
  resolveProjectVideoContract,
  sha256Blob,
  uploadProjectVideo,
} from "../chat-project-video.mjs";

function videoFile(bytes, name = "clip.mp4", type = "video/mp4") {
  const blob = new Blob([bytes], { type });
  Object.defineProperty(blob, "name", { value: name });
  return blob;
}

test("video discovery overrides only valid public limits and keeps the fixed route family", () => {
  const discovered = resolveProjectVideoContract({ capabilities: { video: {
    available: true,
    max_duration_seconds: 1200,
    accepted_mime_types: ["video/mp4", "video/webm"],
    upload: {
      chunk_bytes: 8 * 1024 * 1024,
      max_file_bytes: 2 * 1024 ** 3,
      create_route: "/api/projects/{project_id}/video-uploads",
      status_abort_route: "/api/projects/{project_id}/video-uploads/{upload_id}",
      chunk_route: "/api/projects/{project_id}/video-uploads/{upload_id}/chunks/{index}",
      complete_route: "/api/projects/{project_id}/video-uploads/{upload_id}/complete",
    },
  } } });

  assert.deepEqual(discovered, {
    ...DEFAULT_PROJECT_VIDEO_CONTRACT,
    available: true,
    maxDurationSeconds: 1200,
    maxFileBytes: 2 * 1024 ** 3,
    chunkBytes: 8 * 1024 * 1024,
    acceptedMimeTypes: ["video/mp4", "video/webm"],
  });
  assert.deepEqual(resolveProjectVideoContract({}), DEFAULT_PROJECT_VIDEO_CONTRACT);
});

test("upload presentation exposes hashing, resumable failure, and private processing states", () => {
  assert.deepEqual(projectVideoUploadPresentation({ fileName: "demo.mp4", phase: "hashing", percent: 42 }), {
    label: "Checking demo.mp4 / 42%",
    state: "busy",
    progress: 42,
    canResume: false,
    canAbort: true,
  });
  assert.deepEqual(projectVideoUploadPresentation({ fileName: "demo.mp4", phase: "failed", percent: 66 }), {
    label: "Upload paused for demo.mp4 / 66%",
    state: "bad",
    progress: 66,
    canResume: true,
    canAbort: true,
  });
  assert.equal(projectVideoUploadPresentation({ fileName: "demo.mp4", phase: "processing", percent: 100 }).label,
    "Validating demo.mp4 and queuing private analysis...");
});

test("project video validation accepts the four private containers and enforces the discovered byte limit", () => {
  const contract = { ...DEFAULT_PROJECT_VIDEO_CONTRACT, maxFileBytes: 4 };
  assert.equal(projectVideoFileProblem(videoFile("1234"), contract), "");
  assert.equal(projectVideoFileProblem(videoFile("1", "clip.webm", "video/webm"), contract), "");
  assert.equal(projectVideoFileProblem(videoFile("1", "clip.mov", "video/quicktime"), contract), "");
  assert.equal(projectVideoFileProblem(videoFile("1", "clip.mkv", "video/x-matroska"), contract), "");
  assert.equal(projectVideoFileProblem(videoFile("1", "camera.mov", ""), contract), "", "the extension supplies a browser-omitted MIME type");
  assert.match(projectVideoFileProblem(videoFile("12345"), contract), /larger than 4 B/);
  assert.match(projectVideoFileProblem(videoFile("1", "clip.avi", "video/x-msvideo"), contract), /MP4, WebM, MOV, or MKV/);
});

test("video hashing reads bounded slices and returns the standard SHA-256 digest", async () => {
  const reads = [];
  const source = videoFile("abc");
  const blob = {
    size: source.size,
    slice(start, end) {
      reads.push([start, end]);
      return source.slice(start, end);
    },
  };
  const progress = [];
  const digest = await sha256Blob(blob, { chunkBytes: 2, onProgress: (value) => progress.push(value.completedBytes) });
  assert.equal(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.deepEqual(reads, [[0, 2], [2, 3]]);
  assert.deepEqual(progress, [2, 3]);
});

test("resumable video upload asks for status, skips received chunks, and completes once", async () => {
  const file = videoFile("abcdefghij");
  const calls = [];
  const progress = [];
  const session = {
    id: "upload-1",
    projectId: "project-1",
    filename: "clip.mp4",
    mimeType: "video/mp4",
    sizeBytes: 10,
    sha256: "unused-on-resume",
  };
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || "GET", body: options.body });
    if (!options.method) return { json: { ok: true, upload: { id: "upload-1", chunk_bytes: 4, total_chunks: 3, received_chunks: [1] } } };
    if (options.method === "PUT") return { json: { ok: true, upload: { id: "upload-1" } } };
    return { json: { ok: true, document: { id: "upload-1", media_class: "video" }, job: { id: "job-1", kind: "project_video_analysis" } } };
  };

  const result = await uploadProjectVideo({
    file,
    projectId: "project-1",
    request,
    session,
    contract: { ...DEFAULT_PROJECT_VIDEO_CONTRACT, chunkBytes: 4 },
    onProgress: (value) => progress.push(value),
  });

  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    ["/project-1/video-uploads/upload-1", "GET"],
    ["/project-1/video-uploads/upload-1/chunks/0", "PUT"],
    ["/project-1/video-uploads/upload-1/chunks/2", "PUT"],
    ["/project-1/video-uploads/upload-1/complete", "POST"],
  ]);
  assert.equal(await calls[1].body.text(), "abcd");
  assert.equal(await calls[2].body.text(), "ij");
  assert.equal(progress.at(-1).phase, "processing");
  assert.equal(result.document.media_class, "video");
  assert.equal(result.job.kind, "project_video_analysis");
});
