import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = "/home/jesse/.openclaw/workspace/token-gen-site-pages";
const seedPath = "/mnt/c/Users/User/Documents/vampire_game.html";
const gamePath = path.join(repo, "games/vampire-survival.html");
const iterDir = path.join(repo, "games/vampire-survival-iterations");
const logPath = path.join(iterDir, "iteration-log.md");
const modelBase = "http://100.98.87.102:8000";
const iterations = Number(process.env.ITERATIONS || 20);

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: repo, stdio: "pipe", encoding: "utf8", ...opts });
}

function commitIfStaged(message) {
  try {
    run("git", ["diff", "--cached", "--quiet"]);
    return false;
  } catch {
    run("git", ["commit", "-m", message]);
    run("git", ["push"]);
    return true;
  }
}

async function fetchJson(url, options = {}, timeoutMs = null) {
  const controller = timeoutMs ? new AbortController() : null;
  const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, controller ? { ...options, signal: controller.signal } : options);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Non-JSON response: ${text.slice(0, 500)}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    return data;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) throw new Error("No HTML document found in model response");
  const html = raw.slice(start).trim();
  const end = html.toLowerCase().lastIndexOf("</html>");
  return end >= 0 ? html.slice(0, end + 7) : html;
}

function validateHtml(html) {
  const checks = [
    [/<!doctype html/i, "doctype"],
    [/<html[\s>]/i, "html tag"],
    [/<head[\s>]/i, "head tag"],
    [/<body[\s>]/i, "body tag"],
    [/<canvas|<svg|game-container|game/i, "game surface"],
    [/<script[\s>]/i, "script tag"],
    [/blood/i, "blood mechanic"],
    [/human/i, "human mechanic"],
    [/vampire/i, "vampire mechanic"],
    [/<\/html>/i, "closing html"],
  ];
  const missing = checks.filter(([re]) => !re.test(html)).map(([, name]) => name);
  if (missing.length) throw new Error(`HTML validation failed: missing ${missing.join(", ")}`);
  if (html.length < 5000) throw new Error(`HTML validation failed: too short (${html.length} bytes)`);
}

async function getModel() {
  const models = await fetchJson(`${modelBase}/v1/models`, {}, 20000);
  return models.data?.[0]?.id || "/home/zenfree/token_gen_server/vllm/models/Qwen-Qwen3.6-27B-FP8";
}

function promptFor(iteration, currentHtml) {
  const largeFile = currentHtml.length > 35000;
  const largeFileGuidance = largeFile
    ? `
IMPORTANT COMPACTION MODE:
- The current file is too large. Your top priority is to rebuild it into a COMPLETE, smaller standalone game under 28,000 characters.
- Preserve the core gameplay and the best existing features, but remove duplicate code, verbose CSS, comments, excessive particles, and low-value UI.
- Add only ONE small improvement this iteration after compaction.
- The response is a failure if it does not include the final </html> closing tag.
- Use concise CSS and JavaScript. Prefer compact helper functions and simple canvas drawing.
`
    : "";
  const currentContext = largeFile
    ? `Current feature brief:
- Vampire Survival is a standalone canvas game.
- Player is the vampire and survives by keeping blood above zero.
- WASD/arrows move; mouse/click feeding is supported.
- Humans spawn and chase/defend over time.
- Human defenses improve as time passes.
- Current accepted version includes richer UI, survival timer, blood bar, defense progression, feeding effects, dash/mist style special abilities, particles, level/XP style progression, and iteration notes.
- For iteration ${iteration}, compact the implementation, preserve the best of those mechanics, and add one focused improvement.`
    : `Current HTML:
${currentHtml}`;
  return `You are iterating a single-file browser game called Vampire Survival.
Return ONLY the complete updated HTML document. No markdown except a single html code fence is allowed.

Iteration ${iteration} goal:
- Preserve the game as a standalone HTML file with inline CSS and JS.
- Improve gameplay, UI, graphics, feedback, balance, or progression.
- Keep controls playable with keyboard/mouse.
- Keep the player as a vampire; humans improve defenses over time; blood must stay above zero.
- Add a visible "Iteration ${iteration}" note in the UI or title screen.
- Prefer basic but engaging pixel/canvas art and clear game feel.
- Do not use external libraries, remote assets, or network calls.
- Keep the full output compact and complete. Target 18k-26k characters. Do not add verbose comments, long explanations, or unused systems.
- Make a focused improvement pass rather than rewriting everything larger.
- If the current file has grown large, refactor and compress it while preserving features. A shorter complete game is better than a larger incomplete document.
- Hard cap: keep the final HTML under 45k characters.
${largeFileGuidance}

Player/UAT feedback driving iterations 11-20:
- Humans must not sit on the map edges waiting for the vampire. They should roam, patrol, investigate, flee, regroup, fortify, or hunt even when far away from the player.
- Progression must be visually obvious during play: human tiers, armor/shields/torches, district changes, escalating defenses, phase banners, stronger HUD alerts, and clearer feedback.
- Add a visible high-score or leaderboard panel using localStorage, with survival time/score and a way to restart and beat prior runs.
- The environment should not feel like a static image. Add animated/dynamic districts, hazards, lighting, fog/weather/day-night/blood moon changes, sanctified zones, props, or other visible state changes.
- Improve from a C-grade prototype toward a B-grade game: clearer purpose, better moment-to-moment decisions, readable tactical threats, stronger feedback, and more polished UI/graphics.
- You cannot browse the internet directly. If an external asset would help, use procedural pixel/canvas art instead and keep the game fully playable offline.
- Codex is only the facilitator and publisher. You are the designer and developer for each iteration.

${currentContext}`;
}

async function qwenImprove(model, iteration, currentHtml) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: "You are a senior browser-game engineer. Think carefully, then provide only a complete valid standalone HTML document in the final answer.",
      },
      { role: "user", content: promptFor(iteration, currentHtml) },
    ],
    temperature: 0.45,
    max_tokens: 16000,
    stream: true,
    chat_template_kwargs: { enable_thinking: true },
  };
  const res = await fetch(`${modelBase}/v1/chat/completions`, {
    method: "POST",
    headers: { accept: "text/event-stream", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`VLLM stream failed HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let chunks = 0;
  let lastLog = Date.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      const data = dataLines.join("\n");
      if (data === "[DONE]") continue;
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = chunk.choices?.[0]?.delta || {};
      if (typeof delta.content === "string") content += delta.content;
      if (typeof delta.reasoning === "string") reasoning += delta.reasoning;
      if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content;
      chunks += 1;
    }
    if (Date.now() - lastLog > 30000) {
      console.log(`ITERATION ${iteration}: streaming ${chunks} chunks, content ${content.length} chars, reasoning ${reasoning.length} chars`);
      lastLog = Date.now();
    }
  }

  return content || reasoning;
}

async function publish(iteration, html, summary) {
  await fs.writeFile(gamePath, html, "utf8");
  await fs.writeFile(path.join(iterDir, `iteration-${String(iteration).padStart(2, "0")}.html`), html, "utf8");
  await fs.appendFile(logPath, `\n## Iteration ${iteration}\n\n${summary}\n\nBytes: ${html.length}\n`, "utf8");
  run("git", ["add", "games/vampire-survival.html", "games/vampire-survival-iterations"]);
  commitIfStaged(`Vampire Survival iteration ${iteration}`);
}

async function main() {
  await fs.mkdir(iterDir, { recursive: true });
  let currentHtml = await fs.readFile(seedPath, "utf8");
  let startIteration = 1;
  try {
    currentHtml = await fs.readFile(gamePath, "utf8");
    const names = await fs.readdir(iterDir);
    const accepted = names
      .map((name) => name.match(/^iteration-(\d+)\.html$/)?.[1])
      .filter(Boolean)
      .map(Number);
    if (accepted.length) startIteration = Math.max(...accepted) + 1;
  } catch {}
  validateHtml(currentHtml);
  try {
    await fs.access(logPath);
  } catch {
    await fs.writeFile(logPath, "# Vampire Survival Qwen Iterations\n", "utf8");
  }
  const model = await getModel();
  if (startIteration === 1) {
    await fs.appendFile(logPath, `\nModel: ${model}\n\nSeed: ${seedPath}\n`, "utf8");
    await fs.writeFile(gamePath, currentHtml, "utf8");
    await fs.writeFile(path.join(iterDir, "iteration-00-seed.html"), currentHtml, "utf8");
    run("git", ["add", "games/vampire-survival.html", "games/vampire-survival-iterations", "tools/qwen-vampire-iterate.mjs"]);
    commitIfStaged("Publish Vampire Survival seed");
  } else {
    run("git", ["add", "tools/qwen-vampire-iterate.mjs"]);
    commitIfStaged("Update Vampire Survival iteration runner");
  }

  for (let i = startIteration; i <= iterations; i += 1) {
    console.log(`ITERATION ${i}: requesting Qwen update`);
    let nextHtml = null;
    let error = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const response = await qwenImprove(model, i, currentHtml);
        nextHtml = extractHtml(response);
        validateHtml(nextHtml);
        break;
      } catch (err) {
        error = err;
        console.log(`ITERATION ${i}: attempt ${attempt} failed: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }
    if (!nextHtml) throw error || new Error(`Iteration ${i} failed`);
    const summary = `Accepted Qwen pass ${i}. Light validation passed: standalone HTML, script, canvas/game surface, vampire/human/blood mechanics. UAT focus for this tranche: roaming humans, clearer progression, high scores, dynamic environment, and stronger game feel.`;
    await publish(i, nextHtml, summary);
    currentHtml = nextHtml;
    console.log(`ITERATION ${i}: published ${nextHtml.length} bytes`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
