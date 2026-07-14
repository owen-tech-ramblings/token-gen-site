import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "..");
const sourceDirectory = resolve(repositoryRoot, "games", "vampire-survival-src");
const templatePath = resolve(sourceDirectory, "template.html");
const outputPath = resolve(repositoryRoot, "games", "vampire-survival.html");

const moduleFiles = [
  ["/*__RUNTIME_MODULE__*/", "runtime.mjs"],
  ["/*__CONTENT_MODULE__*/", "content.mjs"],
  ["/*__PROFILE_MODULE__*/", "profile.mjs"],
  ["/*__CLOUD_SYNC_MODULE__*/", "cloud-sync.mjs"],
  ["/*__PROGRESSION_MODULE__*/", "progression.mjs"],
  ["/*__STATE_MODULE__*/", "state.mjs"],
  ["/*__WORLD_MODULE__*/", "world.mjs"],
  ["/*__GAMEPLAY_MODULE__*/", "gameplay.mjs"],
  ["/*__RENDERING_MODULE__*/", "rendering.mjs"],
  ["/*__INPUT_MODULE__*/", "input.mjs"],
  ["/*__TEST_ADAPTER_MODULE__*/", "test-adapter.mjs"],
];

function inlineModule(source, filename) {
  const withoutExports = source.replace(/^export\s+/gm, "");
  if (/^\s*import\s/m.test(withoutExports)) {
    throw new Error(`${filename} contains an import; source modules must remain independently inlineable`);
  }
  return `/* source: vampire-survival-src/${filename} */\n${withoutExports.trim()}`;
}

async function render() {
  let html = await readFile(templatePath, "utf8");
  for (const [marker, filename] of moduleFiles) {
    const occurrences = html.split(marker).length - 1;
    if (occurrences !== 1) throw new Error(`Expected one ${marker} marker, found ${occurrences}`);
    const source = await readFile(resolve(sourceDirectory, filename), "utf8");
    html = html.replace(marker, inlineModule(source, filename));
  }
  if (html.includes("/*__") || /<script\s+[^>]*src=/i.test(html)) {
    throw new Error("Generated game contains an unresolved marker or external runtime script");
  }
  return html.endsWith("\n") ? html : `${html}\n`;
}

async function atomicWrite(path, contents) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, path);
}

const html = await render();
const digest = createHash("sha256").update(html).digest("hex");
const iterationMatch = html.match(/iteration:\s*(\d+)/);
if (!iterationMatch) throw new Error("Generated game does not declare BUILD.iteration");
const iteration = Number(iterationMatch[1]);
if (!Number.isSafeInteger(iteration) || iteration < 1) throw new Error("Generated game declares an invalid iteration");
const archiveName = `iteration-${iteration}-codex.html`;
const archivePath = resolve(repositoryRoot, "games", "vampire-survival-iterations", archiveName);

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8");
  if (current !== html) {
    console.error("vampire-survival.html is stale; run node tools/build-vampire-survival.mjs");
    process.exitCode = 1;
  } else {
    console.log(`vampire-survival.html is current (${digest.slice(0, 12)})`);
  }
} else {
  await atomicWrite(outputPath, html);
  if (process.argv.includes("--archive")) await atomicWrite(archivePath, html);
  console.log(`Built vampire-survival.html (${Buffer.byteLength(html)} bytes, sha256 ${digest})`);
  if (process.argv.includes("--archive")) console.log(`Archived ${archiveName}`);
}
