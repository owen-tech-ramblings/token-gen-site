const API_BASE = "https://token-gen-api.owenonthenet.com";
const $ = (selector) => document.querySelector(selector);

let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return Intl.NumberFormat("en-AU").format(Math.round(n));
}

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = n;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current >= 10 || unit === 0 ? Math.round(current) : current.toFixed(1)} ${units[unit]}`;
}

function formatMb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return `${formatNum(n)} MB`;
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return `${n.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatTokenRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return `${n.toFixed(1)} tok/s`;
}

function formatElapsedSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  if (n < 60) return `${Math.round(n)}s`;
  const minutes = Math.floor(n / 60);
  const seconds = Math.round(n % 60);
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

function formatWatts(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return `${n.toFixed(1)} W`;
}

function formatTemp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "-";
  return `${n.toFixed(1).replace(/\.0$/, "")} C`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const n = Number(value);
  const date = Number.isFinite(n) ? new Date(n < 10000000000 ? n * 1000 : n) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-AU");
}

function pct(used, total) {
  const u = Number(used);
  const t = Number(total);
  if (!Number.isFinite(u) || !Number.isFinite(t) || t <= 0) return undefined;
  return Math.max(0, Math.min(100, (u / t) * 100));
}

function meter(value) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="server-meter"><span style="width:${width}%"></span></div>`;
}

function chip(ok, label) {
  return `<span class="chip ${ok ? "chip-ok" : "chip-bad"}">${escapeHtml(label)}</span>`;
}

function table(rows) {
  return `<div class="table-wrap"><table class="table"><tbody>${rows.map(([label, value]) => `
    <tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value ?? "-")}</td></tr>
  `).join("")}</tbody></table></div>`;
}

function renderRawJson(label, payload) {
  return `
    <article class="project-card server-json-card">
      <div class="card-head"><h3>${escapeHtml(label)}</h3></div>
      <pre class="json-block">${escapeHtml(JSON.stringify(payload ?? {}, null, 2))}</pre>
    </article>
  `;
}

function formatFieldValue(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isInteger(value) ? formatNum(value) : String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function flattenFields(value, prefix = "") {
  if (!value || typeof value !== "object") return [[prefix || "value", value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenFields(item, `${prefix}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") return flattenFields(child, next);
    return [[next, child]];
  });
}

function renderObjectDetails(title, value) {
  const rows = flattenFields(value).map(([key, fieldValue]) => `
    <tr><td>${escapeHtml(key)}</td><td>${escapeHtml(formatFieldValue(fieldValue))}</td></tr>
  `).join("");
  return `
    <article class="project-card server-json-card">
      <div class="card-head"><h3>${escapeHtml(title)}</h3></div>
      <div class="table-wrap"><table class="table"><tbody>${rows}</tbody></table></div>
    </article>
  `;
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}?v=${Date.now()}`, { cache: "no-store" });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.body = body;
    throw err;
  }
  return { status: res.status, body };
}

function hasMonitorData(payload) {
  if (!payload || typeof payload !== "object") return false;
  return Boolean(payload.gpu || payload.vllm || payload.memory || payload.hostname || payload.services);
}

async function loadMonitorPayload() {
  const [health, publicStatus] = await Promise.all([
    fetchJson("/api/health"),
    fetchJson("/api/public-status"),
  ]);
  const payload = {
    loadedAt: new Date().toISOString(),
    health: health.body,
    statusCode: publicStatus.status,
    publicStatus: publicStatus.body?.data ?? publicStatus.body,
  };
  if (!hasMonitorData(payload.publicStatus)) {
    const err = new Error("Public status response did not include monitor data");
    err.payload = payload;
    throw err;
  }
  return payload;
}

function renderSummary(payload) {
  const data = payload.publicStatus || {};
  const gpu = data.gpu || {};
  const vllm = data.vllm || {};
  const memory = data.memory || {};
  const gpus = Array.isArray(gpu.gpus) ? gpu.gpus : [];
  const gpuMemPct = pct(gpu.memory_used_mb, gpu.memory_total_mb);
  const sysMemPct = pct(memory.used_bytes, memory.total_bytes);
  const avgUtil = gpus.length ? gpus.reduce((sum, item) => sum + (Number(item.utilization_percent) || 0), 0) / gpus.length : undefined;
  const maxTemp = Math.max(...gpus.map((item) => Number(item.temperature_c)).filter(Number.isFinite));
  const model = vllm.active_model || vllm.runtime_counters?.model_name || "-";
  const running = vllm.runtime_counters?.requests_running ?? "-";
  const waiting = vllm.runtime_counters?.requests_waiting ?? "-";

  $("#serverMonitorStats").innerHTML = `
    <article class="server-panel server-metric">
      <div class="label">vLLM</div>
      <div class="metric">${escapeHtml(model)}</div>
    </article>
    <article class="server-panel server-metric">
      <div class="label">GPU Memory</div>
      <div class="metric">${gpuMemPct === undefined ? "-" : formatPct(gpuMemPct)}</div>
      <p class="muted">${formatMb(gpu.memory_used_mb)} / ${formatMb(gpu.memory_total_mb)}</p>
    </article>
    <article class="server-panel server-metric">
      <div class="label">System Memory</div>
      <div class="metric">${sysMemPct === undefined ? "-" : formatPct(sysMemPct)}</div>
      <p class="muted">${formatBytes(memory.used_bytes)} / ${formatBytes(memory.total_bytes)}</p>
    </article>
    <article class="server-panel server-metric">
      <div class="label">GPU Util</div>
      <div class="metric">${avgUtil === undefined ? "-" : formatPct(avgUtil)}</div>
      <p class="muted">${formatNum(gpu.count ?? gpus.length)} devices</p>
    </article>
    <article class="server-panel server-metric">
      <div class="label">GPU Power</div>
      <div class="metric">${formatWatts(gpu.power_draw_watts)}</div>
      <p class="muted">Peak ${Number.isFinite(maxTemp) ? formatTemp(maxTemp) : "-"}</p>
    </article>
    <article class="server-panel server-metric">
      <div class="label">Requests</div>
      <div class="metric">${escapeHtml(running)} running</div>
      <p class="muted">${escapeHtml(waiting)} waiting</p>
    </article>
  `;
}

function renderStatus(payload) {
  const data = payload.publicStatus || {};
  const memory = data.memory || {};
  $("#serverStatusSummary").innerHTML = `
    <div class="server-monitor-grid">
      <article class="project-card">
        <div class="card-head"><h3>Connectivity</h3>${chip(true, "online")}</div>
        ${table([
          ["Health endpoint", payload.health?.ok === false ? "not ok" : "reachable"],
          ["Runtime API", API_BASE],
          ["Public status", `HTTP ${payload.statusCode}`],
          ["Loaded", formatDateTime(payload.loadedAt)],
        ])}
      </article>
      <article class="project-card">
        <h3>System</h3>
        ${table([
          ["Host", data.hostname],
          ["Timestamp", formatDateTime(data.timestamp)],
          ["Uptime seconds", data.uptime_seconds],
          ["Load average", Array.isArray(data.load_average) ? data.load_average.map((x) => Number(x).toFixed(2)).join(" / ") : undefined],
          ["Memory used", formatBytes(memory.used_bytes)],
          ["Memory total", formatBytes(memory.total_bytes)],
        ])}
        ${meter(pct(memory.used_bytes, memory.total_bytes))}
      </article>
    </div>
  `;
}

function renderGpuTable(payload) {
  const gpu = payload.publicStatus?.gpu || {};
  const gpus = Array.isArray(gpu.gpus) ? gpu.gpus : [];
  const rows = gpus.length ? gpus.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.index ?? index)}</td>
      <td>${escapeHtml(item.name ?? "-")}</td>
      <td>${escapeHtml(formatPct(item.utilization_percent))}</td>
      <td>${escapeHtml(`${formatMb(item.memory_used_mb)} / ${formatMb(item.memory_total_mb)}`)}</td>
      <td>${escapeHtml(formatTemp(item.temperature_c))}</td>
      <td>${escapeHtml(formatWatts(item.power_draw_watts))}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">No GPU list returned.</td></tr>`;

  $("#gpuStatusWrap").innerHTML = `
    <div class="server-monitor-grid mb-3">
      <article class="project-card">
        <h3>GPU totals</h3>
        ${table([
          ["Available", gpu.available],
          ["Count", gpu.count ?? gpus.length],
          ["Memory used", formatMb(gpu.memory_used_mb)],
          ["Memory total", formatMb(gpu.memory_total_mb)],
          ["Memory free", formatMb(gpu.memory_free_mb)],
          ["Power draw", formatWatts(gpu.power_draw_watts)],
        ])}
        ${meter(pct(gpu.memory_used_mb, gpu.memory_total_mb))}
      </article>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>GPU</th><th>Util</th><th>Memory</th><th>Temp</th><th>Power</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  `;
}

function renderVllm(payload) {
  const vllm = payload.publicStatus?.vllm || {};
  const counters = vllm.runtime_counters || {};
  const rates = vllm.token_rates || {};
  $("#vllmStatusWrap").innerHTML = `
    <div class="server-monitor-grid">
      <article class="project-card">
        <h3>Runtime</h3>
        ${table([
          ["Active model", vllm.active_model],
          ["Model path", counters.model_name],
          ["Tensor parallel", vllm.tensor_parallel_size],
          ["Pipeline parallel", vllm.pipeline_parallel_size],
          ["Max model length", vllm.max_model_len],
          ["Running requests", counters.requests_running],
          ["Waiting requests", counters.requests_waiting],
          ["KV cache", formatPct(counters.kv_cache_usage_percent)],
        ])}
      </article>
      <article class="project-card">
        <h3>Counters</h3>
        ${table([
          ["Prompt tokens", formatNum(counters.prompt_tokens)],
          ["Generation tokens", formatNum(counters.generation_tokens)],
          ["Total tokens", formatNum(counters.total_tokens)],
          ["Successful requests", formatNum(counters.request_success_total)],
          ["Errored requests", formatNum(counters.request_error_total)],
          ["Aborted requests", formatNum(counters.request_abort_total)],
        ])}
      </article>
    </div>
  `;

  const windows = ["1m", "10m", "1h", "1d"];
  $("#tokenRatesWrap").innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Window</th><th>Total tok/s</th><th>Prompt tok/s</th><th>Generation tok/s</th><th>Elapsed</th></tr></thead>
      <tbody>${windows.map((key) => {
        const row = rates[key] || {};
        return `<tr>
          <td>${escapeHtml(key)}</td>
          <td>${escapeHtml(formatTokenRate(row.total_tokens_per_second))}</td>
          <td>${escapeHtml(formatTokenRate(row.prompt_tokens_per_second))}</td>
          <td>${escapeHtml(formatTokenRate(row.generation_tokens_per_second))}</td>
          <td>${escapeHtml(formatElapsedSeconds(row.elapsed_seconds))}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function renderServices(payload) {
  const services = Array.isArray(payload.publicStatus?.services) ? payload.publicStatus.services : [];
  const rows = services.length ? services.map((service) => `
    <tr><td>${escapeHtml(service.name ?? "-")}</td><td>${escapeHtml(service.active ?? "-")}</td><td>${escapeHtml(service.enabled ?? "-")}</td></tr>
  `).join("") : `<tr><td colspan="3">No service list returned.</td></tr>`;
  $("#serverInfrastructureWrap").innerHTML = `
    <div class="server-monitor-grid">
      <article class="project-card">
        <h3>Services</h3>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Name</th><th>Active</th><th>Enabled</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </article>
      <article class="project-card">
        <h3>Network</h3>
        ${table([
          ["Host", payload.publicStatus?.hostname],
          ["API", API_BASE],
        ])}
      </article>
    </div>
  `;
}

function renderTemperatures(payload) {
  const gpus = Array.isArray(payload.publicStatus?.gpu?.gpus) ? payload.publicStatus.gpu.gpus : [];
  const rows = gpus.length ? gpus.map((gpu, index) => `
    <tr><td>${escapeHtml(gpu.index ?? index)}</td><td>${escapeHtml(gpu.name ?? "-")}</td><td>${escapeHtml(formatTemp(gpu.temperature_c))}</td></tr>
  `).join("") : `<tr><td colspan="3">No GPU temperature data returned.</td></tr>`;
  $("#temperatureStatusWrap").innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>GPU</th><th>Name</th><th>Temp</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  `;
}

function renderLaunchAndStorage(payload) {
  const vllm = payload.publicStatus?.vllm || {};
  const rates = vllm.token_rates || {};
  const storage = rates.storage;
  $("#vllmLaunchWrap").innerHTML = `
    <div class="server-monitor-grid">
      <article class="project-card">
        <h3>Launch</h3>
        ${table([
          ["Tensor parallel", vllm.tensor_parallel_size],
          ["Pipeline parallel", vllm.pipeline_parallel_size],
          ["Max model length", vllm.max_model_len],
        ])}
      </article>
      <article class="project-card">
        <h3>Token-rate storage</h3>
        ${storage ? table([
          ["Mode", rates.storage?.mode],
          ["Database", rates.storage?.database],
          ["Primary database", rates.storage?.primary_database],
          ["Fallback database", rates.storage?.fallback_database],
        ]) : `<p class="muted">No token-rate storage data is included in public-status. Storage details are available only from authenticated API endpoints.</p>`}
      </article>
    </div>
  `;
}

function renderRaw(payload) {
  $("#serverRawSnapshots").innerHTML = `
    <div class="server-monitor-grid">
      ${renderRawJson("Health", payload.health)}
      ${renderRawJson("Public status", payload.publicStatus)}
      ${renderObjectDetails("All public-status fields", payload.publicStatus)}
    </div>
  `;
}

function renderPayload(payload, state = "good") {
  renderSummary(payload);
  renderStatus(payload);
  renderGpuTable(payload);
  renderTemperatures(payload);
  renderVllm(payload);
  renderLaunchAndStorage(payload);
  renderServices(payload);
  renderRaw(payload);

  const freshness = $("#serverMonitorFreshness");
  freshness.dataset.state = state;
  if (state === "good") {
    freshness.textContent = `Updated ${formatDateTime(payload.loadedAt)} - public status online`;
  }
}

function renderError(error) {
  const freshness = $("#serverMonitorFreshness");
  freshness.dataset.state = "bad";
  freshness.textContent = `Monitor API unavailable - ${error.message}`;
  $("#serverMonitorStats").innerHTML = `
    <article class="server-panel server-metric server-full">
      <div class="label warn">Monitor API unavailable</div>
      <div class="metric">No API data loaded</div>
      <p class="muted">${escapeHtml(API_BASE)}/api/public-status</p>
    </article>
  `;
  [
    "serverStatusSummary",
    "gpuStatusWrap",
    "temperatureStatusWrap",
    "vllmStatusWrap",
    "tokenRatesWrap",
    "vllmLaunchWrap",
    "serverInfrastructureWrap",
    "serverRawSnapshots",
  ].forEach((id) => {
    const node = $(`#${id}`);
    if (node) node.innerHTML = "";
  });
}

async function refreshMonitor() {
  const button = $("#serverMonitorRefresh");
  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing...";
  }
  try {
    const payload = await loadMonitorPayload();
    renderPayload(payload);
  } catch (error) {
    renderError(error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Refresh";
    }
  }
}

function start() {
  $("#serverMonitorRefresh")?.addEventListener("click", refreshMonitor);
  refreshMonitor();
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") refreshMonitor();
  }, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshMonitor();
  });
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer) clearInterval(refreshTimer);
});

start();
