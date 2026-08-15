import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("scanned PDF handoff retains only the current file until an explicit project upload", async () => {
  const { scannedPdfProjectAction } = await import("../chat-scanned-pdf-handoff.mjs");
  const file = { name: "scan.pdf", size: 123 };
  assert.deepEqual(scannedPdfProjectAction(file, null), { kind: "choose_project" });
  assert.deepEqual(scannedPdfProjectAction(file, { id: "project-1" }), { kind: "upload", files: [file] });
  assert.deepEqual(scannedPdfProjectAction(null, { id: "project-1" }), { kind: "none" });
});

test("chat renders a real scanned-PDF project action and clears the in-memory handoff", () => {
  const source = fs.readFileSync(new URL("../chat.js", import.meta.url), "utf8");
  assert.match(source, /data-scanned-pdf-add/);
  assert.match(source, /uploadProjectDocuments\(action\.files\)/);
  assert.match(source, /pendingScannedPdf = null/);
  assert.match(source, /pagehide/);
});
