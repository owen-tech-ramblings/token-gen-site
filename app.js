const $ = (s) => document.querySelector(s);

const MODEL_ALIASES = {
  "openai_gpt5": "openai-gpt-5",
  "openai-gpt-5": "openai-gpt-5",
  "gpt-5": "openai-gpt-5",
  "gemini25flash": "gemini-2.5-flash",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini25": "gemini-2.5-flash"
};

const STATUS = [
  { id: "inbox", title: "Inbox" },
  { id: "ready", title: "Ready" },
  { id: "in_progress", title: "In Progress" },
  { id: "blocked", title: "Blocked" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
  { id: "archived", title: "Archived" }
];
const OPEN_STATUSES = new Set(["inbox", "ready", "in_progress", "blocked", "review"]);
const LANE_STATE_KEY = "lilzen-kanban-visible-states-v1";
const DEFAULT_VISIBLE_LANES = ["inbox", "ready", "in_progress", "blocked", "review"];
const TASK_KEY = "lilzen-control-pane-tasks-v2";
const ACTIVE_DAYS = 106; // ~3.5 months
const BUILD_ID = "20260330-operator-email-summary-1";
let TOKEN_PERIOD = "ytd";
let refreshTimer = null;
const TOKEN_FILTERS = {
  agent: [],
  project: [],
  channel: [],
  provider: [],
  model: [],
  tool: [],
  dow: "all",
  hour: "all",
};

async function loadJson(path) {
  const sep = String(path).includes("?") ? "&" : "?";
  const minuteBucket = Math.floor(Date.now() / 60000);
  const bust = `${path}${sep}v=${BUILD_ID}&t=${minuteBucket}`;
  const res = await fetch(bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-AU") : "—";
}

function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString("en-AU") : "—";
}

function formatNum(n) {
  return Intl.NumberFormat("en-AU").format(Math.round(n || 0));
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let current = size;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current >= 10 || unit === 0 ? Math.round(current) : current.toFixed(1)} ${units[unit]}`;
}

function relativeTime(d) {
  if (!d) return "unknown";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "unknown";
  const diffMs = dt.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (absMs < hour) {
    const mins = Math.max(1, Math.round(absMs / minute));
    return diffMs >= 0 ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absMs < day) {
    const hours = Math.max(1, Math.round(absMs / hour));
    return diffMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.max(1, Math.round(absMs / day));
  return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleCaseToken(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isSamPage() {
  return Boolean(document.querySelector(
    "#samOverviewStats, #samDecisionStats, #samPolicyStats, #samRuleStats, #samDirectoryStats, #samFinanceStats, #samLearningStats, #samAutomationStats, #samEmailSummaryStats"
  ));
}

function shouldAutoRefreshPage() {
  if (isSamPage()) return false;
  return Boolean(document.querySelector(
    "#originalStats, #kanbanBoard, #allProjectsGrid, #tokenUsageStats, #statusMetricsWrap, #cronTableBody, #serverMonitorStats"
  ));
}

function trendArrow(delta) {
  if (delta > 0) return `↑ +${formatNum(delta)}`;
  if (delta < 0) return `↓ ${formatNum(delta)}`;
  return "→ 0";
}

function pctDelta(current, previous) {
  if (!previous) return "n/a";
  return `${Math.round(((current - previous) / previous) * 100)}%`;
}

function uniqSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function matchesMulti(value, selected = []) {
  return !selected?.length || selected.includes(value);
}

function toSelectedValues(selectEl) {
  return Array.from(selectEl?.selectedOptions || []).map((o) => o.value).filter((v) => v !== "all");
}

function inferProjectFromSession(session, knownProjectIds = []) {
  const blob = `${session?.key || ""} ${session?.label || ""}`.toLowerCase();
  for (const pid of knownProjectIds) {
    if (blob.includes(String(pid).toLowerCase())) return pid;
  }
  return null;
}

function setupTokenFilters({ gatewayTokenMetrics, projectDailyMetrics }) {
  const gw = gatewayTokenMetrics?.periods?.lifetime || {};
  const sessions = gw.sessions || [];
  const byModel = gw.byModel || [];
  const byProvider = gw.byProvider || [];
  const tools = gw.tools?.tools || [];
  const projects = projectDailyMetrics || [];
  const knownProjectIds = uniqSorted(projects.map((x) => x.projectId));
  const inferredProjects = uniqSorted(sessions.map((s) => inferProjectFromSession(s, knownProjectIds)));

  const options = {
    agent: uniqSorted(sessions.map((x) => x.agentId)),
    project: uniqSorted([...knownProjectIds, ...inferredProjects]),
    channel: uniqSorted(sessions.map((x) => x.channel)),
    provider: uniqSorted(byProvider.map((x) => x.provider)),
    model: uniqSorted(byModel.map((x) => x.model)),
    tool: uniqSorted(tools.map((x) => x.name)),
  };

  const bindings = [
    ["#fltAgent", "agent"],
    ["#fltProject", "project"],
    ["#fltChannel", "channel"],
    ["#fltProvider", "provider"],
    ["#fltModel", "model"],
    ["#fltTool", "tool"],
  ];

  for (const [sel, key] of bindings) {
    const el = $(sel);
    if (!el) continue;
    const current = Array.isArray(TOKEN_FILTERS[key]) ? TOKEN_FILTERS[key] : [];
    const curVal = current[0] || "all";
    el.innerHTML = [`<option value="all">Any</option>`, ...options[key].map((v) => `<option value="${String(v).replace(/"/g, '&quot;')}">${v}</option>`)].join("");
    el.value = options[key].includes(curVal) ? curVal : "all";
    if (el.dataset.wired !== "1") {
      el.addEventListener("change", () => {
        TOKEN_FILTERS[key] = (el.value && el.value !== 'all') ? [el.value] : [];
        boot().catch(() => {});
      });
      el.dataset.wired = "1";
    }
  }

  const clearBtn = $("#clearAllTokenFilters");
  if (clearBtn && clearBtn.dataset.wired !== "1") {
    clearBtn.addEventListener("click", () => {
      TOKEN_FILTERS.agent = [];
      TOKEN_FILTERS.project = [];
      TOKEN_FILTERS.channel = [];
      TOKEN_FILTERS.provider = [];
      TOKEN_FILTERS.model = [];
      TOKEN_FILTERS.tool = [];
      TOKEN_FILTERS.dow = "all";
      TOKEN_FILTERS.hour = "all";
      boot().catch(() => {});
    });
    clearBtn.dataset.wired = "1";
  }
}

function renderActiveFilterChips() {
  const wrap = $("#activeFilterChips");
  if (!wrap) return;
  const chips = [];
  const add = (k, vals) => (vals || []).forEach((v) => chips.push({ k, v }));
  add("agent", TOKEN_FILTERS.agent);
  add("project", TOKEN_FILTERS.project);
  add("channel", TOKEN_FILTERS.channel);
  add("provider", TOKEN_FILTERS.provider);
  add("model", TOKEN_FILTERS.model);
  add("tool", TOKEN_FILTERS.tool);
  if (TOKEN_FILTERS.dow !== "all") chips.push({ k: "day", v: TOKEN_FILTERS.dow });
  if (TOKEN_FILTERS.hour !== "all") chips.push({ k: "hour", v: TOKEN_FILTERS.hour });

  if (!chips.length) {
    wrap.innerHTML = `<span class="muted">No active filters</span>`;
    return;
  }

  wrap.innerHTML = chips.map((c) => `<button class="chip chip-ok chip-filter" data-k="${c.k}" data-v="${c.v}">${c.k}: ${c.v} ×</button>`).join(" ");
  wrap.querySelectorAll('.chip-filter').forEach((el) => {
    el.addEventListener('click', () => {
      const k = el.dataset.k;
      const v = el.dataset.v;
      if (["agent","project","channel","provider","model","tool"].includes(k)) {
        TOKEN_FILTERS[k] = (TOKEN_FILTERS[k] || []).filter((x) => x !== v);
      } else if (k === "day") TOKEN_FILTERS.dow = "all";
      else if (k === "hour") TOKEN_FILTERS.hour = "all";
      boot().catch(() => {});
    });
  });
}

function normalizeModel(text = "") {
  const key = String(text).toLowerCase();
  for (const [k, v] of Object.entries(MODEL_ALIASES)) {
    if (key.includes(k)) return v;
  }
  return key || "unknown-model";
}

function estimateTokens(item) {
  const direct = Number(item.total_tokens) || Number(item.token_count) || Number(item.tokens) || 0;
  if (direct > 0) return { tokens: direct, estimated: false };
  const prompt = Number(item.prompt_tokens) || 0;
  const completion = Number(item.completion_tokens) || 0;
  if (prompt + completion > 0) return { tokens: prompt + completion, estimated: false };
  const textLen = JSON.stringify(item).length;
  return { tokens: Math.max(120, Math.round(textLen / 4)), estimated: true };
}

function toDays(ms) {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function computeAggregateMetrics(records = []) {
  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);
  const curStart = weekStart(now);
  const prevStart = new Date(curStart);
  prevStart.setDate(prevStart.getDate() - 7);

  const totals = {
    ytd: { runs: 0, tokens: 0 },
    currentWeek: { runs: 0, tokens: 0 },
    previousWeek: { runs: 0, tokens: 0 }
  };

  for (const r of records) {
    const dt = new Date(r.date);
    if (Number.isNaN(dt.getTime())) continue;
    const runs = Number(r.runs || 0);
    const tokens = Number(r.tokens || 0);

    if (dt >= startYear) {
      totals.ytd.runs += runs;
      totals.ytd.tokens += tokens;
    }
    if (dt >= curStart) {
      totals.currentWeek.runs += runs;
      totals.currentWeek.tokens += tokens;
    } else if (dt >= prevStart && dt < curStart) {
      totals.previousWeek.runs += runs;
      totals.previousWeek.tokens += tokens;
    }
  }

  return totals;
}

function filterRecordsByPeriod(records = [], period = "lifetime") {
  const now = new Date();
  const curStart = weekStart(now);
  const startYear = new Date(now.getFullYear(), 0, 1);
  if (period === "currentWeek") return records.filter((r) => new Date(r.date) >= curStart);
  if (period === "ytd") return records.filter((r) => new Date(r.date) >= startYear);
  return records;
}

function filterRecordsPreviousPeriod(records = [], period = "lifetime") {
  const now = new Date();
  const curStart = weekStart(now);
  if (period === "currentWeek") {
    const prevStart = new Date(curStart);
    prevStart.setDate(prevStart.getDate() - 7);
    return records.filter((r) => {
      const d = new Date(r.date);
      return d >= prevStart && d < curStart;
    });
  }
  if (period === "ytd") {
    const currentYear = now.getFullYear();
    const dayOfYear = Math.floor((now - new Date(currentYear, 0, 1)) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(currentYear - 1, 0, 1);
    const prevEnd = new Date(currentYear - 1, 0, 1 + dayOfYear);
    return records.filter((r) => {
      const d = new Date(r.date);
      return d >= prevStart && d <= prevEnd;
    });
  }
  return [];
}

function recordsRangeLabel(records = [], period = "lifetime") {
  if (!records.length) {
    if (period === "currentWeek") return "No daily records yet for current week";
    if (period === "ytd") return "No YTD records loaded";
    return "No records loaded";
  }
  const dates = records.map((r) => new Date(r.date)).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a - b);
  if (!dates.length) return "No valid record dates";
  return `${dates[0].toLocaleDateString("en-AU")} → ${dates[dates.length - 1].toLocaleDateString("en-AU")}`;
}

async function loadTasks() {
  let local = [];
  try {
    const raw = localStorage.getItem(TASK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    local = Array.isArray(parsed) ? parsed : [];
  } catch {}

  let remote = [];
  try {
    const json = await loadJson("./api/kanban/tasks.php");
    remote = Array.isArray(json?.tasks) ? json.tasks : [];
  } catch {
    // If the API fails, we have no remote tasks.
    console.warn("Failed to load tasks from API");
  }

  const byId = new Map();
  [...remote, ...local].forEach((t) => {
    if (!t?.id) return;
    const prev = byId.get(t.id);
    if (!prev || new Date(t.updatedAt || 0) >= new Date(prev.updatedAt || 0)) byId.set(t.id, t);
  });
  return Array.from(byId.values());
}

async function saveTasks(tasks) {
  localStorage.setItem(TASK_KEY, JSON.stringify(tasks, null, 2));
  try {
    const res = await fetch(`./api/kanban/tasks.php?v=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replace_all", tasks })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json?.tasks)) {
      localStorage.setItem(TASK_KEY, JSON.stringify(json.tasks, null, 2));
    }
  } catch (err) {
    console.warn("Kanban remote save failed", err);
  }
}

function taskTemplate() {
  return {
    id: crypto.randomUUID(),
    title: "",
    details: "",
    projectId: "general",
    type: "new-task",
    status: "inbox",
    dueDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  };
}

function bootstrapTasksIfEmpty(projects, existing) {
  if (existing.length) return existing;
  const seeded = [
    {
      ...taskTemplate(),
      title: "Create control plane Kanban subpage",
      details: "Split board into dedicated page with richer task statuses.",
      projectId: "lil-zen-control-pane",
      type: "enhancement",
      status: "done",
      completedAt: new Date().toISOString()
    },
    {
      ...taskTemplate(),
      title: "Plan Thursday full voice interface",
      details: "Prepare implementation runbook for Discord voice loop.",
      projectId: "lil-zen-control-pane",
      type: "new-task",
      status: "ready"
    }
  ].map((t) => ({ ...t, updatedAt: new Date().toISOString() }));

  Promise.resolve(saveTasks(seeded)).catch(() => {});
  return seeded;
}

function projectRollups(projects, tasks) {
  const rollups = Object.fromEntries(projects.map((p) => [p.id, {
    ...p,
    taskCount: 0,
    openTasks: 0,
    completed: 0,
    overdue: 0,
    activity: 0,
    lastUpdated: p.createdAt || null
  }]));

  for (const t of tasks) {
    if (!rollups[t.projectId]) continue;
    const p = rollups[t.projectId];
    p.taskCount += 1;
    if (OPEN_STATUSES.has(t.status)) p.openTasks += 1;
    if (t.status === "done") p.completed += 1;
    if (t.dueDate && OPEN_STATUSES.has(t.status) && new Date(t.dueDate) < new Date()) p.overdue += 1;
    p.activity += 1;
    if (!p.lastUpdated || new Date(t.updatedAt) > new Date(p.lastUpdated)) p.lastUpdated = t.updatedAt;
  }

  return rollups;
}

function renderHome({ projects, tasks, modelUsage, modelTotals, capabilityData, projectDailyMetrics }) {
  const originalStatsNode = $("#originalStats");
  const kanbanStatsNode = $("#kanbanStats");
  if (!originalStatsNode || !kanbanStatsNode) return;

  const now = new Date();
  const thisYear = now.getFullYear();
  const open = tasks.filter((t) => OPEN_STATUSES.has(t.status)).length;
  const closedYear = tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt).getFullYear() === thisYear).length;
  const overdue = tasks.filter((t) => t.dueDate && OPEN_STATUSES.has(t.status) && new Date(t.dueDate) < now).length;

  const rolls = projectRollups(projects, tasks);
  let activeProjects = Object.values(rolls).filter((p) => !p.lastUpdated || toDays(now - new Date(p.lastUpdated)) <= ACTIVE_DAYS);
  if (!activeProjects.length) activeProjects = Object.values(rolls);

  const originalCards = [
    ["Model Families", Object.keys(modelUsage || {}).length],
    ["Ingested Runs", modelTotals?.runs || 0],
    ["Global Tokens", formatNum(modelTotals?.tokens || 0)],
    ["Estimated Tokens", formatNum(modelTotals?.estimatedTokens || 0)]
  ];

  const capabilitySkills = Array.isArray(capabilityData?.skills) ? capabilityData.skills.length : 0;
  const capabilityMcpWorking = Array.isArray(capabilityData?.mcpServers)
    ? capabilityData.mcpServers.filter((x) => x.status === "working").length
    : 0;

  const kanbanCards = [
    ["Open Tasks", open],
    [`Closed in ${thisYear}`, closedYear],
    ["Overdue", overdue],
    ["Active Projects", activeProjects.length],
    ["Installed Skills", capabilitySkills],
    ["MCP Working", capabilityMcpWorking]
  ];

  originalStatsNode.innerHTML = originalCards.map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");
  kanbanStatsNode.innerHTML = kanbanCards.map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");

  const activeGrid = $("#activeProjectsGrid");
  if (activeGrid) {
    activeGrid.innerHTML = activeProjects.map((p) => {
      const firstLink = Array.isArray(p.websites) && p.websites.length ? p.websites[0] : "";
      return `
      <article class="project-card">
        <h3>${p.name}</h3>
        <p class="muted">${p.description}</p>
        <div class="kv"><span>Open tasks</span><strong>${p.openTasks}</strong></div>
        <div class="kv"><span>Completed</span><strong>${p.completed}</strong></div>
        <div class="kv"><span>Overdue</span><strong>${p.overdue}</strong></div>
        <div class="kv"><span>Last updated</span><strong>${fmtDate(p.lastUpdated)}</strong></div>
        ${firstLink ? `<div><a class="btn" target="_blank" rel="noopener noreferrer" href="${firstLink}">Open project ↗</a></div>` : ""}
      </article>
    `;
    }).join("") || `<article class="project-card"><h3>No active projects</h3><p class="muted">Add/update tasks in Kanban and they will appear here.</p></article>`;
  }

  const modelRows = Object.entries(modelUsage || {})
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .map(([m, x]) => `<tr><td>${m}</td><td>${x.runs}</td><td>${formatNum(x.tokens)}</td><td>${Math.round((x.success / Math.max(1, x.runs)) * 100)}%</td></tr>`)
    .join("");
  const modelWrap = $("#modelTableWrap");
  if (modelWrap) {
    modelWrap.innerHTML = `<table class="table"><thead><tr><th>Model</th><th>Runs</th><th>Tokens</th><th>Success</th></tr></thead><tbody>${modelRows}</tbody></table>`;
  }

  const tmWrap = $("#tokenMetricsWrap");
  if (tmWrap) {
    const agg = computeAggregateMetrics(projectDailyMetrics || []);
    const ytd = agg.ytd;
    const week = agg.currentWeek;
    const prev = agg.previousWeek;
    const deltaRuns = week.runs - prev.runs;
    const deltaTokens = week.tokens - prev.tokens;
    tmWrap.innerHTML = `<table class="table"><thead><tr><th>Period</th><th>Runs</th><th>Tokens</th><th>Trend vs prev week</th></tr></thead><tbody>
      <tr><td>YTD</td><td>${formatNum(ytd.runs)}</td><td>${formatNum(ytd.tokens)}</td><td>—</td></tr>
      <tr><td>Current week</td><td>${formatNum(week.runs)}</td><td>${formatNum(week.tokens)}</td><td>Runs ${trendArrow(deltaRuns)} · Tokens ${trendArrow(deltaTokens)}</td></tr>
    </tbody></table>
    <p class="muted mt-2">Aggregated from per-project daily metrics history (local file).</p>`;
  }

  const freshness = $("#dataFreshness");
  if (freshness) freshness.textContent = `Last refresh: ${new Date().toLocaleString("en-AU")}`;
}

function getKanbanFilters() {
  return {
    projectId: $("#projectFilter")?.value || "all",
    state: $("#stateFilter")?.value || "all",
    q: ($("#searchFilter")?.value || "").trim().toLowerCase()
  };
}

function matchesFilters(task, filters) {
  if (filters.projectId !== "all" && task.projectId !== filters.projectId) return false;

  if (filters.state === "open" && !OPEN_STATUSES.has(task.status)) return false;
  if (filters.state === "overdue") {
    const overdue = task.dueDate && OPEN_STATUSES.has(task.status) && new Date(task.dueDate) < new Date();
    if (!overdue) return false;
  }
  if (filters.state === "done" && task.status !== "done") return false;
  if (filters.state === "blocked" && task.status !== "blocked") return false;

  if (filters.q) {
    const text = `${task.title || ""} ${task.details || ""}`.toLowerCase();
    if (!text.includes(filters.q)) return false;
  }
  return true;
}

function wireKanbanFilterControls(projects, tasks) {
  const projectFilter = $("#projectFilter");
  const stateFilter = $("#stateFilter");
  const searchFilter = $("#searchFilter");
  const clearBtn = $("#clearFiltersBtn");

  if (projectFilter && projectFilter.dataset.wired !== "1") {
    const options = [
      `<option value="all">All projects</option>`,
      ...projects.map((p) => `<option value="${p.id}">${p.name}</option>`)
    ];
    projectFilter.innerHTML = options.join("");
    projectFilter.value = "all";
    projectFilter.addEventListener("change", () => renderKanban(projects, tasks));
    projectFilter.dataset.wired = "1";
  }

  if (stateFilter && stateFilter.dataset.wired !== "1") {
    stateFilter.value = "all";
    stateFilter.addEventListener("change", () => renderKanban(projects, tasks));
    stateFilter.dataset.wired = "1";
  }

  if (searchFilter && searchFilter.dataset.wired !== "1") {
    searchFilter.addEventListener("input", () => renderKanban(projects, tasks));
    searchFilter.dataset.wired = "1";
  }

  if (clearBtn && clearBtn.dataset.wired !== "1") {
    clearBtn.addEventListener("click", () => {
      if (projectFilter) projectFilter.value = "all";
      if (stateFilter) stateFilter.value = "all";
      if (searchFilter) searchFilter.value = "";
      setVisibleLaneStates(DEFAULT_VISIBLE_LANES);
      renderKanban(projects, tasks);
    });
    clearBtn.dataset.wired = "1";
  }
}

function getVisibleLaneStates() {
  try {
    const raw = localStorage.getItem(LANE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((id) => STATUS.some((s) => s.id === id));
        if (valid.length) return valid;
      }
    }
  } catch {}
  return [...DEFAULT_VISIBLE_LANES];
}

function setVisibleLaneStates(ids = []) {
  const unique = Array.from(new Set(ids.filter((id) => STATUS.some((s) => s.id === id))));
  const safe = unique.length ? unique : [...DEFAULT_VISIBLE_LANES];
  localStorage.setItem(LANE_STATE_KEY, JSON.stringify(safe));
}

function renderLaneStateControls(projects, tasks) {
  const wrap = $("#kanbanStateVisibility");
  if (!wrap) return;
  const selected = new Set(getVisibleLaneStates());

  const chips = STATUS.map((s) => {
    const active = selected.has(s.id);
    return `<button type="button" class="kanban-state-chip ${active ? "active" : ""}" data-state="${s.id}" aria-pressed="${active ? "true" : "false"}">${s.title}</button>`;
  }).join("");

  wrap.innerHTML = `<span class="muted">Visible lanes:</span>${chips}<button type="button" class="btn" id="resetLaneStatesBtn">Default</button>`;

  wrap.querySelectorAll(".kanban-state-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-state");
      const next = new Set(getVisibleLaneStates());
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add("inbox");
      setVisibleLaneStates(Array.from(next));
      renderKanban(projects, tasks);
    });
  });

  wrap.querySelector("#resetLaneStatesBtn")?.addEventListener("click", () => {
    setVisibleLaneStates(DEFAULT_VISIBLE_LANES);
    renderKanban(projects, tasks);
  });
}

function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toDueIso(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T12:00:00`).toISOString();
}

function ensureTaskDetailsCoverage(tasks) {
  let changed = false;
  for (const t of tasks) {
    if (!String(t.details || "").trim()) {
      t.details = "TODO: Add details (objective, acceptance criteria, dependencies, and delivery notes).";
      t.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

function validateTaskDraft(draft, projects) {
  const missing = [];
  if (!String(draft.title || "").trim()) missing.push("title");
  if (!String(draft.details || "").trim()) missing.push("details");
  if (!String(draft.projectId || "").trim()) missing.push("project");
  if (!String(draft.type || "").trim()) missing.push("type");
  if (!String(draft.status || "").trim()) missing.push("status");
  if (!String(draft.dueDate || "").trim()) missing.push("due date");

  const validProjectIds = new Set((projects || []).map((p) => p.id));
  if (draft.projectId && !validProjectIds.has(draft.projectId)) {
    missing.push("valid project selection");
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? `Missing required fields: ${missing.join(", ")}` : ""
  };
}

function openTaskModal({ mode = "add", task, projects, tasks }) {
  // Ensure only one editor is ever open.
  document.querySelectorAll('.task-modal-overlay').forEach((n) => n.remove());

  const isEdit = mode === "edit";
  const draft = {
    ...task,
    priority: task?.priority || "medium",
    owner: task?.owner || "",
    acceptanceCriteria: task?.acceptanceCriteria || "",
    tags: Array.isArray(task?.tags) ? task.tags : (task?.tags ? String(task.tags).split(",").map((x) => x.trim()).filter(Boolean) : [])
  };

  const projectOptions = (projects || [])
    .map((p) => `<option value="${p.id}" ${p.id === draft.projectId ? "selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.id)})</option>`)
    .join("");

  const modal = document.createElement("div");
  modal.className = "task-modal-overlay";
  // inline safety so the panel still works even if stale CSS is cached
  modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:stretch;justify-content:flex-end;background:rgba(4,9,22,.62);backdrop-filter:blur(2px);";

  modal.innerHTML = `
    <section class="task-modal panel" role="dialog" aria-modal="true" aria-label="${isEdit ? "Edit task" : "Add task"}">
      <div class="panel-head">
        <h3>${isEdit ? "Edit Task" : "Add Task"}</h3>
        <button class="btn task-modal-close" type="button" title="Close editor">✕</button>
      </div>

      <p class="muted">${isEdit ? "Editing existing ticket" : "Creating new ticket"} · required fields marked with *</p>

      <div id="taskModalError" class="warn-box is-hidden"></div>

      <div class="task-modal-grid">
        <label class="label">Title *
          <input id="tmTitle" class="input" value="${escapeAttr(draft.title || "")}" placeholder="Whole task outcome" />
        </label>

        <label class="label">Project *
          <select id="tmProject" class="input">${projectOptions}</select>
        </label>

        <label class="label">Type *
          <select id="tmType" class="input">
            ${["new-task", "enhancement", "bug", "bau", "research"].map((x) => `<option value="${x}" ${x === draft.type ? "selected" : ""}>${x}</option>`).join("")}
          </select>
        </label>

        <label class="label">Status *
          <select id="tmStatus" class="input">
            ${STATUS.map((x) => `<option value="${x.id}" ${x.id === draft.status ? "selected" : ""}>${x.title}</option>`).join("")}
          </select>
        </label>

        <label class="label">Due date *
          <input id="tmDue" class="input" type="date" value="${toDateInputValue(draft.dueDate)}" />
        </label>

        <label class="label">Priority
          <select id="tmPriority" class="input">
            ${["low", "medium", "high", "critical"].map((x) => `<option value="${x}" ${x === draft.priority ? "selected" : ""}>${x}</option>`).join("")}
          </select>
        </label>

        <label class="label">Owner
          <input id="tmOwner" class="input" value="${escapeAttr(draft.owner || "")}" placeholder="owner/agent" />
        </label>

        <label class="label">Tags (comma separated)
          <input id="tmTags" class="input" value="${escapeAttr((draft.tags || []).join(", "))}" placeholder="kanban, ux, automation" />
        </label>

        <label class="label">Details *
          <textarea id="tmDetails" class="input" rows="4" placeholder="Describe objective, constraints, dependencies, rollout notes">${escapeAttr(draft.details || "")}</textarea>
        </label>

        <label class="label">Acceptance Criteria
          <textarea id="tmAcceptance" class="input" rows="4" placeholder="How we know this is complete and non-breaking">${escapeAttr(draft.acceptanceCriteria || "")}</textarea>
        </label>
      </div>

      <div class="task-modal-actions">
        <button class="btn task-modal-cancel" type="button">Cancel</button>
        <button class="btn btn-active task-modal-save" type="button">${isEdit ? "Save" : "Create Task"}</button>
      </div>
    </section>
  `;

  const panel = modal.querySelector('.task-modal');
  if (panel) {
    panel.style.cssText = "width:min(920px,100%);height:100%;max-height:100%;overflow:hidden;border-radius:16px 0 0 16px;border-left:1px solid rgba(122,156,255,.35);box-shadow:-24px 0 60px rgba(0,0,0,.45);transform:translateX(0);";
  }

  const priorOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const close = () => {
    modal.remove();
    document.body.style.overflow = priorOverflow;
    document.removeEventListener('keydown', onEsc);
  };

  const onEsc = (ev) => {
    if (ev.key === 'Escape') close();
  };
  document.addEventListener('keydown', onEsc);

  modal.addEventListener("click", (ev) => { if (ev.target === modal) close(); });
  modal.querySelector(".task-modal-close")?.addEventListener("click", close);
  modal.querySelector(".task-modal-cancel")?.addEventListener("click", close);

  modal.querySelector(".task-modal-save")?.addEventListener("click", () => {
    const next = {
      ...draft,
      title: $("#tmTitle")?.value?.trim() || "",
      details: $("#tmDetails")?.value?.trim() || "",
      projectId: $("#tmProject")?.value || "",
      type: ($("#tmType")?.value || "new-task").toLowerCase(),
      status: ($("#tmStatus")?.value || "inbox").toLowerCase(),
      dueDate: toDueIso($("#tmDue")?.value || ""),
      priority: ($("#tmPriority")?.value || "medium").toLowerCase(),
      owner: $("#tmOwner")?.value?.trim() || "",
      acceptanceCriteria: $("#tmAcceptance")?.value?.trim() || "",
      tags: ($("#tmTags")?.value || "").split(",").map((x) => x.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    const v = validateTaskDraft(next, projects);
    if (!v.ok) {
      const error = modal.querySelector("#taskModalError");
      if (error) {
        error.textContent = v.message;
        error.classList.remove("is-hidden");
      }
      return;
    }

    if (next.status === "done" && !next.completedAt) next.completedAt = new Date().toISOString();
    if (next.status !== "done") next.completedAt = null;

    if (isEdit) {
      const idx = tasks.findIndex((x) => x.id === next.id);
      if (idx >= 0) tasks[idx] = next;
    } else {
      next.id = next.id || crypto.randomUUID();
      next.createdAt = new Date().toISOString();
      tasks.unshift(next);
    }

    Promise.resolve(saveTasks(tasks)).finally(() => {
      close();
      boot();
    });
  });

  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#tmTitle')?.focus(), 0);
}

function renderKanban(projects, tasks) {
  const board = $("#kanbanBoard");
  if (!board) return;

  wireKanbanFilterControls(projects, tasks);
  renderLaneStateControls(projects, tasks);

  const filters = getKanbanFilters();
  const filteredTasks = tasks.filter((t) => matchesFilters(t, filters));
  const visibleLanes = getVisibleLaneStates();

  const summary = $("#kanbanFilterSummary");
  if (summary) summary.textContent = `Showing ${filteredTasks.length} of ${tasks.length} tasks · Lanes: ${visibleLanes.length}/${STATUS.length}`;

  board.innerHTML = "";

  for (const col of STATUS.filter((s) => visibleLanes.includes(s.id))) {
    const column = document.createElement("section");
    column.className = "kanban-col";
    const colTasks = filteredTasks.filter((t) => t.status === col.id);
    column.innerHTML = `<h3>${escapeHtml(col.title)} <span class="muted">(${colTasks.length})</span></h3><div class="kanban-dropzone" data-col="${col.id}"></div>`;
    const zone = column.querySelector(".kanban-dropzone");

    colTasks.forEach((t) => {
      const p = projects.find((x) => x.id === t.projectId);
      const card = document.createElement("article");
      card.className = "kanban-card";
      card.draggable = true;
      card.innerHTML = `
        <div class="kanban-card-title">${escapeHtml(t.title || "Untitled task")}</div>
        <div class="kanban-card-note">${escapeHtml(String(t.details || "No details"))}</div>
        <div class="project-meta"><span class="chip">${escapeHtml(t.type || "new-task")}</span><span class="chip">${escapeHtml(p?.name || t.projectId || "unknown-project")}</span><span class="chip">${escapeHtml(t.priority || "medium")}</span></div>
        <div class="kanban-card-meta">
          <small>${t.dueDate ? `Due ${fmtDate(t.dueDate)}` : `Updated ${fmtDate(t.updatedAt)}`}</small>
          <div class="kanban-card-controls">
            <button type="button" class="kanban-edit" title="Edit task">✎</button>
            <button type="button" class="kanban-delete" title="Delete task">✕</button>
          </div>
        </div>`;

      card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", t.id));
      card.querySelector(".kanban-delete")?.addEventListener("click", () => {
        Promise.resolve(saveTasks(tasks.filter((x) => x.id !== t.id))).finally(() => boot());
      });
      card.querySelector(".kanban-edit")?.addEventListener("click", () => editTask(t, projects, tasks));
      zone.appendChild(card);
    });

    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      const idx = tasks.findIndex((x) => x.id === id);
      if (idx < 0) return;
      tasks[idx].status = col.id;
      tasks[idx].updatedAt = new Date().toISOString();
      if (col.id === "done" && !tasks[idx].completedAt) tasks[idx].completedAt = new Date().toISOString();
      Promise.resolve(saveTasks(tasks)).finally(() => boot());
    });

    board.appendChild(column);
  }

  $("#addCardBtn")?.addEventListener("click", () => addTask(projects, tasks));
  $("#exportKanbanBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lilzen-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#importKanbanInput")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("Invalid import format");
      Promise.resolve(saveTasks(parsed)).finally(() => boot());
    } catch {
      alert("Import failed");
    }
  });
}

function addTask(projects, tasks) {
  openTaskModal({ mode: "add", task: taskTemplate(), projects, tasks });
}

function editTask(task, projects, tasks) {
  openTaskModal({ mode: "edit", task, projects, tasks });
}

function renderProjectsPage(projects, tasks) {
  const grid = $("#allProjectsGrid");
  if (!grid) return;
  const sort = $("#projectSort")?.value || "lastUpdated";
  const rolls = Object.values(projectRollups(projects, tasks)).filter((p) => p.taskCount > 0 || p.createdAt);

  const sorter = {
    lastUpdated: (a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0),
    createdAt: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    mostActive: (a, b) => b.activity - a.activity,
    mostOpen: (a, b) => b.openTasks - a.openTasks
  }[sort];

  rolls.sort(sorter);
  grid.innerHTML = rolls.map((p) => `
    <article class="project-card">
      <h3>${p.name}</h3>
      <p class="muted">${p.description}</p>
      <div class="kv"><span>Created</span><strong>${fmtDate(p.createdAt)}</strong></div>
      <div class="kv"><span>Last updated</span><strong>${fmtDate(p.lastUpdated)}</strong></div>
      <div class="kv"><span>Total tasks</span><strong>${p.taskCount}</strong></div>
      <div class="kv"><span>Open tasks</span><strong>${p.openTasks}</strong></div>
      <div class="kv"><span>Most active score</span><strong>${p.activity}</strong></div>
    </article>
  `).join("");

  $("#projectSort")?.addEventListener("change", () => renderProjectsPage(projects, tasks));
}

function fmtCompact(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  if (Math.abs(x) >= 1_000_000_000) return `${(x / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(x) >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (Math.abs(x) >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return `${Math.round(x)}`;
}

function computeActivityBuckets(sessions = []) {
  const hour = Array.from({ length: 24 }, () => 0);
  const dow = Array.from({ length: 7 }, () => 0);

  for (const s of sessions) {
    const total = Number(s.totalTokens || 0);
    if (total <= 0) continue;
    const start = new Date(Number(s.firstActivity || s.updatedAt || 0));
    const end = new Date(Number(s.lastActivity || s.updatedAt || 0));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    let a = Math.min(start.getTime(), end.getTime());
    const b = Math.max(start.getTime(), end.getTime());
    const span = Math.max(1, b - a);

    while (a < b) {
      const d = new Date(a);
      const nextHour = new Date(d);
      nextHour.setMinutes(59, 59, 999);
      const chunkEnd = Math.min(b, nextHour.getTime());
      const frac = (chunkEnd - a) / span;
      const w = total * frac;
      hour[d.getHours()] += w;
      dow[d.getDay()] += w;
      a = chunkEnd + 1;
    }
  }

  return { hour, dow };
}

function renderTokenUsagePage({ modelUsage, modelTotals, projectDailyMetrics, modelDailyMetrics, statusMetrics, gatewayTokenMetrics }) {
  const stats = $("#tokenUsageStats");
  if (!stats) return;

  const allRecords = projectDailyMetrics || [];
  const periodRecordsRaw = filterRecordsByPeriod(allRecords, TOKEN_PERIOD);
  const periodKey = TOKEN_PERIOD === "currentWeek" ? "currentWeek" : TOKEN_PERIOD === "ytd" ? "ytd" : "lifetime";
  const gwPeriods = gatewayTokenMetrics?.periods || {};
  const gwCurrentRaw = gwPeriods[periodKey] || null;
  const gwPrevWeekRaw = gwPeriods.previousWeek || null;

  const periodRecords = periodRecordsRaw.filter((r) => matchesMulti(r.projectId, TOKEN_FILTERS.project));

  const knownProjectIds = uniqSorted((projectDailyMetrics || []).map((x) => x.projectId));
  const sessionFilter = (s) => {
    const provider = s.provider || "";
    const model = s.model || "";
    const tools = Array.isArray(s.tools) ? s.tools : [];
    const inferredProject = inferProjectFromSession(s, knownProjectIds);
    const d = new Date(Number(s.updatedAt || s.lastActivity || Date.now()));
    const dow = Number.isNaN(d.getTime()) ? null : d.getDay();
    const hour = Number.isNaN(d.getTime()) ? null : d.getHours();
    return matchesMulti(s.agentId, TOKEN_FILTERS.agent)
      && matchesMulti(inferredProject, TOKEN_FILTERS.project)
      && matchesMulti(s.channel, TOKEN_FILTERS.channel)
      && matchesMulti(provider, TOKEN_FILTERS.provider)
      && matchesMulti(model, TOKEN_FILTERS.model)
      && (!TOKEN_FILTERS.tool?.length || tools.some((t) => TOKEN_FILTERS.tool.includes(t)))
      && (TOKEN_FILTERS.dow === "all" || dow === Number(TOKEN_FILTERS.dow))
      && (TOKEN_FILTERS.hour === "all" || hour === Number(TOKEN_FILTERS.hour));
  };

  const gwCurrent = gwCurrentRaw ? {
    ...gwCurrentRaw,
    sessions: (gwCurrentRaw.sessions || []).filter(sessionFilter),
  } : null;
  const gwPrevWeek = gwPrevWeekRaw ? {
    ...gwPrevWeekRaw,
    sessions: (gwPrevWeekRaw.sessions || []).filter(sessionFilter),
  } : null;

  const periodRunsFallback = periodRecords.reduce((a, r) => a + Number(r.runs || 0), 0);
  const periodTokensFallback = periodRecords.reduce((a, r) => a + Number(r.tokens || 0), 0);

  const hasSessionFilter = [TOKEN_FILTERS.agent, TOKEN_FILTERS.project, TOKEN_FILTERS.channel, TOKEN_FILTERS.provider, TOKEN_FILTERS.model, TOKEN_FILTERS.tool].some((x) => Array.isArray(x) ? x.length > 0 : x !== "all") || TOKEN_FILTERS.dow !== "all" || TOKEN_FILTERS.hour !== "all";
  const currentFiltered = gwCurrent?.sessions || [];
  const prevFiltered = gwPrevWeek?.sessions || [];
  const currFilteredTokens = currentFiltered.reduce((a, s) => a + Number(s.totalTokens || 0), 0);
  const currFilteredCost = currentFiltered.reduce((a, s) => a + Number(s.totalCost || 0), 0);
  const currFilteredMsgs = currentFiltered.reduce((a, s) => a + Number(s.messages || 0), 0);
  const prevFilteredTokens = prevFiltered.reduce((a, s) => a + Number(s.totalTokens || 0), 0);
  const prevFilteredMsgs = prevFiltered.reduce((a, s) => a + Number(s.messages || 0), 0);

  const periodRuns = gwCurrent
    ? (hasSessionFilter ? currFilteredMsgs : Number(gwCurrent.messages?.total || gwCurrent.sessionsCount || 0))
    : periodRunsFallback;
  const periodTokens = gwCurrent
    ? (hasSessionFilter ? currFilteredTokens : Number(gwCurrent.totals?.totalTokens || 0))
    : periodTokensFallback;
  const periodCost = gwCurrent
    ? (hasSessionFilter ? currFilteredCost : Number(gwCurrent.totals?.totalCost || gwCurrent.costTotals?.totalCost || 0))
    : 0;

  const live = statusMetrics?.tokenSummary || {};
  const liveTotal = Number(live.tokensIn || 0) + Number(live.tokensOut || 0);

  stats.innerHTML = [
    ["Runs (selected period)", formatNum(periodRuns)],
    ["Tokens (selected period)", formatNum(periodTokens)],
    ["Cost (selected period)", periodCost ? `$${periodCost.toFixed(2)}` : "—"],
    ["Live Tokens In", formatNum(live.tokensIn || 0)],
    ["Live Tokens Out", formatNum(live.tokensOut || 0)],
    ["Live Tokens Total", formatNum(liveTotal)]
  ].map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");

  const label = $("#tokenTimeframeLabel");
  if (label) {
    const gwRange = gwCurrent ? `${gwCurrent.startDate} - ${gwCurrent.endDate}` : null;
    const range = (gwRange || recordsRangeLabel(periodRecords, TOKEN_PERIOD).replace(' → ', ' - '));
    label.textContent = range;
  }
  renderActiveFilterChips();

  const b1 = $("#periodCurrentWeek");
  const b2 = $("#periodYtd");
  const b3 = $("#periodLifetime");
  const buttons = [b1, b2, b3].filter(Boolean);
  buttons.forEach((b) => b.classList.remove("btn-active"));
  if (TOKEN_PERIOD === "currentWeek") b1?.classList.add("btn-active");
  if (TOKEN_PERIOD === "ytd") b2?.classList.add("btn-active");
  if (TOKEN_PERIOD === "lifetime") b3?.classList.add("btn-active");
  if (b1 && b1.dataset.wired !== "1") {
    b1.addEventListener("click", () => { TOKEN_PERIOD = "currentWeek"; renderTokenUsagePage({ modelUsage, modelTotals, projectDailyMetrics, modelDailyMetrics, statusMetrics, gatewayTokenMetrics }); });
    b1.dataset.wired = "1";
  }
  if (b2 && b2.dataset.wired !== "1") {
    b2.addEventListener("click", () => { TOKEN_PERIOD = "ytd"; renderTokenUsagePage({ modelUsage, modelTotals, projectDailyMetrics, modelDailyMetrics, statusMetrics, gatewayTokenMetrics }); });
    b2.dataset.wired = "1";
  }
  if (b3 && b3.dataset.wired !== "1") {
    b3.addEventListener("click", () => { TOKEN_PERIOD = "lifetime"; renderTokenUsagePage({ modelUsage, modelTotals, projectDailyMetrics, modelDailyMetrics, statusMetrics, gatewayTokenMetrics }); });
    b3.dataset.wired = "1";
  }

  const overview = $("#usageOverviewMetrics");
  if (overview && gwCurrent) {
    const t = gwCurrent.totals || {};
    const m = gwCurrent.messages || {};
    const msgTotalRaw = Number(m.total || 0);
    const errRaw = Number(m.errors || 0);
    const msgTotal = hasSessionFilter ? currentFiltered.reduce((a, s) => a + Number(s.messages || 0), 0) : msgTotalRaw;
    const errCount = hasSessionFilter ? currentFiltered.reduce((a, s) => a + Number(s.errors || 0), 0) : errRaw;
    const avgTok = msgTotal ? periodTokens / msgTotal : 0;
    const avgCost = msgTotal ? periodCost / msgTotal : 0;
    const errRate = msgTotal ? (errCount / msgTotal) * 100 : 0;
    const cacheHit = (!hasSessionFilter && (Number(t.input || 0) + Number(t.cacheRead || 0)) > 0)
      ? (Number(t.cacheRead || 0) / (Number(t.input || 0) + Number(t.cacheRead || 0))) * 100
      : 0;

    const meta = [
      ["Messages", formatNum(msgTotal), "Total user + assistant messages in the selected range."],
      ["Tool Calls", formatNum(gwCurrent.tools?.totalCalls || 0), "Total tool invocations from matching sessions."],
      ["Errors", formatNum(errCount), "Message/tool errors in selected scope."],
      ["Avg Tokens / Msg", fmtCompact(avgTok), "Average total tokens consumed per message."],
      ["Avg Cost / Msg", `$${avgCost.toFixed(4)}`, "Average provider cost per message."],
      ["Sessions", formatNum(gwCurrent.sessionsCount || 0), "Distinct sessions represented in the selected range."],
      ["Error Rate", `${errRate.toFixed(2)}%`, "Errors divided by total messages."],
      ["Cache Hit Rate", hasSessionFilter ? "—" : `${cacheHit.toFixed(1)}%`, "Cache read / (input + cache read)."],
    ];
    overview.innerHTML = meta.map(([l, v, tip]) => `<article class="stat"><div class="label">${l}<span class="tip" title="${tip}" aria-label="Help"></span></div><div class="value">${v}</div></article>`).join("");
  }

  const previousPeriodRecords = filterRecordsPreviousPeriod(allRecords, TOKEN_PERIOD);
  const prevRunsSelFallback = previousPeriodRecords.reduce((a, r) => a + Number(r.runs || 0), 0);
  const prevTokensSelFallback = previousPeriodRecords.reduce((a, r) => a + Number(r.tokens || 0), 0);
  const prevRunsSel = (TOKEN_PERIOD === "currentWeek" && gwPrevWeek)
    ? (hasSessionFilter ? prevFilteredMsgs : Number(gwPrevWeek.messages?.total || gwPrevWeek.sessionsCount || 0))
    : prevRunsSelFallback;
  const prevTokensSel = (TOKEN_PERIOD === "currentWeek" && gwPrevWeek)
    ? (hasSessionFilter ? prevFilteredTokens : Number(gwPrevWeek.totals?.totalTokens || 0))
    : prevTokensSelFallback;

  const periods = $("#tokenUsagePeriods");
  if (periods) {
    const selectedName = TOKEN_PERIOD === "currentWeek" ? "Current week" : TOKEN_PERIOD === "ytd" ? "YTD" : "Lifetime";
    const trendText = TOKEN_PERIOD === "lifetime"
      ? "—"
      : `Runs ${trendArrow(periodRuns - prevRunsSel)} (${pctDelta(periodRuns, prevRunsSel)}) · Tokens ${trendArrow(periodTokens - prevTokensSel)} (${pctDelta(periodTokens, prevTokensSel)})`;
    const note = (!periodRecords.length && TOKEN_PERIOD !== "lifetime")
      ? `<tr><td colspan="4" class="muted">No daily aggregate rows are available yet for this period. Live session tokens are shown above and in OpenClaw Token Summary.</td></tr>`
      : "";
    const topModel = (gwCurrent?.byModel || [])[0];
    const topProject = (periodRecords || []).reduce((best, r) => Number(r.tokens || 0) > Number(best?.tokens || 0) ? r : best, null);
    const spotlight = `<div class="good-box mt-3">Top drivers → Model: <strong>${topModel?.model || "—"}</strong> (${formatNum(topModel?.totals?.totalTokens || 0)} tokens) · Project: <strong>${topProject?.projectId || "—"}</strong> (${formatNum(topProject?.tokens || 0)} tokens)</div>`;
    periods.innerHTML = `<table class="table"><thead><tr><th>Period</th><th>Runs</th><th>Tokens</th><th>Trend</th></tr></thead><tbody>
      <tr><td><strong>${selectedName}</strong></td><td><strong>${formatNum(periodRuns)}</strong></td><td><strong>${formatNum(periodTokens)}</strong></td><td>${trendText}</td></tr>
      ${note}
    </tbody></table>${spotlight}`;
  }

  const byModel = $("#tokenUsageModels");
  if (byModel) {
    let entries = [];
    if (gwCurrent) {
      const map = new Map();
      const prevMap = new Map();
      for (const s of (gwCurrent.sessions || [])) {
        const key = s.model || "unknown";
        const cur = map.get(key) || { runs: 0, tokens: 0 };
        cur.runs += Number(s.messages || 0);
        cur.tokens += Number(s.totalTokens || 0);
        map.set(key, cur);
      }
      for (const s of (gwPrevWeek?.sessions || [])) {
        const key = s.model || "unknown";
        const cur = prevMap.get(key) || { runs: 0, tokens: 0 };
        cur.runs += Number(s.messages || 0);
        cur.tokens += Number(s.totalTokens || 0);
        prevMap.set(key, cur);
      }
      entries = Array.from(map.entries()).map(([model, x]) => ({ model, runs: x.runs, tokens: x.tokens, prevRuns: prevMap.get(model)?.runs || 0, prevTokens: prevMap.get(model)?.tokens || 0 }));
    } else {
      const periodModelRecords = filterRecordsByPeriod(modelDailyMetrics || [], TOKEN_PERIOD);
      const map = new Map();
      for (const r of periodModelRecords) {
        const cur = map.get(r.model) || { runs: 0, tokens: 0 };
        cur.runs += Number(r.runs || 0);
        cur.tokens += Number(r.tokens || 0);
        map.set(r.model, cur);
      }
      entries = Array.from(map.entries()).map(([model, x]) => ({ model, runs: x.runs, tokens: x.tokens, prevRuns: 0, prevTokens: 0 }));
    }

    entries.sort((a, b) => b.tokens - a.tokens);
    const rows = entries.map((x) => {
      const trend = TOKEN_PERIOD === "currentWeek" ? `R ${trendArrow(x.runs - x.prevRuns)} · T ${trendArrow(x.tokens - x.prevTokens)}` : "—";
      return `<tr><td><a href="#" class="flt-link" data-flt="model" data-val="${x.model}">${x.model}</a></td><td>${formatNum(x.runs)}</td><td>${formatNum(x.tokens)}</td><td>${trend}</td></tr>`;
    }).join("");
    const sumRuns = entries.reduce((a, x) => a + x.runs, 0);
    const sumTokens = entries.reduce((a, x) => a + x.tokens, 0);
    byModel.innerHTML = `<table class="table"><thead><tr><th>Model</th><th>Runs</th><th>Tokens</th><th>Trend</th></tr></thead><tbody>${rows}<tr><td><strong>Total</strong></td><td><strong>${formatNum(sumRuns)}</strong></td><td><strong>${formatNum(sumTokens)}</strong></td><td>—</td></tr></tbody></table>`;
  }

  const byProject = $("#tokenUsageProjects");
  if (byProject) {
    const knownProjectIds = uniqSorted((allRecords || []).map((r) => r.projectId));
    const map = new Map();
    const prevMap = new Map();

    if (gwCurrent) {
      for (const s of (gwCurrent.sessions || [])) {
        const pid = inferProjectFromSession(s, knownProjectIds) || 'unmapped';
        const cur = map.get(pid) || { runs: 0, tokens: 0, daysSet: new Set() };
        cur.runs += Number(s.messages || 0);
        cur.tokens += Number(s.totalTokens || 0);
        const d = new Date(Number(s.updatedAt || s.lastActivity || Date.now()));
        if (!Number.isNaN(d.getTime())) cur.daysSet.add(d.toISOString().slice(0, 10));
        map.set(pid, cur);
      }
      for (const s of (gwPrevWeek?.sessions || [])) {
        const pid = inferProjectFromSession(s, knownProjectIds) || 'unmapped';
        const cur = prevMap.get(pid) || { runs: 0, tokens: 0 };
        cur.runs += Number(s.messages || 0);
        cur.tokens += Number(s.totalTokens || 0);
        prevMap.set(pid, cur);
      }
    } else {
      const prevRecords = filterRecordsPreviousPeriod(allRecords, TOKEN_PERIOD);
      for (const r of periodRecords) {
        const cur = map.get(r.projectId) || { runs: 0, tokens: 0, daysSet: new Set() };
        cur.runs += Number(r.runs || 0);
        cur.tokens += Number(r.tokens || 0);
        if (r.date) cur.daysSet.add(r.date);
        map.set(r.projectId, cur);
      }
      for (const r of prevRecords) {
        const cur = prevMap.get(r.projectId) || { runs: 0, tokens: 0 };
        cur.runs += Number(r.runs || 0);
        cur.tokens += Number(r.tokens || 0);
        prevMap.set(r.projectId, cur);
      }
    }

    const sorted = Array.from(map.entries()).sort((a, b) => b[1].tokens - a[1].tokens);
    const rows = sorted.map(([pid, x]) => {
      const p = prevMap.get(pid) || { runs: 0, tokens: 0 };
      const trend = TOKEN_PERIOD === "lifetime" ? "—" : `R ${trendArrow(x.runs - p.runs)} · T ${trendArrow(x.tokens - p.tokens)}`;
      return `<tr><td><a href="#" class="flt-link" data-flt="project" data-val="${pid}">${pid}</a></td><td>${formatNum((x.daysSet && x.daysSet.size) || 0)}</td><td>${formatNum(x.runs)}</td><td>${formatNum(x.tokens)}</td><td>${trend}</td></tr>`;
    }).join("");

    const tRuns = sorted.reduce((a, [,x]) => a + x.runs, 0);
    const tTokens = sorted.reduce((a, [,x]) => a + x.tokens, 0);
    byProject.innerHTML = `<table class="table"><thead><tr><th>Project <span class="tip" title="Mapped from session keys/labels where project names appear; unmapped captures shared/general sessions." aria-label="Help"></span></th><th>Days</th><th>Runs</th><th>Tokens</th><th>Trend</th></tr></thead><tbody>${rows}<tr><td><strong>Total</strong></td><td>—</td><td><strong>${formatNum(tRuns)}</strong></td><td><strong>${formatNum(tTokens)}</strong></td><td>—</td></tr></tbody></table>`;
  }

  const activityWrap = $("#activityByTimeWrap");
  if (activityWrap && gwCurrent) {
    const sessions = gwCurrent.sessions || [];
    const a = computeActivityBuckets(sessions);
    const hourMax = Math.max(1, ...a.hour);
    const dowMax = Math.max(1, ...a.dow);
    const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const dowHtml = a.dow.map((v, i) => {
      const alpha = 0.12 + (v / dowMax) * 0.55;
      const active = TOKEN_FILTERS.dow === String(i) ? "is-active" : "";
      return `<button class="chip day-filter ${active}" data-dow="${i}" style="--day-alpha:${alpha.toFixed(2)};"><strong>${dowNames[i]}</strong><span>${fmtCompact(v)}</span></button>`;
    }).join("");

    const hourHtml = a.hour.map((v, i) => {
      const h = Math.max(6, (v / hourMax) * 80);
      const active = TOKEN_FILTERS.hour === String(i) ? "is-active" : "";
      return `<button class="hour-filter ${active}" data-hour="${i}"><div class="hour-filter-bar" style="--hour-height:${h.toFixed(1)}px;"></div><small class="muted">${i}</small></button>`;
    }).join("");

    activityWrap.innerHTML = `
      <div class="activity-grid">
        <div><h3 class="activity-section-title">Day of Week <span class="tip" title="Click a day to filter the full dashboard to sessions active on that day." aria-label="Help"></span></h3><div class="activity-day-grid">${dowHtml}</div></div>
        <div><h3 class="activity-section-title">Hours (0-23) <span class="tip" title="Click an hour to filter the full dashboard to sessions active in that hour." aria-label="Help"></span></h3><div class="activity-hour-grid">${hourHtml}</div></div>
      </div>`;

    activityWrap.querySelectorAll('.day-filter').forEach((el) => {
      el.addEventListener('click', () => {
        TOKEN_FILTERS.dow = (TOKEN_FILTERS.dow === el.dataset.dow) ? 'all' : el.dataset.dow;
        boot().catch(() => {});
      });
    });
    activityWrap.querySelectorAll('.hour-filter').forEach((el) => {
      el.addEventListener('click', () => {
        TOKEN_FILTERS.hour = (TOKEN_FILTERS.hour === el.dataset.hour) ? 'all' : el.dataset.hour;
        boot().catch(() => {});
      });
    });
  }

  const dailyWrap = $("#dailyUsageWrap");
  if (dailyWrap && gwCurrent) {
    const daily = gwCurrent.daily || [];
    const maxTok = Math.max(1, ...daily.map((d) => Number(d.tokens || 0)));
    const rows = daily.map((d) => {
      const tok = Number(d.tokens || 0);
      const width = Math.max(4, (tok / maxTok) * 100);
      return `<tr><td>${d.date}</td><td>${fmtCompact(tok)}</td><td>$${Number(d.cost || 0).toFixed(2)}</td><td><div class="intensity-track"><div class="intensity-fill" style="--intensity-width:${width.toFixed(2)}%;"></div></div></td></tr>`;
    }).join("");
    dailyWrap.innerHTML = `<table class="table"><thead><tr><th>Date</th><th>Tokens</th><th>Cost</th><th>Intensity <span class="tip" title="Relative token load per day compared to the highest day in this timeframe." aria-label="Help"></span></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  const insights = $("#topInsightsGrid");
  if (insights && gwCurrent) {
    const model = (gwCurrent.byModel || []).slice(0, 5).map((x) => `<li><a href="#" class="flt-link" data-flt="model" data-val="${x.model}">${x.model}</a>: <strong>${fmtCompact(x.totals?.totalTokens || 0)}</strong></li>`).join("");
    const provider = (gwCurrent.byProvider || []).slice(0, 5).map((x) => `<li><a href="#" class="flt-link" data-flt="provider" data-val="${x.provider}">${x.provider}</a>: <strong>${fmtCompact(x.totals?.totalTokens || 0)}</strong></li>`).join("");
    const tool = (gwCurrent.tools?.tools || []).slice(0, 5).map((x) => `<li><a href="#" class="flt-link" data-flt="tool" data-val="${x.name}">${x.name}</a>: <strong>${formatNum(x.count || 0)}</strong> calls</li>`).join("");
    const channel = (gwCurrent.byChannel || []).slice(0, 5).map((x) => `<li><a href="#" class="flt-link" data-flt="channel" data-val="${x.channel}">${x.channel}</a>: <strong>${fmtCompact(x.totals?.totalTokens || 0)}</strong></li>`).join("");
    insights.innerHTML = `
      <article class="stat"><div class="label">Top Models</div><ul>${model || "<li>—</li>"}</ul></article>
      <article class="stat"><div class="label">Top Providers</div><ul>${provider || "<li>—</li>"}</ul></article>
      <article class="stat"><div class="label">Top Tools</div><ul>${tool || "<li>—</li>"}</ul></article>
      <article class="stat"><div class="label">Top Channels</div><ul>${channel || "<li>—</li>"}</ul></article>`;
  }

  const topSessionsWrap = $("#topSessionsWrap");
  if (topSessionsWrap && gwCurrent) {
    const rows = (gwCurrent.sessions || [])
      .slice()
      .sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0))
      .slice(0, 15)
      .map((s) => `<tr><td>${s.label || s.key || 'session'}</td><td>${s.agentId || '—'}</td><td>${s.channel || '—'}</td><td>${s.model || '—'}</td><td>${formatNum(s.messages || 0)}</td><td>${formatNum(s.totalTokens || 0)}</td><td>$${Number(s.totalCost || 0).toFixed(2)}</td></tr>`)
      .join('');
    topSessionsWrap.innerHTML = `<table class="table"><thead><tr><th>Session</th><th>Agent</th><th>Channel</th><th>Model</th><th>Msgs</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">No sessions in current filter</td></tr>'}</tbody></table>`;
  }

  const matrixWrap = $("#tokenMatrixWrap");
  if (matrixWrap) {
    const pm = filterRecordsByPeriod((window.__projectModelDaily || []), TOKEN_PERIOD);
    const models = Array.from(new Set(pm.map((r) => r.model))).sort();
    const projects = Array.from(new Set(pm.map((r) => r.projectId))).sort();
    if (!pm.length || !models.length || !projects.length) {
      matrixWrap.innerHTML = `<p class="muted">No matrix data available for selected period.</p>`;
    } else {
      const cell = new Map();
      for (const r of pm) {
        const k = `${r.projectId}__${r.model}`;
        cell.set(k, (cell.get(k) || 0) + Number(r.tokens || 0));
      }
      const head = models.map((m) => `<th>${m}</th>`).join("");
      const body = projects.map((p) => {
        const tds = models.map((m) => `<td>${formatNum(cell.get(`${p}__${m}`) || 0)}</td>`).join("");
        return `<tr><td><strong>${p}</strong></td>${tds}</tr>`;
      }).join("");
      matrixWrap.innerHTML = `<table class="table"><thead><tr><th>Project \ Model</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
  }

  const summaryWrap = $("#openclawTokenSummary");
  if (summaryWrap) {
    const t = statusMetrics?.tokenSummary || {};
    summaryWrap.innerHTML = `<table class="table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Model</td><td>${t.model || "—"}</td></tr>
      <tr><td>Tokens In</td><td>${formatNum(t.tokensIn || 0)}</td></tr>
      <tr><td>Tokens Out</td><td>${formatNum(t.tokensOut || 0)}</td></tr>
      <tr><td>Context</td><td>${formatNum(t.contextUsed || 0)}/${formatNum(t.contextMax || 0)} (${t.contextPct ?? "—"}%)</td></tr>
      <tr><td>Compactions</td><td>${formatNum(t.compactions || 0)}</td></tr>
      <tr><td>5h usage remaining</td><td>${t.usageWindow?.fiveHourLeftPct ?? "—"}%</td></tr>
      <tr><td>Day usage remaining</td><td>${t.usageWindow?.dayLeftPct ?? "—"}%</td></tr>
      <tr><td>Session</td><td>${t.sessionKey || "—"}</td></tr>
      <tr><td>Runtime / Thinking</td><td>${t.runtime || "—"} / ${t.thinking || "—"}</td></tr>
      <tr><td>Updated</td><td>${t.updatedAt || statusMetrics?.updatedAt || "—"}</td></tr>
    </tbody></table>`;
  }

  document.querySelectorAll('.flt-link').forEach((el) => {
    if (el.dataset.wired === '1') return;
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      const k = el.dataset.flt;
      const v = el.dataset.val || 'all';
      if (k && TOKEN_FILTERS[k] !== undefined) {
        if (Array.isArray(TOKEN_FILTERS[k])) {
          if (!TOKEN_FILTERS[k].includes(v)) TOKEN_FILTERS[k].push(v);
        } else {
          TOKEN_FILTERS[k] = v;
        }
        boot().catch(() => {});
      }
    });
    el.dataset.wired = '1';
  });
}

function renderSystemPage(statusMetrics) {
  const statusWrap = $("#statusMetricsWrap");
  if (!statusWrap) return;
  const o = statusMetrics?.overview || {};
  const s = statusMetrics?.security || {};
  const channels = Array.isArray(statusMetrics?.channels) ? statusMetrics.channels : [];
  const sessionsTop = Array.isArray(statusMetrics?.sessionsTop) ? statusMetrics.sessionsTop : [];

  const channelRows = channels.map((c) => `<tr><td>${c.name}</td><td>${c.enabled ? "ON" : "OFF"}</td><td>${c.state || "unknown"}</td></tr>`).join("");
  const sessionRows = sessionsTop.map((x) => `<tr><td>${x.key}</td><td>${x.kind}</td><td>${x.age}</td><td>${x.model}</td><td>${x.tokens}</td></tr>`).join("");

  statusWrap.innerHTML = `
    <div class="stats-grid mb-3">
      <article class="stat"><div class="label">Gateway</div><div class="value">${o.gatewayService || "unknown"}</div></article>
      <article class="stat"><div class="label">Sessions Active</div><div class="value">${formatNum(o.sessionsActive || 0)}</div></article>
      <article class="stat"><div class="label">Security Warn</div><div class="value">${formatNum(s.warn || 0)}</div></article>
      <article class="stat"><div class="label">Security Critical</div><div class="value">${formatNum(s.critical || 0)}</div></article>
    </div>
    <table class="table"><thead><tr><th>Overview metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Dashboard</td><td>${o.dashboard || "—"}</td></tr>
      <tr><td>OS / Node</td><td>${o.os || "—"} · node ${o.node || "—"}</td></tr>
      <tr><td>Update</td><td>${o.update || "—"}</td></tr>
      <tr><td>Gateway latency</td><td>${o.gatewayReachableMs ?? "—"} ms</td></tr>
      <tr><td>Default model</td><td>${o.defaultModel || "—"}</td></tr>
      <tr><td>Context window</td><td>${formatNum(o.contextWindow || 0)}</td></tr>
      <tr><td>Heartbeat</td><td>${o.heartbeat || "—"}</td></tr>
    </tbody></table>
    <h3 class="section-heading">Channels</h3>
    <table class="table"><thead><tr><th>Channel</th><th>Enabled</th><th>State</th></tr></thead><tbody>${channelRows}</tbody></table>
    <h3 class="section-heading">Top sessions</h3>
    <table class="table"><thead><tr><th>Session</th><th>Kind</th><th>Age</th><th>Model</th><th>Tokens</th></tr></thead><tbody>${sessionRows}</tbody></table>
    <p class="muted mt-2">Status snapshot updated: ${statusMetrics?.updatedAt || "unknown"}</p>
  `;
}

let serverDetailsSnapshotCache = null;
const LIVE_SERVER_DETAILS_BASE_URL = "https://authentic-laura-animal-moisture.trycloudflare.com";
const LIVE_SERVER_DETAILS_PATHS = {
  health: "/api/health",
  status: "/api/status",
  vllm: "/api/vllm",
  gpu: "/api/gpu",
};

async function loadServerDetailsSnapshot() {
  if (serverDetailsSnapshotCache) return serverDetailsSnapshotCache;
  const res = await fetch(`./server-details-snapshot-live.json?v=${Date.now()}`, { cache: "no-store" });
  serverDetailsSnapshotCache = await res.json();
  return serverDetailsSnapshotCache;
}

async function loadServerDetailsEndpoint(endpoint) {
  try {
    const path = LIVE_SERVER_DETAILS_PATHS[endpoint] || `/api/${encodeURIComponent(endpoint)}`;
    const res = await fetch(`${LIVE_SERVER_DETAILS_BASE_URL}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Live proxy HTTP ${res.status}`);
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    const proxyStatus = body?._proxy?.upstreamStatus ?? res.status;
    const ok = Boolean(res.ok && (body?.ok ?? true));
    return { ok, status: proxyStatus, endpoint, body };
  } catch (err) {
    const snapshot = await loadServerDetailsSnapshot().catch(() => null);
    return snapshot?.[endpoint] || { ok: false, status: 0, endpoint, body: { error: err.message } };
  }
}

async function loadServerDetails() {
  const [health, status, vllm, gpu] = await Promise.all([
    loadServerDetailsEndpoint("health"),
    loadServerDetailsEndpoint("status"),
    loadServerDetailsEndpoint("vllm"),
    loadServerDetailsEndpoint("gpu"),
  ]);
  const snapshot = await loadServerDetailsSnapshot().catch(() => null);
  const liveLoaded = [health, status, vllm, gpu].some((item) => item?.ok);
  return { health, status, vllm, gpu, loadedAt: liveLoaded ? new Date().toISOString() : snapshot?.loadedAt || new Date().toISOString() };
}

function deepGet(obj, keys = []) {
  for (const key of keys) {
    const parts = String(key).split(".");
    let cur = obj;
    for (const part of parts) {
      if (cur == null || typeof cur !== "object" || !(part in cur)) {
        cur = undefined;
        break;
      }
      cur = cur[part];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

function findFirstArray(obj, names = []) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];
  for (const name of names) {
    const value = deepGet(obj, [name]);
    if (Array.isArray(value)) return value;
  }
  const queue = [obj];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    for (const [key, value] of Object.entries(item)) {
      if (Array.isArray(value) && names.some((name) => key.toLowerCase().includes(name.toLowerCase().split(".").pop()))) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return [];
}

function formatPct(value) {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${Math.round(n)}%`;
}

function formatMaybeBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  if (n > 1024 * 1024 * 16) return formatBytes(n);
  return formatNum(n);
}

function formatMb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  return `${formatNum(n)} MB`;
}

function formatWatts(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  return `${n.toFixed(1)} W`;
}

function formatTemp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  return `${n.toFixed(1).replace(/\.0$/, "")} C`;
}

function formatSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  const days = Math.floor(n / 86400);
  const hours = Math.floor((n % 86400) / 3600);
  const mins = Math.floor((n % 3600) / 60);
  if (days) return `${days}d ${hours}h ${mins}m`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function pctUsed(used, total) {
  const u = Number(used);
  const t = Number(total);
  if (!Number.isFinite(u) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(100, (u / t) * 100));
}

function meterBar(value) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="server-meter"><span style="width:${pct}%"></span></div>`;
}

function formatTokenRate(rate) {
  const total = Number(rate?.total_tokens_per_second);
  if (!Number.isFinite(total)) return "warming up";
  return `${total.toFixed(1)} tok/s`;
}

function baseName(path) {
  const text = String(path || "");
  return text.split(/[\\/]/).filter(Boolean).pop() || text || "—";
}

function statusChip(result) {
  if (result?.ok) return `<span class="chip chip-ok">online</span>`;
  return `<span class="chip chip-bad">unavailable</span>`;
}

function renderKeyValueTable(rows = []) {
  return `<table class="table"><tbody>${rows.map(([label, value]) => `
    <tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value ?? "—")}</td></tr>
  `).join("")}</tbody></table>`;
}

function renderJsonBlock(label, result) {
  const payload = result?.body ?? {};
  return `
    <article class="project-card server-json-card">
      <div class="card-head">
        <h3>${escapeHtml(label)}</h3>
        ${statusChip(result)}
      </div>
      <pre class="json-block">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </article>
  `;
}

function serverPayload(result) {
  return result?.body?.data ?? result?.body ?? {};
}

function renderServerMonitorPage(serverDetails) {
  const stats = $("#serverMonitorStats");
  if (!stats) return;

  const statusBody = serverPayload(serverDetails.status);
  const vllmBody = serverPayload(serverDetails.vllm);
  const gpuBody = serverPayload(serverDetails.gpu);
  const gpuList = findFirstArray(gpuBody, ["gpus", "gpu", "devices", "data.gpus", "data.devices"]);
  const modelList = findFirstArray(vllmBody, ["available", "models", "data", "model_stats", "running_models"]);
  const activeModel = deepGet(vllmBody, ["active.id", "active.name", "model", "active_model", "current_model", "served_model", "data.model", "data.active_model"]) || (modelList[0]?.id || modelList[0]?.model || modelList[0]?.name);
  const tokenRate = deepGet(vllmBody, ["token_rates.1m.total_tokens_per_second", "token_rates.10m.total_tokens_per_second", "tokens_per_second", "token_rate", "tokens_s", "throughput.tokens_per_second", "metrics.tokens_per_second", "data.tokens_per_second"]);
  const queueDepth = deepGet(vllmBody, ["runtime_counters.requests_waiting", "queue_depth", "queued_requests", "waiting", "scheduler.queue_depth", "data.queue_depth"]);
  const host = deepGet(statusBody, ["hostname", "host", "server.hostname", "system.hostname", "data.hostname"]);
  const uptime = deepGet(statusBody, ["uptime", "uptime_seconds", "system.uptime", "data.uptime"]);
  const gpuUsedMb = deepGet(gpuBody, ["memory_used_mb", "memory.used_mb"]);
  const gpuTotalMb = deepGet(gpuBody, ["memory_total_mb", "memory.total_mb"]);
  const sysUsedBytes = deepGet(statusBody, ["memory.used_bytes", "memory.used", "mem.used", "system.memory.used", "data.memory.used"]);
  const sysTotalBytes = deepGet(statusBody, ["memory.total_bytes", "memory.total", "mem.total", "system.memory.total", "data.memory.total"]);
  const gpuMemPct = pctUsed(gpuUsedMb, gpuTotalMb);
  const sysMemPct = pctUsed(sysUsedBytes, sysTotalBytes);
  const gpuCount = deepGet(gpuBody, ["count"]) ?? gpuList.length ?? "—";
  const totalPower = deepGet(gpuBody, ["power_draw_watts"]);
  const maxTemp = Math.max(...gpuList.map((gpu) => Number(gpu.temperature_c)).filter(Number.isFinite));
  const avgUtil = gpuList.length
    ? gpuList.reduce((sum, gpu) => sum + (Number(gpu.utilization_percent) || 0), 0) / gpuList.length
    : undefined;
  const freshness = $("#serverMonitorFreshness");
  if (freshness) {
    const apiStatus = serverDetails.status?.ok ? "status online" : `status HTTP ${serverDetails.status?.status || "n/a"}`;
    const gpuStatus = serverDetails.gpu?.ok ? "GPU online" : `GPU HTTP ${serverDetails.gpu?.status || "n/a"}`;
    const vllmStatus = serverDetails.vllm?.ok ? "vLLM online" : `vLLM HTTP ${serverDetails.vllm?.status || "n/a"}`;
    freshness.textContent = `Updated ${fmtDateTime(serverDetails.loadedAt)} - ${apiStatus} - ${gpuStatus} - ${vllmStatus}`;
  }

  stats.innerHTML = [
    ["vLLM", formatTokenRate(vllmBody?.token_rates?.["1m"]), baseName(activeModel)],
    ["GPU Memory", `${gpuMemPct.toFixed(1)}%`, `${formatMb(gpuUsedMb)} / ${formatMb(gpuTotalMb)}`],
    ["System Memory", `${sysMemPct.toFixed(1)}%`, `${formatMaybeBytes(sysUsedBytes)} / ${formatMaybeBytes(sysTotalBytes)}`],
    ["GPU Util", avgUtil !== undefined ? `${avgUtil.toFixed(0)}%` : "—", `${gpuList.length || gpuCount} devices`],
    ["GPU Power", totalPower !== undefined ? formatWatts(totalPower) : "—", `Peak ${Number.isFinite(maxTemp) ? formatTemp(maxTemp) : "—"}`],
    ["Requests", `${deepGet(vllmBody, ["runtime_counters.requests_running"]) ?? 0} running`, `${deepGet(vllmBody, ["runtime_counters.requests_waiting"]) ?? 0} waiting`],
  ].map(([l, v, s]) => `<article class="server-panel server-metric"><div class="label">${escapeHtml(l)}</div><div class="metric">${escapeHtml(v)}</div><div class="muted">${escapeHtml(s || "")}</div></article>`).join("");

  const summary = $("#serverStatusSummary");
  if (summary) {
    summary.innerHTML = `
      <div class="server-monitor-grid">
        <article class="project-card">
          <div class="card-head"><h3>Connectivity</h3>${statusChip(serverDetails.status)}</div>
          ${renderKeyValueTable([
            ["Health endpoint", serverDetails.health?.ok ? "reachable" : serverDetails.health?.body?.error || `HTTP ${serverDetails.health?.status || "n/a"}`],
            ["Authenticated status", serverDetails.status?.ok ? "reachable" : serverDetails.status?.body?.error || `HTTP ${serverDetails.status?.status || "n/a"}`],
            ["Host", host || "—"],
            ["FQDN", statusBody.fqdn || "—"],
            ["Uptime", formatSeconds(uptime)],
            ["Timestamp", statusBody.timestamp ? fmtDateTime(statusBody.timestamp * 1000) : "—"],
          ])}
        </article>
        <article class="project-card">
          <div class="card-head"><h3>System</h3>${statusChip(serverDetails.status)}</div>
          ${renderKeyValueTable([
            ["CPU load", Array.isArray(deepGet(statusBody, ["load_average"])) ? deepGet(statusBody, ["load_average"]).map((x) => Number(x).toFixed(2)).join(" / ") : deepGet(statusBody, ["load", "load_average", "cpu.load", "system.load_average"])],
            ["Memory used", formatMaybeBytes(sysUsedBytes)],
            ["Memory total", formatMaybeBytes(sysTotalBytes)],
            ["Disk used", formatMaybeBytes(deepGet(statusBody, ["disk.used", "storage.used", "system.disk.used", "data.disk.used"]))],
          ])}
          ${meterBar(sysMemPct)}
        </article>
        <article class="project-card">
          <div class="card-head"><h3>GPU Memory</h3>${statusChip(serverDetails.gpu)}</div>
          <div class="server-big-metric">${gpuMemPct.toFixed(1)}%</div>
          <p class="muted">${formatMb(gpuUsedMb)} / ${formatMb(gpuTotalMb)} across ${escapeHtml(gpuCount)} GPUs</p>
          ${renderKeyValueTable([
            ["Free", formatMb(deepGet(gpuBody, ["memory_free_mb"]))],
            ["Power draw", formatWatts(totalPower)],
            ["Peak temp", Number.isFinite(maxTemp) ? formatTemp(maxTemp) : "—"],
            ["Average util", avgUtil !== undefined ? `${avgUtil.toFixed(1)}%` : "—"],
          ])}
          ${meterBar(gpuMemPct)}
        </article>
      </div>
    `;
  }

  const gpuWrap = $("#gpuStatusWrap");
  if (gpuWrap) {
    if (gpuList.length) {
      const gpuCards = gpuList.map((gpu, idx) => {
        const used = deepGet(gpu, ["memory_used_mb", "memory_used", "memory.used", "mem_used", "used_memory"]);
        const total = deepGet(gpu, ["memory_total_mb", "memory_total", "memory.total", "mem_total", "total_memory"]);
        const free = deepGet(gpu, ["memory_free_mb", "memory_free", "memory.free"]);
        const memPct = pctUsed(used, total);
        return `
          <article class="project-card server-gpu-card">
            <div class="card-head">
              <h3>GPU ${escapeHtml(deepGet(gpu, ["index"]) ?? idx)}</h3>
              <span class="chip ${Number(gpu.utilization_percent) > 90 ? "chip-warn" : "chip-ok"}">${escapeHtml(formatPct(gpu.utilization_percent))}</span>
            </div>
            <p class="muted">${escapeHtml(gpu.name || "NVIDIA GPU")}</p>
            <div class="server-meter server-meter-compact"><span style="width:${memPct}%"></span></div>
            ${renderKeyValueTable([
              ["Memory", `${formatMb(used)} / ${formatMb(total)}`],
              ["Free", formatMb(free)],
              ["Temperature", formatTemp(gpu.temperature_c)],
              ["Fan", formatPct(gpu.fan_speed_percent)],
              ["Power", `${formatWatts(gpu.power_draw_watts)} / ${formatWatts(gpu.power_limit_watts)}`],
              ["Driver", gpu.driver_version],
              ["UUID", gpu.uuid],
            ])}
          </article>
        `;
      }).join("");
      gpuWrap.innerHTML = `
        <div class="server-monitor-grid mb-3">${gpuCards}</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>GPU</th><th>Util</th><th>Memory used</th><th>Free</th><th>Temp</th><th>Fan</th><th>Power</th><th>Driver</th></tr></thead>
          <tbody>${gpuList.map((gpu, idx) => {
            const used = deepGet(gpu, ["memory_used_mb", "memory_used", "memory.used", "mem_used", "used_memory"]);
            const total = deepGet(gpu, ["memory_total_mb", "memory_total", "memory.total", "mem_total", "total_memory"]);
            return `<tr>
              <td>${escapeHtml(deepGet(gpu, ["index"]) ?? idx)}</td>
              <td>${escapeHtml(deepGet(gpu, ["name", "model", "gpu_name"]) || `GPU ${idx}`)}</td>
              <td>${escapeHtml(formatPct(deepGet(gpu, ["utilization_percent", "utilization", "utilization_gpu", "gpu_util", "util"])))}</td>
              <td>${escapeHtml(used !== undefined && total !== undefined ? `${formatMb(used)} / ${formatMb(total)}` : "—")}</td>
              <td>${escapeHtml(formatMb(deepGet(gpu, ["memory_free_mb", "memory_free", "memory.free"])))}</td>
              <td>${escapeHtml(formatTemp(deepGet(gpu, ["temperature_c", "temperature", "temperature_gpu", "temp"])))}</td>
              <td>${escapeHtml(formatPct(deepGet(gpu, ["fan_speed_percent", "fan_speed", "fan"])))}</td>
              <td>${escapeHtml(`${formatWatts(deepGet(gpu, ["power_draw_watts", "power_draw", "power", "power_watts"]))} / ${formatWatts(gpu.power_limit_watts)}`)}</td>
              <td>${escapeHtml(gpu.driver_version || "—")}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      `;
    } else {
      gpuWrap.innerHTML = `<div class="warn-box">GPU data was not available from the API response.</div>`;
    }
  }

  const tempWrap = $("#temperatureStatusWrap");
  if (tempWrap) {
    const cpuTemps = Array.isArray(statusBody?.temperatures?.cpu) ? statusBody.temperatures.cpu : [];
    const cpuRows = cpuTemps.length ? cpuTemps.map((sensor) => `
      <tr>
        <td>${escapeHtml(sensor.chip || "—")}</td>
        <td>${escapeHtml(sensor.label || "—")}</td>
        <td>${escapeHtml(formatTemp(sensor.temperature_c))}</td>
      </tr>
    `).join("") : `<tr><td colspan="3">No temperature sensor data returned.</td></tr>`;
    const gpuRows = gpuList.length ? gpuList.map((gpu, idx) => `
      <tr>
        <td>GPU ${escapeHtml(gpu.index ?? idx)}</td>
        <td>${escapeHtml(gpu.name || "NVIDIA GPU")}</td>
        <td>${escapeHtml(formatTemp(gpu.temperature_c))}</td>
      </tr>
    `).join("") : `<tr><td colspan="3">No GPU temperature data returned.</td></tr>`;
    tempWrap.innerHTML = `
      <div class="server-monitor-grid">
        <article class="project-card">
          <h3>CPU / NVMe sensors</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Chip</th><th>Label</th><th>Temp</th></tr></thead><tbody>${cpuRows}</tbody></table></div>
        </article>
        <article class="project-card">
          <h3>GPU sensors</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>GPU</th><th>Name</th><th>Temp</th></tr></thead><tbody>${gpuRows}</tbody></table></div>
        </article>
      </div>
    `;
  }

  const vllmWrap = $("#vllmStatusWrap");
  if (vllmWrap) {
    const modelRows = modelList.length ? modelList.map((model) => `
      <tr>
        <td>${escapeHtml(model.id || model.model || model.name || "model")}</td>
        <td>${escapeHtml(model.is_active ? "active" : model.state || model.status || model.ready || "—")}</td>
        <td>${escapeHtml(model.size_bytes ? formatMaybeBytes(model.size_bytes) : "—")}</td>
      </tr>
    `).join("") : `<tr><td colspan="3">No model list returned.</td></tr>`;
    vllmWrap.innerHTML = `
      <div class="server-monitor-grid">
        <article class="project-card">
          <div class="card-head"><h3>Runtime</h3>${statusChip(serverDetails.vllm)}</div>
          <div class="server-big-metric">${escapeHtml(formatTokenRate(vllmBody?.token_rates?.["1m"]))}</div>
          ${renderKeyValueTable([
            ["Active model", activeModel],
            ["Token rate", tokenRate !== undefined ? `${tokenRate} tok/s` : undefined],
            ["Queue depth", queueDepth],
            ["Running requests", deepGet(vllmBody, ["runtime_counters.requests_running", "running_requests", "active_requests", "requests.running", "data.running_requests"])],
            ["Waiting requests", deepGet(vllmBody, ["runtime_counters.requests_waiting", "waiting_requests", "queued_requests", "requests.waiting", "data.waiting_requests"])],
            ["KV cache", formatPct(deepGet(vllmBody, ["runtime_counters.kv_cache_usage_percent"]))],
            ["Prompt tokens", formatNum(deepGet(vllmBody, ["runtime_counters.prompt_tokens"]) || 0)],
            ["Generation tokens", formatNum(deepGet(vllmBody, ["runtime_counters.generation_tokens"]) || 0)],
            ["Total tokens", formatNum(deepGet(vllmBody, ["runtime_counters.total_tokens"]) || 0)],
          ])}
        </article>
        <article class="project-card">
          <h3>Available models</h3>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Model</th><th>Status</th><th>Size</th></tr></thead>
            <tbody>${modelRows}</tbody>
          </table></div>
        </article>
      </div>
    `;
  }

  const tokenRatesWrap = $("#tokenRatesWrap");
  if (tokenRatesWrap) {
    const rates = vllmBody?.token_rates || {};
    const windows = ["1m", "10m", "1h", "1d"];
    tokenRatesWrap.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Window</th><th>Total</th><th>Prompt</th><th>Generation</th><th>Elapsed</th></tr></thead>
        <tbody>${windows.map((key) => {
          const row = rates[key] || {};
          return `<tr>
            <td>${escapeHtml(key)}</td>
            <td>${escapeHtml(formatTokenRate(row))}</td>
            <td>${escapeHtml(row.prompt_tokens_per_second !== undefined ? Number(row.prompt_tokens_per_second).toFixed(1) : "n/a")}</td>
            <td>${escapeHtml(row.generation_tokens_per_second !== undefined ? Number(row.generation_tokens_per_second).toFixed(1) : "n/a")}</td>
            <td>${escapeHtml(row.elapsed_seconds !== undefined ? `${formatNum(row.elapsed_seconds)}s` : "n/a")}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <p class="muted mt-2">${escapeHtml(rates.storage?.mode || "unknown storage")} ${escapeHtml(rates.storage?.database || "")}</p>
    `;
  }

  const launchWrap = $("#vllmLaunchWrap");
  if (launchWrap) {
    const launch = vllmBody?.launch || {};
    const storage = vllmBody?.token_rates?.storage || {};
    const commandLines = Array.isArray(launch.command_lines) ? launch.command_lines : [];
    launchWrap.innerHTML = `
      <div class="server-monitor-grid">
        <article class="project-card">
          <h3>Launch topology</h3>
          ${renderKeyValueTable([
            ["CUDA devices", Array.isArray(launch.cuda_visible_devices) ? launch.cuda_visible_devices.join(", ") : "—"],
            ["GPU shard count", launch.gpu_shard_count],
            ["Tensor parallel", launch.tensor_parallel_size],
            ["Pipeline parallel", launch.pipeline_parallel_size],
            ["Max model length", formatNum(launch.max_model_len || 0)],
            ["Active model", baseName(activeModel)],
          ])}
        </article>
        <article class="project-card">
          <h3>Token-rate storage</h3>
          ${renderKeyValueTable([
            ["Mode", storage.mode],
            ["Database", storage.database],
            ["Primary database", storage.primary_database],
            ["Fallback database", storage.fallback_database],
            ["Storage note", storage.error],
          ])}
        </article>
        <article class="project-card server-command-card">
          <h3>vLLM processes</h3>
          ${commandLines.length ? commandLines.map((line) => `<pre class="json-block command-line">${escapeHtml(line)}</pre>`).join("") : `<p class="muted">No launch command lines returned.</p>`}
        </article>
      </div>
    `;
  }

  const infraWrap = $("#serverInfrastructureWrap");
  if (infraWrap) {
    const services = Array.isArray(statusBody?.services) ? statusBody.services : [];
    const disks = Array.isArray(statusBody?.disks) ? statusBody.disks : [];
    const serviceRows = services.length ? services.map((svc) => `
      <tr><td>${escapeHtml(svc.name)}</td><td>${escapeHtml(svc.active || "—")}</td><td>${escapeHtml(svc.enabled || "—")}</td></tr>
    `).join("") : `<tr><td colspan="3">No service data returned.</td></tr>`;
    const diskRows = disks.length ? disks.map((disk) => `
      <tr>
        <td>${escapeHtml(disk.path || "—")}</td>
        <td>${escapeHtml(formatMaybeBytes(disk.used_bytes))} / ${escapeHtml(formatMaybeBytes(disk.total_bytes))}</td>
        <td>${pctUsed(disk.used_bytes, disk.total_bytes).toFixed(1)}%</td>
      </tr>
    `).join("") : `<tr><td colspan="3">No disk data returned.</td></tr>`;
    infraWrap.innerHTML = `
      <div class="server-monitor-grid">
        <article class="project-card">
          <h3>Services</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Active</th><th>Enabled</th></tr></thead><tbody>${serviceRows}</tbody></table></div>
        </article>
        <article class="project-card">
          <h3>Disks</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Path</th><th>Usage</th><th>Used</th></tr></thead><tbody>${diskRows}</tbody></table></div>
        </article>
        <article class="project-card">
          <h3>Network</h3>
          ${renderKeyValueTable([
            ["Host", statusBody.hostname],
            ["FQDN", statusBody.fqdn],
            ["Tailscale IP", statusBody.tailscale?.self?.TailscaleIPs?.[0] || statusBody.api?.bind_host],
            ["API", statusBody.api?.bind_host && statusBody.api?.port ? `${statusBody.api.bind_host}:${statusBody.api.port}` : undefined],
          ])}
        </article>
      </div>
    `;
  }

  const raw = $("#serverRawSnapshots");
  if (raw) {
    raw.innerHTML = `
      <div class="server-monitor-grid">
        ${renderJsonBlock("Health", serverDetails.health)}
        ${renderJsonBlock("Status", serverDetails.status)}
        ${renderJsonBlock("vLLM", serverDetails.vllm)}
        ${renderJsonBlock("GPU", serverDetails.gpu)}
      </div>
    `;
  }

  const refresh = $("#serverMonitorRefresh");
  if (refresh && refresh.dataset.wired !== "1") {
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      refresh.textContent = "Refreshing...";
      const next = await loadServerDetails();
      renderServerMonitorPage(next);
      refresh.disabled = false;
      refresh.textContent = "Refresh";
    });
    refresh.dataset.wired = "1";
  }
}

function renderMemoryPage(memoryData, memoryFiles) {
  const stats = $("#memoryStats");
  if (!stats) return;

  const layers = Array.isArray(memoryData?.layers) ? memoryData.layers : [];
  const highRisk = layers.filter((x) => x.risk === "high").length;
  const sections = Array.isArray(memoryData?.understanding) ? memoryData.understanding.length : 0;

  stats.innerHTML = [
    ["Memory sections", sections],
    ["Memory layers", layers.length],
    ["High-risk files", highRisk],
    ["Last update", memoryData?.updatedAt || "—"]
  ].map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");

  const understanding = $("#memoryUnderstanding");
  if (understanding) {
    understanding.innerHTML = (memoryData?.understanding || []).map((s) => `
      <article class="project-card">
        <h3>${s.section}</h3>
        <ul>${(s.points || []).map((p) => `<li>${p}</li>`).join("")}</ul>
      </article>
    `).join("");
  }

  const layersNode = $("#memoryLayers");
  if (layersNode) {
    const rows = (memoryData?.layers || []).map((l) => `<tr><td>${l.name}</td><td>${l.file}</td><td>${l.purpose}</td><td>${l.risk}</td></tr>`).join("");
    layersNode.innerHTML = `<table class="table"><thead><tr><th>Layer</th><th>File</th><th>Purpose</th><th>Risk</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  const browserNode = $("#memoryFileBrowser");
  const editorNode = $("#memoryFileEditor");
  if (browserNode) {
    const files = Array.isArray(memoryFiles?.files) ? memoryFiles.files : [];
    browserNode.innerHTML = files.map((f) => `<button class="btn memory-file-open" data-file-id="${f.id}">${f.label}</button>`).join("") || `<p class="muted">No file snapshots loaded.</p>`;
    browserNode.querySelectorAll('.memory-file-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        const file = files.find((x) => x.id === btn.dataset.fileId);
        if (!file || !editorNode) return;
        editorNode.innerHTML = `
          <div class="kv"><span>File</span><strong>${file.label}</strong></div>
          <div class="kv"><span>Path</span><strong>${file.path}</strong></div>
          <div class="kv"><span>Risk</span><strong>${file.risk}</strong></div>
          ${file.risk === 'high' ? `<div class="warn-box">Editing this incorrectly can break memory/identity behavior. Stage carefully.</div>` : ''}
          <label class="label">Current content snapshot</label>
          <textarea id="memoryFileContent" rows="14">${(file.content || '').replace(/</g,'&lt;')}</textarea>
          <div class="memory-file-editor-actions">
            <button id="memoryStageFileEdit" class="btn">Stage edit</button>
          </div>
          <div id="memoryFileStageMsg" class="muted memory-file-stage-msg"></div>
        `;
        $("#memoryStageFileEdit")?.addEventListener("click", () => {
          const staged = JSON.parse(localStorage.getItem('memory-file-edits') || '{}');
          staged[file.id] = {
            id: file.id,
            label: file.label,
            path: file.path,
            risk: file.risk,
            content: $("#memoryFileContent")?.value || "",
            stagedAt: new Date().toISOString()
          };
          localStorage.setItem('memory-file-edits', JSON.stringify(staged, null, 2));
          $("#memoryFileStageMsg").textContent = `Staged edit saved for ${file.label}`;
        });
      });
    });
  }

  const formNode = $("#memoryFormArea");
  if (formNode) {
    formNode.innerHTML = `
      <div class="projects-grid">
        <article class="project-card">
          <label class="label">Your name</label>
          <input id="mf-name" class="input" placeholder="e.g. Jesse" />
          <label class="label">What should I call you? (Option 1)</label>
          <input id="mf-call-1" class="input" placeholder="e.g. Jesse" />
          <label class="label">What should I call you? (Option 2)</label>
          <input id="mf-call-2" class="input" placeholder="e.g. boss" />
          <label class="label">Your personality (how I should account for it)</label>
          <textarea id="mf-personality" rows="4" placeholder="e.g. technical, fast-moving, execution-first"></textarea>
        </article>
        <article class="project-card">
          <label class="label">Where do you live / timezone context</label>
          <input id="mf-location" class="input" placeholder="e.g. Australia/Sydney" />
          <label class="label">What should I know about you to work better with you?</label>
          <textarea id="mf-about-you" rows="4" placeholder="e.g. communication preferences, non-negotiables"></textarea>
          <label class="label">What I should tell you about me (assistant identity/tone)</label>
          <textarea id="mf-about-me" rows="4" placeholder="e.g. tone, level of proactivity, decision style"></textarea>
        </article>
      </div>
      <div class="good-box">This form creates a structured, reviewable memory profile draft. It does not overwrite source files directly.</div>
      <div class="mt-2"><button id="mf-save" class="btn">Save staged profile</button></div>
    `;
    $("#mf-save")?.addEventListener("click", () => {
      const payload = {
        name: $("#mf-name")?.value || "",
        callOptions: [$("#mf-call-1")?.value || "", $("#mf-call-2")?.value || ""].filter(Boolean),
        personality: $("#mf-personality")?.value || "",
        location: $("#mf-location")?.value || "",
        aboutYou: $("#mf-about-you")?.value || "",
        aboutAssistant: $("#mf-about-me")?.value || "",
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem("memory-form-staged", JSON.stringify(payload, null, 2));
    });
  }

  const exportNode = $("#memoryExportArea");
  if (exportNode) {
    exportNode.innerHTML = `<div class="warn-box">Changes here are staged only. Applying to real files should require explicit review.</div><label class="label">Type CONFIRM to export high-risk edits</label><input id="memory-confirm" class="input" placeholder="CONFIRM" /><div class="mt-2"><button id="memory-export" class="btn">Export staged memory changes</button></div><div id="memoryExportWarnings" class="muted"></div>`;
    $("#memory-export")?.addEventListener("click", () => {
      const form = JSON.parse(localStorage.getItem("memory-form-staged") || "{}");
      const edits = Array.from(document.querySelectorAll(".memory-edit")).map((el) => ({ id: el.dataset.editId, text: el.value || "", risk: el.dataset.risk || "low" })).filter((x) => x.text.trim());
      const riskAlerts = [];
      edits.forEach((e) => {
        const t = e.text.toLowerCase();
        if (t.includes("delete all") || t.includes("wipe") || t.includes("forget everything")) riskAlerts.push(`${e.id}: destructive wording detected`);
      });
      const hasHigh = edits.some((e) => e.risk === "high");
      const confirm = $("#memory-confirm")?.value || "";
      if (hasHigh && confirm !== "CONFIRM") {
        $("#memoryExportWarnings").textContent = "High-risk edits present. Type CONFIRM before export.";
        return;
      }
      $("#memoryExportWarnings").textContent = riskAlerts.length ? `Warnings: ${riskAlerts.join("; ")}` : "No obvious risk phrases detected.";
      const fileEdits = JSON.parse(localStorage.getItem('memory-file-edits') || '{}');
      const payload = { exportedAt: new Date().toISOString(), stagedForm: form, directEdits: edits, fileEdits, riskAlerts, warning: "Review before applying to source memory files." };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `memory-staged-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}

function getSkillConfigStoreKey(skillId) {
  return `lilzen-skill-config-v2-${skillId}`;
}

function readSkillConfig(skillId) {
  try {
    return JSON.parse(localStorage.getItem(getSkillConfigStoreKey(skillId)) || "{}");
  } catch {
    return {};
  }
}

function writeSkillConfig(skillId, payload) {
  localStorage.setItem(
    getSkillConfigStoreKey(skillId),
    JSON.stringify(payload, null, 2)
  );
}

function deleteSkillConfig(skillId) {
  localStorage.removeItem(getSkillConfigStoreKey(skillId));
}

function riskColorClass(level) {
  const norm = String(level || "low").toLowerCase();
  if (norm.includes("high")) return "chip chip-bad";
  if (norm.includes("medium")) return "chip chip-warn";
  if (norm.includes("low")) return "chip chip-ok";
  return "chip";
}

function escapeAttr(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderField(field, value) {
  const required = field.required ? "required" : "";
  const requiredText = field.required ? ' <span class="required-mark">*<\/span>' : "";
  const help = field.help || "";
  const v = value != null ? value : "";

  if (field.type === 'textarea') {
    return `
      <label class="label">${field.label}${requiredText}</label>
      <textarea class="input" data-field-id="${field.id}" ${required}>${escapeAttr(v)}</textarea>
      <small class="muted">${help}</small>
    `;
  }

  if (field.type === 'select') {
    const options = Array.isArray(field.options) ? field.options : [];
    const current = v || field.default || '';
    const opts = options
      .map((x) => `<option value="${escapeAttr(x)}" ${String(current) === String(x) ? 'selected' : ''}>${escapeAttr(x)}</option>`)
      .join('');
    return `
      <label class="label">${field.label}${requiredText}</label>
      <select class="input" data-field-id="${field.id}" ${required}>${opts}</select>
      <small class="muted">${help}</small>
    `;
  }

  const type = field.type === 'url' ? 'url' : 'text';
  const placeholder = field.placeholder ? `placeholder="${escapeAttr(field.placeholder)}"` : '';
  return `
    <label class="label">${field.label}${requiredText}</label>
    <input class="input" type="${type}" data-field-id="${field.id}" value="${escapeAttr(v)}" ${placeholder} ${required}>
    <small class="muted">${help}</small>
  `;
}

function renderSecretsPage(secretRegistry) {
  const stats = $("#secretsStats");
  if (!stats) return;
  const rows = Array.isArray(secretRegistry?.rows) ? secretRegistry.rows : [];
  const readable = rows.filter((r) => r.readable).length;
  const missing = rows.filter((r) => !r.exists).length;
  stats.innerHTML = [
    ["Registered aliases", rows.length],
    ["Readable", readable],
    ["Missing", missing],
    ["Project", secretRegistry?.project || "—"]
  ].map(([l,v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");

  const table = $("#secretsRegistryTable");
  if (table) {
    const body = rows.map((r) => `<tr><td>${r.alias}</td><td>${r.secret}</td><td>${r.owner || "—"}</td><td>${r.sensitivity || "—"}</td><td>${r.exists ? "yes" : "no"}</td><td>${r.readable ? "yes" : "no"}</td></tr>`).join("");
    table.innerHTML = `<table class="table"><thead><tr><th>Alias</th><th>GSM Secret</th><th>Owner</th><th>Sensitivity</th><th>Exists</th><th>Readable</th></tr></thead><tbody>${body}</tbody></table><p class="muted mt-2">Updated: ${secretRegistry?.updatedAt || "unknown"}</p>`;
  }
}

function renderCapabilitiesPage(capabilityData) {
  const stats = $("#capabilityStats");
  if (!stats) return;

  const skills = Array.isArray(capabilityData?.skills) ? capabilityData.skills : [];
  const mcpServers = Array.isArray(capabilityData?.mcpServers) ? capabilityData.mcpServers : [];
  const riskProfile = capabilityData?.riskProfile || {};
  const mcpWorking = mcpServers.filter((x) => x.status === "working").length;

  const highRisk = Array.isArray(skills)
    ? skills.filter((s) => (s.risk?.level || "").toLowerCase().includes("high")).length
    : 0;
  const mediumRisk = Array.isArray(skills)
    ? skills.filter((s) => {
        const level = String(s.risk?.level || "").toLowerCase();
        return level.includes("medium") && !level.includes("high");
      }).length
    : 0;

  const statCards = [
    ["Installed Skills", skills.length],
    ["MCP Servers", mcpServers.length],
    ["MCP Working", mcpWorking],
    ["High-risk skills", highRisk],
  ];

  if (mediumRisk) {
    statCards.push(["Medium-risk skills", mediumRisk]);
  }
  stats.innerHTML = statCards
    .map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`)
    .join("");

  const review = $("#reviewOutcome");
  if (review) {
    const r = capabilityData?.scheduledReview || {};
    review.innerHTML = `
      <div class="kv"><span>Cron</span><strong>${r.cronName || "—"}</strong></div>
      <div class="kv"><span>Schedule</span><strong>${r.schedule || "—"}</strong></div>
      <div class="kv"><span>Last run</span><strong>${r.lastRunDate || "—"} (${r.lastRunStatus || "unknown"})</strong></div>
      <div class="kv"><span>Summary</span><strong>${r.summaryPath || "—"}</strong></div>
      <p>${r.outcome || "No review outcome recorded yet."}</p>
    `;
  }

  const riskNode = $("#riskProfile");
  if (riskNode) {
    const counts = riskProfile?.counts || {};
    const items = Array.isArray(riskProfile?.items) ? riskProfile.items : [];
    const controls = Array.isArray(riskProfile?.controls) ? riskProfile.controls : [];

    riskNode.innerHTML = `
      <div class="kv"><span>Last scan</span><strong>${riskProfile.lastScanned || "—"}</strong></div>
      <div class="kv"><span>Overall level</span><strong>${riskProfile.overallLevel || "unknown"}</strong></div>
      <div class="kv"><span>Exposure score</span><strong>${riskProfile.exposureScore || "—"}</strong></div>
      <div class="risk-summary">
        <span class="chip chip-bad">High ${counts.high || 0}</span>
        <span class="chip chip-warn">Medium ${counts.medium || 0}</span>
        <span class="chip chip-ok">Low ${counts.low || 0}</span>
      </div>
      <div class="mt-3">
        <div class="label">Top exposure points</div>
        <ul class="risk-list">${items.map((i) => `<li>${i.id}: ${i.reason || ""}</li>`).join("") || '<li>No immediate high-signal exposures logged.</li>'}</ul>
      </div>
      <div class="mt-3">
        <div class="label">Required control actions</div>
        <ul class="risk-list">${controls.map((c) => `<li>${c}</li>`).join("") || '<li>No recommendations logged.</li>'}</ul>
      </div>
    `;
  }

  const skillById = Object.fromEntries(skills.map((s) => [s.id, s]));
  const skillsGrid = $("#skillsGrid");
  const detail = $("#skillDetail");
  if (skillsGrid) {
    skillsGrid.innerHTML = skills
      .map((s) => {
        const risk = s.risk || {};
        return `
          <article class="project-card skill-card" data-skill-id="${s.id}">
            <div class="card-head">
              <h3>${s.name}</h3>
              <div class="card-actions">
                <button class="btn icon-btn skill-config-btn" title="Configure ${s.name}" data-skill-id="${s.id}">⚙️</button>
              </div>
            </div>
            <span class="chip ${riskColorClass(risk.level)}">${risk.level || "unknown"}</span>
            <p class="muted">${s.description || ""}</p>
            <div class="kv"><span>Path</span><strong>${s.location || "—"}</strong></div>
            <div class="kv"><span>Status</span><strong>${s.status || "unknown"}</strong></div>
          </article>
        `;
      })
      .join("") || `<article class="project-card"><h3>No skills found</h3></article>`;

    const openSkill = (id, forceOpenConfig = false) => {
      const skill = skillById[id];
      if (!skill || !detail) return;

      const existing = readSkillConfig(id) || {};
      const fields = Array.isArray(skill.configFields) ? skill.configFields : [];
      const risk = skill.risk || {};
      const help = Array.isArray(skill.helpResources) ? skill.helpResources : [];

      const fieldValues = existing.fields || {};
      const notes = existing.notes || "";
      const controls = existing.controls || {};

      detail.innerHTML = `
        <div class="card-head"><h3>${skill.name}</h3><span class="chip">${risk.level || "unknown"}</span></div>
        <p class="muted">${skill.description || ""}</p>
        <div class="kv"><span>Risk score</span><strong>${risk.score || "—"}</strong></div>
        <div class="kv"><span>Location</span><strong>${skill.location || "—"}</strong></div>

        <div class="config-grid">
          <div class="form-col">
            <label class="label">Access / Config Fields</label>
            ${fields.map((field) => renderField(field, fieldValues[field.id])).join("") || '<div class="muted">No explicit configuration fields for this skill.</div>'}
          </div>
          <div class="note-col">
            <label class="label">Setup notes</label>
            <textarea id="skillCfgArea" class="input" placeholder="How this is wired in practice / gotchas to remember">${notes}</textarea>
            <div class="good-box">
              <strong>Storage & policy</strong>
              <p class="muted">${risk.recommendedStorage || "Use project policy."}</p>
            </div>
            <label class="label">Recommended controls</label>
            <div class="config-help">
              <ul>
                ${Array.isArray(skill.risk?.reasons) ? skill.risk.reasons.map((r) => `<li>${r}</li>`).join("") : '<li>No risks listed.</li>'}
              </ul>
            </div>
            <label class="label">How to get credentials / IDs</label>
            <ul class="config-help">
              ${help.length ? help.map((h) => `<li><a class="links" href="${h.url}" target="_blank" rel="noopener">${h.title}</a></li>`).join("") : '<li>No links configured.</li>'}
            </ul>
          </div>
        </div>

        <div class="inline-actions inline-actions-wrap mt-2">
          <button id="saveSkillCfg" class="btn">Save config notes</button>
          <button id="clearSkillCfg" class="btn">Clear config</button>
          <button id="exportSkillCfg" class="btn">Export policy payload</button>
        </div>
      `;

      if (controls) {
        const manualConfigBtn = $("#saveSkillCfg");
        if (manualConfigBtn) {
          manualConfigBtn.addEventListener("click", () => {
            const notesNode = $("#skillCfgArea");
            const nextFields = {};
            const required = [];

            fields.forEach((field) => {
              const node = document.querySelector(`[data-field-id="${field.id}"]`);
              if (!node) return;
              const value = String(node.value || "").trim();
              if (field.required && !value) required.push(field.label);
              nextFields[field.id] = value;
            });

            if (required.length) {
              window.alert(`Missing required fields: ${required.join(", ")}`);
              return;
            }

            const payload = {
              updatedAt: new Date().toISOString(),
              notes: notesNode ? notesNode.value : "",
              fields: nextFields
            };
            writeSkillConfig(id, payload);
            manualConfigBtn.textContent = "Saved ✓";
            setTimeout(() => {
              manualConfigBtn.textContent = "Save config notes";
            }, 1300);
          }, { once: true });
        }
      }

      $("#clearSkillCfg")?.addEventListener("click", () => {
        deleteSkillConfig(id);
        const textarea = $("#skillCfgArea");
        if (textarea) textarea.value = "";
        fields.forEach((field) => {
          const node = document.querySelector(`[data-field-id="${field.id}"]`);
          if (node) node.value = "";
        });
      }, { once: true });

      $("#exportSkillCfg")?.addEventListener("click", () => {
        const payload = {
          skillId: id,
          exportedAt: new Date().toISOString(),
          skillName: skill.name,
          storedRefs: Object.fromEntries(
            fields
              .filter((f) => (f.type === 'select' || f.type === 'text' || f.type === 'url' || f.type === 'textarea'))
              .map((f) => [f.id, (readSkillConfig(id).fields || {})[f.id] || ""])
          ),
          notes: (readSkillConfig(id).notes || "")
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `skill-config-${id}-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, { once: true });
    };

    skillsGrid.querySelectorAll(".skill-card").forEach((el) => {
      const id = el.getAttribute("data-skill-id");
      el.addEventListener("click", () => openSkill(id));
    });

    skillsGrid.querySelectorAll(".skill-config-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-skill-id");
        openSkill(id, true);
      });
    });
  }

  const mcpGrid = $("#mcpGrid");
  if (mcpGrid) {
    const mcpCards = mcpServers.map((m) => `
        <article class="project-card">
          <div class="card-head">
            <h3>${m.name || m.id || "mcp-server"}</h3>
            <button class="btn icon-btn mcp-config-btn" title="Configure MCP" data-mcp-id="${m.id || m.name || 'mcp'}">⚙️</button>
          </div>
          <p class="muted">${m.description || ""}</p>
          <div class="kv"><span>Status</span><strong>${m.status || "unknown"}</strong></div>
          <div class="kv"><span>Type</span><strong>${m.transport || "—"}</strong></div>
        </article>
      `);

    const addServerHint = `
      <article class="project-card">
        <div class="card-head">
          <h3>Add MCP server</h3>
          <button class="btn icon-btn mcp-config-btn" title="Configure MCP" data-mcp-id="new-mcp">⚙️</button>
        </div>
        <p class="muted">Use mcp-onboarding to register the first server.
Open /etc/openclaw/mcp.json as backend source of truth.</p>
      </article>
    `;

    mcpGrid.innerHTML = (mcpCards.length ? mcpCards.join("") : addServerHint);

    mcpGrid.querySelectorAll(".mcp-config-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const mcpId = btn.getAttribute("data-mcp-id");
        if (!detail) return;
        detail.innerHTML = `
          <h3>MCP config</h3>
          <p class="muted">${mcpId}</p>
          <p class="warn">Not yet connected to MCP secret/config schema for this item.</p>
          <label class="label">Suggested values to capture</label>
          <div class="kv"><span>Config location</span><strong>~/.config/openclaw/mcp.json</strong></div>
          <div class="kv"><span>Notes</span><strong>Set via mcporter and review transport/auth method before enabling.</strong></div>
        `;
      });
    });
  }

  $("#riskRefreshBtn")?.addEventListener("click", () => window.location.reload(), { once: true });
}

function scheduleText(s) {
  if (!s) return "—";
  if (s.kind === "every") {
    const mins = Math.round((Number(s.everyMs || 0) / 60000) * 10) / 10;
    return `Every ${mins} min`;
  }
  if (s.kind === "cron") return `Cron: ${s.expr || "?"}${s.tz ? ` (${s.tz})` : ""}`;
  if (s.kind === "at") return `At: ${s.at || "?"}`;
  return JSON.stringify(s);
}

function periodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    const day = now.getDay(); // Sunday=0
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

function cronActionsLoad() {
  try { return JSON.parse(localStorage.getItem("cron-actions-queue-v1") || "[]"); }
  catch { return []; }
}

function cronActionsSave(items) {
  localStorage.setItem("cron-actions-queue-v1", JSON.stringify(items, null, 2));
}

function renderCronPlannerPage(data) {
  const cronTableBody = $("#cronTableBody");
  if (!cronTableBody) return;

  const cronJobs = Array.isArray(data?.cronJobs) ? data.cronJobs : [];
  const runEvents = Array.isArray(data?.cronRunEvents) ? data.cronRunEvents : [];
  const initiatives = Array.isArray(data?.plannedInitiatives) ? data.plannedInitiatives : [];

  const viewCronBtn = $("#viewCronBtn");
  const viewPlannerBtn = $("#viewPlannerBtn");
  const cronView = $("#cronView");
  const plannerView = $("#plannerView");
  const cronMetricsNode = $("#cronMetrics");
  const cronChartNode = $("#cronChart");
  const periodButtonsNode = $("#periodButtons");

  const setView = (v) => {
    const isCron = v === "cron";
    if (cronView) cronView.classList.toggle("is-hidden", !isCron);
    if (plannerView) plannerView.classList.toggle("is-hidden", isCron);
    if (cronMetricsNode) cronMetricsNode.classList.toggle("is-hidden", !isCron);
    if (cronChartNode) cronChartNode.classList.toggle("is-hidden", !isCron);
    if (periodButtonsNode) periodButtonsNode.classList.toggle("is-hidden", !isCron);
    viewCronBtn?.classList.toggle("btn-active", isCron);
    viewPlannerBtn?.classList.toggle("btn-active", !isCron);
  };
  viewCronBtn?.addEventListener("click", () => setView("cron"));
  viewPlannerBtn?.addEventListener("click", () => setView("planner"));

  let period = "today";
  const periodButtons = document.querySelectorAll("#periodButtons [data-period]");
  const setPeriod = (p) => {
    period = p;
    periodButtons.forEach((b) => b.classList.toggle("btn-active", b.dataset.period === p));
    drawCronMetrics();
    drawCronChart();
  };
  periodButtons.forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));

  function estimatedSchedulesInPeriod(job) {
    const { start, end } = periodRange(period);
    const durationMs = Math.max(1, end - start);
    const sch = job.schedule || {};
    if (sch.kind === "every") {
      const everyMs = Number(sch.everyMs || 0);
      if (!everyMs) return 0;
      return Math.floor(durationMs / everyMs) + 1;
    }
    if (sch.kind === "cron") {
      const expr = sch.expr || "";
      if (expr === "10 * * * *") return Math.floor(durationMs / 3600000) + 1;
      if (expr === "0 */3 * * *") return Math.floor(durationMs / (3 * 3600000)) + 1;
      if (expr === "5 */2 * * *") return Math.floor(durationMs / (2 * 3600000)) + 1;
      if (expr === "0 3 * * *" || expr === "0 6 * * *" || expr === "0 9 * * *" || expr === "10 2 * * *") return Math.ceil(durationMs / 86400000);
      return 0;
    }
    return 0;
  }

  function drawCronMetrics() {
    const target = $("#cronMetrics");
    if (!target) return;

    const { start, end } = periodRange(period);
    const periodEvents = runEvents.filter((e) => {
      const d = new Date(e.runAt || e.time || e.at);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    });

    const scheduled = cronJobs.reduce((a, j) => a + estimatedSchedulesInPeriod(j), 0);
    const totalRuns = periodEvents.length;
    const passed = periodEvents.filter((e) => String(e.status || "").toLowerCase() === "ok").length;
    const failed = periodEvents.filter((e) => String(e.status || "").toLowerCase() !== "ok").length;
    const passPct = totalRuns ? Math.round((passed / totalRuns) * 100) : 0;

    target.innerHTML = [
      ["Runs / Scheduled", `${totalRuns} / ${scheduled}`],
      ["Pass / Fail", `${passed} / ${failed}`],
      ["Pass Ratio", `${passPct}%`],
      ["Jobs in scope", cronJobs.length]
    ].map(([l, v]) => `<article class="stat"><div class="label">${l}</div><div class="value">${v}</div></article>`).join("");
  }

  function drawCronChart() {
    const target = $("#cronChart");
    if (!target) return;
    const bins = Array.from({ length: 24 }, () => 0);

    cronJobs.forEach((j) => {
      const next = new Date(j.nextRunAt);
      if (!Number.isNaN(next.getTime())) bins[next.getHours()] += 1;
    });

    const yMax = 20;
    const bars = bins.map((v, h) => {
      const clamped = Math.min(yMax, Math.max(0, v));
      const pct = Math.round((clamped / yMax) * 100);
      return `<div class="hour-bar-wrap"><div class="hour-bar" style="height:${Math.max(0, pct)}%"></div><div class="hour-label">${String(h).padStart(2, "0")}</div></div>`;
    }).join("");

    target.innerHTML = `
      <div class="panel-head"><h3>Runs by Time of Day</h3></div>
      <div class="hourly-chart-frame">
        <div class="y-axis">
          <div class="y-top">20</div>
          <div class="y-mid-ticks">·</div>
          <div class="y-bottom">1</div>
        </div>
        <div class="hourly-chart-grid">
          <div class="grid-ticks"></div>
          <div class="hourly-chart">${bars}</div>
        </div>
      </div>
      <p class="muted">Time of day</p>
    `;
  }

  function pushAction(action) {
    const queued = cronActionsLoad();
    queued.unshift({ ...action, stagedAt: new Date().toISOString() });
    cronActionsSave(queued);
    renderActionQueue();
  }

  function renderActionQueue() {
    const node = $("#cronActionQueue");
    if (!node) return;
    const queued = cronActionsLoad();
    if (!queued.length) {
      node.textContent = "No staged actions.";
      return;
    }
    node.innerHTML = queued.slice(0, 20).map((a, idx) => `<div class="kv"><span>${idx + 1}. ${a.type}</span><strong>${a.jobName || a.planId || "item"}</strong></div>`).join("");
  }

  cronTableBody.innerHTML = cronJobs.map((j) => `
    <tr data-job-id="${j.id}">
      <td><button class="btn cron-name-btn" data-job-id="${j.id}">${j.name}</button></td>
      <td>${j.description || "—"}</td>
      <td>${scheduleText(j.schedule)}</td>
      <td>${fmtDateTime(j.nextRunAt)}</td>
      <td>${fmtDateTime(j.lastRunAt)}</td>
      <td><span class="chip ${String(j.lastStatus || "").toLowerCase() === "ok" ? "chip-ok" : "chip-bad"}">${j.lastStatus || "unknown"}</span></td>
      <td>
        <div class="kanban-actions">
          <button class="btn cron-run-btn" data-job-id="${j.id}">Run now</button>
          <button class="btn cron-edit-btn" data-job-id="${j.id}">Change schedule</button>
          <button class="btn cron-delete-btn" data-job-id="${j.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  $("#cronTableBody")?.querySelectorAll(".cron-name-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = cronJobs.find((x) => x.id === btn.dataset.jobId);
      if (!job) return;
      const detail = $("#cronDetail");
      if (!detail) return;
      detail.innerHTML = `
        <h3>${job.name}</h3>
        <p class="muted">${job.description || "No description."}</p>
        <div class="kv"><span>ID</span><strong>${job.id}</strong></div>
        <div class="kv"><span>Schedule</span><strong>${scheduleText(job.schedule)}</strong></div>
        <div class="kv"><span>Enabled</span><strong>${job.enabled ? "yes" : "no"}</strong></div>
        <div class="kv"><span>Payload Kind</span><strong>${job.payloadKind || "—"}</strong></div>
        <div class="kv"><span>Next</span><strong>${fmtDateTime(job.nextRunAt)}</strong></div>
        <div class="kv"><span>Last run</span><strong>${fmtDateTime(job.lastRunAt)} (${job.lastStatus || "unknown"})</strong></div>
      `;
    });
  });

  $("#cronTableBody")?.querySelectorAll(".cron-run-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = cronJobs.find((x) => x.id === btn.dataset.jobId);
      if (!job) return;
      pushAction({ type: "cron.run", jobId: job.id, jobName: job.name, note: "Run requested from control plane" });
    });
  });

  $("#cronTableBody")?.querySelectorAll(".cron-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = cronJobs.find((x) => x.id === btn.dataset.jobId);
      if (!job) return;
      const current = scheduleText(job.schedule);
      const patch = prompt(`Enter new schedule expression or interval for ${job.name}`, current);
      if (!patch) return;
      pushAction({ type: "cron.update", jobId: job.id, jobName: job.name, patch });
    });
  });

  $("#cronTableBody")?.querySelectorAll(".cron-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = cronJobs.find((x) => x.id === btn.dataset.jobId);
      if (!job) return;
      const ok = confirm(`Delete cron job ${job.name}? This queues a delete request.`);
      if (!ok) return;
      pushAction({ type: "cron.remove", jobId: job.id, jobName: job.name });
    });
  });

  const laneNode = $("#plannerSwimlanes");
  const summaryNode = $("#initiativeSummary");
  if (laneNode) {
    laneNode.innerHTML = initiatives.map((init) => {
      const holdKey = `initiative-hold-${init.planId}`;
      const held = localStorage.getItem(holdKey) === "1" || init.onHold;
      const overall = held ? "on_hold" : (init.status || "not_started");
      const steps = Array.isArray(init.steps) ? init.steps : [];
      return `
      <section class="panel mb-3">
        <div class="panel-head">
          <div>
            <h3>${init.title}</h3>
            <p class="muted">${init.description || ""}</p>
          </div>
          <div class="kanban-actions">
            <span class="chip">${overall}</span>
            <button class="btn initiative-hold-btn" data-plan-id="${init.planId}" data-held="${held ? "1" : "0"}">${held ? "Resume" : "Put on hold"}</button>
          </div>
        </div>
        <div class="kv"><span>Outcome</span><strong>${init.requestedOutcome || "—"}</strong></div>
        <div class="swimlane">
          ${steps.map((s) => `
            <article class="step-card step-${(s.state || "not_started").toLowerCase()}">
              <div class="kv"><span>${s.id}</span><strong>${s.state || "not_started"}</strong></div>
              <h4>${s.title}</h4>
              <p class="muted">${s.description || ""}</p>
              <p><strong>Instruction:</strong> ${s.instruction || "—"}</p>
              ${s.details ? `<button class="btn step-detail-btn" data-detail="${(s.details || "").replace(/"/g, '&quot;')}">More detail</button>` : ""}
            </article>
          `).join("")}
        </div>
      </section>`;
    }).join("");

    laneNode.querySelectorAll(".step-detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => alert(btn.dataset.detail || "No extra detail."));
    });

    laneNode.querySelectorAll(".initiative-hold-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const planId = btn.dataset.planId;
        const held = btn.dataset.held === "1";
        localStorage.setItem(`initiative-hold-${planId}`, held ? "0" : "1");
        pushAction({ type: held ? "initiative.resume" : "initiative.hold", planId });
        renderCronPlannerPage(data);
      });
    });
  }

  if (summaryNode) {
    summaryNode.innerHTML = initiatives.map((init) => `<div class="kv"><span>${init.title}</span><strong>${init.status || "not_started"}</strong></div>`).join("");
  }

  $("#exportCronActionsBtn")?.addEventListener("click", () => {
    const queued = cronActionsLoad();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), actions: queued }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cron-planner-actions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  setView("cron");
  setPeriod("today");
  renderActionQueue();
}

function prettifyFolder(folder) {
  return String(folder || "Unassigned")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function samEmptyState({ title, detail }) {
  return `<div class="sam-empty-state"><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(detail)}</p></div>`;
}

function isSamReviewForm(node) {
  return Boolean(node?.closest?.("#samEmailReviewForm, #samFinanceInspectorForm, #samDecisionInspectorForm, #samDirectoryInspectorForm, #samPolicyForm, #samRuleEditorForm, #samCreateRuleForm"));
}

function hasActiveSamDraft() {
  if (isSamReviewForm(document.activeElement)) return true;
  return Boolean(document.querySelector('[data-sam-dirty="1"]'));
}

function markSamFormClean(form) {
  if (form) form.dataset.samDirty = "0";
}

document.addEventListener("input", (event) => {
  const form = event.target?.closest?.("form");
  if (isSamReviewForm(form)) form.dataset.samDirty = "1";
});

document.addEventListener("change", (event) => {
  const form = event.target?.closest?.("form");
  if (isSamReviewForm(form)) form.dataset.samDirty = "1";
});

let samBackendState = { checked: false, writable: false, mode: "snapshot-only", detail: "Enable the same-origin Sam API to allow live edits. Without it, this deployment stays snapshot-only." };
const samUiState = window.__samUiState || {
  decisions: { selectedId: "" },
  directory: { selectedEmail: "" },
  finance: { selectedKey: "" },
  rules: { selectedId: "" },
};
window.__samUiState = samUiState;

function getSamTaxonomy(data) {
  return Array.isArray(data?.policies?.taxonomy) ? data.policies.taxonomy : [];
}

function getSamFolderOptions(data) {
  const fromPolicies = Object.values(data?.policies?.folderMap || {});
  const fromOverview = Object.keys(data?.overview?.folderDistribution || {});
  return Array.from(new Set([...fromPolicies, ...fromOverview].filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getSamEntityTypes(data) {
  const fromDirectory = (Array.isArray(data?.directory) ? data.directory : []).map((item) => item.entityType).filter(Boolean);
  return Array.from(new Set(fromDirectory)).sort((a, b) => a.localeCompare(b));
}

function getSamMailboxOptions(data) {
  const sources = [
    ...(Array.isArray(data?.recentDecisions) ? data.recentDecisions : []).map((item) => item.mailbox),
    ...(Array.isArray(data?.financeLedger) ? data.financeLedger : []).map((item) => item.mailbox),
  ];
  return Array.from(new Set(sources.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

const SAM_RULE_DRAFT_KEY = "sam_rule_draft_v2";

function samLoadRuleDraft() {
  try {
    return JSON.parse(window.localStorage.getItem(SAM_RULE_DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

function samSaveRuleDraft(draft) {
  try {
    window.localStorage.setItem(SAM_RULE_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {}
}

function samClearRuleDraft() {
  try {
    window.localStorage.removeItem(SAM_RULE_DRAFT_KEY);
  } catch {}
}

function samRuleScopeLabel(kind) {
  return kind === "domain" ? "Domain rule" : "Sender rule";
}

function samRuleSourceLabel(source) {
  const label = source || "custom";
  if (label === "legacy") return "Legacy list";
  if (label === "custom") return "Custom rule";
  return titleCaseToken(label);
}

function samRulePrecedence(rule) {
  if (rule?.source === "override") {
    return { level: 1, label: "Highest", summary: "Explicit operator override wins first." };
  }
  if (rule?.source === "custom" && rule?.kind === "sender") {
    return { level: 2, label: "High", summary: "Exact sender rule beats domain and pattern rules." };
  }
  if (rule?.source === "custom" && rule?.kind === "domain") {
    return { level: 3, label: "Medium", summary: "Domain rule applies after sender-specific rules." };
  }
  if (rule?.source === "legacy") {
    return { level: 4, label: "Reference", summary: "Legacy list influences routing but is less explicit than custom rules." };
  }
  if (rule?.source === "pattern") {
    return { level: 5, label: "Policy", summary: "Pattern/category rule applies after entity-specific rules." };
  }
  return { level: 6, label: "Derived", summary: "Inference only, used when no explicit rule wins." };
}

function samBuildRuleStructure(rule, data) {
  const taxonomy = getSamTaxonomy(data);
  const categoryLabel = taxonomy.find((item) => item.id === rule?.classificationType)?.label || "Advisory";
  const scopeValue = rule?.match || rule?.when || "";
  const conditions = [];
  if (rule?.kind === "sender") conditions.push(`Exact sender = ${scopeValue || "unset"}`);
  if (rule?.kind === "domain") conditions.push(`Sender domain = ${scopeValue || "unset"}`);
  if (rule?.when) conditions.push(rule.when);
  if (rule?.notify) conditions.push(`Notify = ${rule.notify}`);
  if (!conditions.length && scopeValue) conditions.push(scopeValue);
  const precedence = samRulePrecedence(rule);
  const action = {
    category: categoryLabel,
    folder: prettifyFolder(rule?.targetFolder || rule?.target || ""),
    relevance: rule?.jesseRelevance || "medium",
    urgency: rule?.urgencySafety || "medium",
  };
  const actionSummary = [action.category, rule?.targetFolder || rule?.target ? action.folder : "", `${action.urgency} urgency`].filter(Boolean).join(" -> ") || "Advisory only";
  return {
    scopeLabel: samRuleScopeLabel(rule?.kind),
    scopeValue,
    conditions,
    precedence,
    action,
    actionSummary,
    notes: rule?.notes || rule?.description || rule?.detail || "",
  };
}

function samPatternRules(data) {
  const priorityRules = Array.isArray(data?.policies?.priorityRules) ? data.policies.priorityRules : [];
  const notifyTerms = Array.isArray(data?.policies?.notify?.telegramImmediateWhen) ? data.policies.notify.telegramImmediateWhen : [];
  const patternRules = priorityRules.map((rule, index) => ({
    id: rule.id || `priority-${index}`,
    source: "pattern",
    kind: "pattern",
    group: "Priority routing",
    match: rule.when || "",
    when: rule.when || "",
    classificationType: "",
    target: rule.target || "",
    notify: rule.notify || "",
    description: rule.name || "Priority routing rule",
    detail: rule.when || "",
  }));
  notifyTerms.forEach((term, index) => {
    patternRules.push({
      id: `notify-${index}`,
      source: "pattern",
      kind: "pattern",
      group: "Notify triggers",
      match: term,
      when: `Message contains term: ${term}`,
      classificationType: "reviewAction",
      target: "",
      notify: "immediate",
      description: "Immediate notification trigger",
      detail: "Escalates matching mail outside sender-specific rules.",
    });
  });
  return patternRules;
}

function samDecisionRuleDraft(decision, scope = "sender") {
  const domain = (decision?.email || "").split("@")[1] || "";
  const match = scope === "domain" ? domain : (decision?.email || "");
  return {
    mode: "custom",
    source: "decision",
    scope,
    kind: scope,
    match,
    group: decision?.override ? "Promoted inbox overrides" : "Decision-promoted rules",
    classificationType: decision?.override?.classificationType || decision?.classificationType || "reviewAction",
    targetFolder: decision?.override?.folder || decision?.derivedFolder || "",
    jesseRelevance: decision?.override?.jesseRelevance || decision?.jesseRelevance || "medium",
    urgencySafety: decision?.override?.urgencySafety || decision?.urgencySafety || "medium",
    description: decision?.override?.explanation || decision?.explanationFields?.summary || decision?.explanation || "",
    notes: decision?.override?.evidence || decision?.relevanceNote || "",
    confidence: decision?.override?.confidence || decision?.confidenceLabel || "medium",
    originLabel: decision?.displayName || decision?.email || "Decision",
    originId: decision?.decisionId || "",
  };
}

function samDirectoryRuleDraft(sender, data) {
  return {
    mode: "custom",
    source: "directory",
    scope: "sender",
    kind: "sender",
    match: sender?.email || "",
    group: "Directory-promoted rules",
    classificationType: sender?.operatorCategoryPreference || sender?.lastCategory || "reviewAction",
    targetFolder: sender?.operatorFolderPreference || (sender?.foldersSeen || []).slice(-1)[0] || getSamFolderOptions(data)[0] || "",
    jesseRelevance: sender?.jesseImportance || "medium",
    urgencySafety: "medium",
    description: sender?.relevanceNote || sender?.importanceReason || sender?.notes || "",
    notes: (sender?.domains || []).join(", "),
    confidence: samConfidenceBucket(sender?.avgConfidence || 0),
    originLabel: sender?.displayName || sender?.email || "Directory record",
    originId: sender?.email || "",
  };
}

function wireSamSelect(selectId, values, onChange, label = "All") {
  const el = $(selectId);
  if (!el) return;
  const prior = el.value || "all";
  el.innerHTML = [`<option value="all">${escapeHtml(label)}</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(prettifyFolder(value))}</option>`)].join("");
  el.value = values.includes(prior) ? prior : "all";
  if (el.dataset.wired !== "1") {
    el.addEventListener("change", onChange);
    el.dataset.wired = "1";
  }
}

function samRelevanceBadge(value) {
  const label = value || "medium";
  const klass = label === "high" ? "chip-ok" : (label === "low" ? "chip-warn" : "");
  return `<span class="chip ${klass}">${escapeHtml(label)}</span>`;
}

function samConfidenceBadge(value) {
  const label = value || "medium";
  const klass = label === "high" ? "chip-ok" : (label === "low" ? "chip-warn" : "");
  return `<span class="chip ${klass}">${escapeHtml(label)} confidence</span>`;
}

function samConfidenceBucket(value) {
  const score = Number(value || 0);
  if (score >= 2.7) return "high";
  if (score >= 1.7) return "medium";
  return "low";
}

function samSourceBadge(value) {
  const label = value || "derived";
  const klass = label.includes("override") ? "chip-ok" : (label === "derived" ? "chip-warn" : "");
  return `<span class="chip ${klass}">${escapeHtml(titleCaseToken(label))}</span>`;
}

function samEntityOptions(data, current = "") {
  const types = getSamEntityTypes(data);
  return ["", ...types].map((value) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value ? titleCaseToken(value) : "Auto-detect")}</option>`).join("");
}

function samDetailList(items = [], emptyLabel = "No detail yet") {
  const values = (items || []).filter(Boolean);
  if (!values.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  return `<div class="sam-mini-list">${values.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join(" ")}</div>`;
}

function samBackendNotice(data) {
  const backend = data?.__backend || samBackendState;
  return `<div class="sam-write-notice ${backend.writable ? "sam-write-live" : "sam-write-static"}">
    <strong>${backend.writable ? "Live writeback enabled." : "Snapshot-only mode."}</strong>
    <span>${escapeHtml(backend.detail || "")}</span>
  </div>`;
}

function samSelectItem(scope, key, items, getId) {
  const bucket = samUiState[scope] || {};
  const saved = bucket[key];
  const fallback = items[0] || null;
  const selected = items.find((item) => getId(item) === saved) || fallback || null;
  if (bucket && key && selected) bucket[key] = getId(selected);
  return selected;
}

function samMetricCard(label, value, tone = "") {
  return `<article class="sam-mini-stat ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function samSelectionCard({ title, subtitle = "", meta = "", chips = "", active = false, alert = "", body = "" }) {
  return `
    <div class="sam-selection-card ${active ? "is-active" : ""}">
      <div class="sam-selection-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        ${chips ? `<div class="sam-chip-row">${chips}</div>` : ""}
      </div>
      ${body ? `<p class="muted">${escapeHtml(body)}</p>` : ""}
      ${meta ? `<div class="sam-selection-meta">${meta}</div>` : ""}
      ${alert ? `<div class="sam-inline-alert">${escapeHtml(alert)}</div>` : ""}
    </div>
  `;
}

function samRuleGroupOptions(current = "") {
  const groups = [
    ["mustNotifySenders", "Must notify senders"],
    ["mustNotifyDomains", "Must notify domains"],
    ["importantFinanceSenders", "Important finance senders"],
    ["interestingSalesSenders", "Interesting sales senders"],
    ["interestingContentSenders", "Interesting content senders"],
    ["itNewsPreferredSenders", "IT news preferred senders"],
    ["lowValueSenders", "Low value senders"],
    ["autoDeleteSenders", "Auto delete senders"],
  ];
  return groups.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function csvToList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function samFolderFieldOptions(data) {
  return getSamFolderOptions(data).map((folder) => `<option value="${escapeHtml(folder)}">${escapeHtml(prettifyFolder(folder))}</option>`).join("");
}

function samCategoryOptions(data, current) {
  return getSamTaxonomy(data).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === current ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
}

function samFolderOptions(data, current) {
  return getSamFolderOptions(data).map((item) => `<option value="${escapeHtml(item)}" ${item === current ? "selected" : ""}>${escapeHtml(prettifyFolder(item))}</option>`).join("");
}

async function detectSamBackend() {
  try {
    let res = await fetch("/api/sam/backend-status.php", { cache: "no-store" });
    if (res.status === 404) res = await fetch("/api/sam/backend-status", { cache: "no-store" });
    if (!res.ok) throw new Error("backend unavailable");
    const payload = await res.json();
    const serviceLabel = payload.serviceUrl || (payload.port ? `http://127.0.0.1:${payload.port}` : "same-origin API");
    samBackendState = {
      checked: true,
      writable: Boolean(payload.writable),
      mode: payload.mode || "local-writeback",
      detail: payload.writable
        ? `Connected to ${serviceLabel}. Edits write through to live Sam state and refresh the operator snapshot immediately.`
        : "Backend endpoint responded but writeback is disabled or one or more target files are not writable.",
      serviceUrl: payload.serviceUrl || "",
      builder: payload.builder || "",
      generatedAt: payload.generatedAt || null,
      mailboxCount: payload.mailboxCount || 0,
      fileStatus: payload.fileStatus || {},
      capabilities: payload.capabilities || {},
    };
  } catch {
    samBackendState = {
      checked: true,
      writable: false,
      mode: "snapshot-only",
      detail: "No same-origin Sam API responded. Start the local service on port 8091 or deploy the PHP `/api/sam/*` backend to enable editing.",
      serviceUrl: "",
      builder: "",
      generatedAt: null,
      mailboxCount: 0,
      fileStatus: {},
      capabilities: {},
    };
  }
  return samBackendState;
}

function samBackendStatusRows(data) {
  const backend = data?.__backend || samBackendState || {};
  const fileStatus = backend.fileStatus || {};
  const files = [
    ["Learning state", fileStatus.learning],
    ["Exceptions", fileStatus.exceptions],
    ["Sender CRM", fileStatus.crm],
    ["Snapshot", fileStatus.snapshot],
  ];
  return files.map(([label, info]) => `
    <div class="sam-runtime-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <div class="muted">${escapeHtml(info?.path || "Unavailable")}</div>
      </div>
      <div class="sam-chip-row">
        <span class="chip ${info?.exists ? "chip-ok" : "chip-warn"}">${info?.exists ? "present" : "missing"}</span>
        <span class="chip ${info?.writable ? "chip-ok" : "chip-warn"}">${info?.writable ? "writable" : "read-only"}</span>
        <span class="chip">${escapeHtml(formatBytes(info?.sizeBytes || 0))}</span>
      </div>
    </div>
  `).join("");
}

function samQuickActionCards() {
  const actions = [
    ["Review inbox decisions", "./sam-decisions.html", "Work low-confidence routing and explicit overrides."],
    ["Open Rules Engine", "./sam-rules.html", "Promote repeated exceptions into durable sender/domain policy."],
    ["Triage sender directory", "./sam-directory.html", "Tighten entity identity, relationship context, and operator notes."],
    ["Review finance ledger", "./sam-finance.html", "Correct suppliers, amounts, subscriptions, and budget signals."],
    ["Tune automation", "./sam-automation.html", "Inspect mailbox health, sweeps, and escalation posture."],
  ];
  return `<div class="sam-quick-grid">${actions.map(([title, href, detail]) => `
    <a class="project-card sam-action-card" href="${href}">
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(detail)}</p>
    </a>
  `).join("")}</div>`;
}

function rerenderSamPages(data = window.__samData || {}) {
  if ($("#samOverviewStats")) renderSamOverviewPage(data);
  if ($("#samDecisionStats")) renderSamDecisionPage(data);
  if ($("#samPolicyStats")) renderSamPoliciesPage(data);
  if ($("#samRuleStats")) renderSamRulesPage(data);
  if ($("#samDirectoryStats")) renderSamDirectoryPage(data);
  if ($("#samFinanceStats")) renderSamFinancePage(data);
  if ($("#samLearningStats")) renderSamLearningPage(data);
  if ($("#samAutomationStats")) renderSamAutomationPage(data);
  if ($("#samEmailSummaryStats")) renderSamEmailSummaryPage(data);
}

async function samWrite(op, data) {
  const backend = window.__samBackend || samBackendState;
  if (!backend.writable) {
    alert("This deployment is currently snapshot-only. Enable the same-origin Sam API to allow live writeback.");
    return null;
  }
  let res = await fetch("/api/sam/write.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, data }),
  });
  if (res.status === 404) {
    res = await fetch("/api/sam/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, data }),
    });
  }
  const payload = await res.json();
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || `Sam write failed (${res.status})`);
  }
  const prior = window.__samData || {};
  const next = payload.data || {};
  for (const key of ["financeLedger", "newsletterSources", "events", "shoppingHighlights", "digest"]) {
    if (prior[key] !== undefined && next[key] === undefined) next[key] = prior[key];
  }
  window.__samData = { ...prior, ...next, __backend: backend };
  rerenderSamPages(window.__samData);
  return payload.data;
}

function renderSamOverviewPage(data) {
  const statsNode = $("#samOverviewStats");
  if (!statsNode) return;

  const overview = data?.overview || {};
  const directory = Array.isArray(data?.directory) ? data.directory : [];
  const automation = data?.automation || {};
  const queue = Array.isArray(data?.learning?.queue) ? data.learning.queue : [];
  const lastSweep = (automation.mailboxes || []).map((item) => item.lastSweepAt).filter(Boolean).sort().reverse()[0];
  const backend = data?.__backend || samBackendState || {};
  const folderDistribution = overview.categoryDistribution || overview.folderDistribution || {};
  const topNeedsRule = directory
    .filter((sender) => (sender.totalEmails || 0) > 0)
    .map((sender) => ({
      ...sender,
      linkedRuleCount: (sender.linkedRules || []).length + (sender.exceptionRules || []).length,
      priorityScore: ((sender.jesseImportance === "high") ? 100 : (sender.jesseImportance === "medium" ? 50 : 20))
        + ((sender.avgConfidence || 0) < 2 ? 25 : 0)
        + Math.min(30, Number(sender.totalEmails || 0)),
    }))
    .filter((sender) => sender.linkedRuleCount === 0 || (sender.avgConfidence || 0) < 2)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 6);

  const cards = [
    ["Known senders", overview.senderCount || 0],
    ["Tracked emails", overview.totalEmails || 0],
    ["Needs review", overview.needsReviewCount || 0],
    ["Entity types", Object.keys(overview.entityTypeDistribution || {}).length || 0],
    ["Avg confidence", overview.averageConfidence || 0],
    ["Mailboxes", (automation.mailboxes || []).length],
    ["Live backend", backend.writable ? "online" : "snapshot"],
    ["Last sweep", lastSweep ? fmtDateTime(lastSweep) : "No runs"],
  ];

  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const freshness = $("#samDataFreshness");
  if (freshness) freshness.textContent = `Snapshot refreshed ${fmtDateTime(data?.generatedAt)}`;

  const summary = $("#samHealthSummary");
  if (summary) {
    const mailboxCards = (automation.mailboxes || []).map((mailbox) => `
      <article class="project-card sam-card-accent">
        <div class="card-head"><h3>${escapeHtml(mailbox.name)}</h3><span class="chip chip-ok">${escapeHtml(mailbox.status || "unknown")}</span></div>
        <p class="muted">Latest sweep at ${escapeHtml(fmtDateTime(mailbox.lastSweepAt))}</p>
        <div class="kv"><span>Recency</span><strong>${escapeHtml(relativeTime(mailbox.lastSweepAt))}</strong></div>
      </article>
    `);
    summary.innerHTML = [
      `<article class="project-card sam-card-accent">
        <h3>Writeback status</h3>
        ${samBackendNotice(data)}
      </article>`,
      `<article class="project-card sam-card-accent">
        <h3>Safety bias</h3>
        <p class="muted">${escapeHtml(data?.policies?.reasoningPolicy?.safetyBias || "Critical or safety-sensitive mail should bias toward Review / Action when uncertain.")}</p>
      </article>`,
      `<article class="project-card sam-card-accent">
        <h3>Reasoning posture</h3>
        <p class="muted">${escapeHtml(data?.policies?.reasoningPolicy?.transparencyPolicy || "Every row should explain whether it was inferred, overridden, or rule-based.")}</p>
        <div class="kv"><span>Decision sources</span><strong>${escapeHtml(Object.keys(overview.decisionSourceDistribution || {}).length || 0)}</strong></div>
      </article>`,
      `<article class="project-card sam-card-accent">
        <h3>Last escalation</h3>
        <p class="muted">${escapeHtml(fmtDateTime(automation.lastEscalationAt))}</p>
        <div class="kv"><span>Weeks processed</span><strong>${escapeHtml(automation.yahooHistory?.weeksProcessed || 0)}</strong></div>
      </article>`,
      ...mailboxCards,
    ].join("");
  }

  const runtimeWrap = $("#samRuntimeCockpit");
  if (runtimeWrap) {
    runtimeWrap.innerHTML = `
      <div class="sam-cockpit-grid">
        <article class="project-card sam-edit-card">
          <div class="card-head">
            <div>
              <h3>Backend runtime</h3>
              <p class="muted">Sam is running as a real web app with a connected same-origin backend for state changes and snapshot refresh.</p>
            </div>
            <span class="chip ${backend.writable ? "chip-ok" : "chip-warn"}">${escapeHtml(backend.mode || "snapshot-only")}</span>
          </div>
          <div class="sam-kv-grid">
            <div><span>Service</span><strong>${escapeHtml(backend.serviceUrl || window.location.origin)}</strong></div>
            <div><span>Snapshot builder</span><strong>${escapeHtml(backend.builder || "client snapshot")}</strong></div>
            <div><span>Generated</span><strong>${escapeHtml(fmtDateTime(backend.generatedAt || data?.generatedAt))}</strong></div>
            <div><span>Mailboxes</span><strong>${escapeHtml(backend.mailboxCount || (automation.mailboxes || []).length || 0)}</strong></div>
          </div>
          <div class="sam-runtime-list">${samBackendStatusRows(data)}</div>
        </article>
        <article class="project-card sam-edit-card">
          <div class="card-head">
            <div>
              <h3>Operator workflow</h3>
              <p class="muted">Use overview for triage, then move into the focused decision, rule, directory, and automation lanes.</p>
            </div>
          </div>
          ${samQuickActionCards()}
        </article>
        <article class="project-card sam-edit-card">
          <div class="card-head">
            <div>
              <h3>Routing health</h3>
              <p class="muted">Category coverage derived from sender CRM history and the current read model.</p>
            </div>
          </div>
          <div class="sam-pill-grid">${Object.entries(folderDistribution).map(([name, count]) => `<span class="chip">${escapeHtml(prettifyFolder(name))}: ${escapeHtml(count)}</span>`).join(" ") || `<span class="muted">No routing data</span>`}</div>
          <div class="sam-kv-grid">
            <div><span>Decision sources</span><strong>${escapeHtml(Object.keys(overview.decisionSourceDistribution || {}).length || 0)}</strong></div>
            <div><span>High-importance senders</span><strong>${escapeHtml((overview.importanceDistribution || {}).high || 0)}</strong></div>
            <div><span>Mailing lists</span><strong>${escapeHtml(overview.mailingLists || 0)}</strong></div>
            <div><span>Confirmed spam</span><strong>${escapeHtml(overview.confirmedSpam || 0)}</strong></div>
          </div>
        </article>
      </div>
    `;
  }

  const folderWrap = $("#samFolderDistribution");
  if (folderWrap) {
    const entries = Object.entries(folderDistribution);
    const max = Math.max(1, ...entries.map(([, count]) => Number(count) || 0));
    folderWrap.innerHTML = entries.length
      ? `<div class="sam-metric-list">${entries.map(([name, count]) => `
          <div class="sam-metric-row">
            <div class="sam-metric-label">${escapeHtml(prettifyFolder(name))}</div>
            <div class="sam-metric-bar"><span style="width:${Math.max(8, Math.round((Number(count) / max) * 100))}%"></span></div>
            <div class="sam-metric-value">${escapeHtml(count)}</div>
          </div>
        `).join("")}</div>`
      : samEmptyState({ title: "No routing history yet", detail: "Folder and category outcomes will appear here once sender CRM captures more mail." });
  }

  const attentionWrap = $("#samOverviewAttention");
  if (attentionWrap) {
    attentionWrap.innerHTML = queue.length
      ? `<div class="sam-editor-grid">${queue.slice(0, 4).map((item) => `
          <article class="project-card sam-edit-card">
            <div class="card-head">
              <div><h3>${escapeHtml(item.title || "Attention item")}</h3><p class="muted">${escapeHtml(item.type || "queue")}</p></div>
              <div class="sam-chip-row">${samRelevanceBadge(item.urgency || "medium")}${samConfidenceBadge(item.confidence || "medium")}</div>
            </div>
            <p class="muted">${escapeHtml(item.detail || "")}</p>
            <div class="kv"><span>Recommended action</span><strong>${escapeHtml(item.recommendedAction || "Review")}</strong></div>
          </article>
        `).join("")}</div>`
      : samEmptyState({ title: "No active attention queue", detail: "Low-confidence and repeated-override work will appear here once Sam has enough operator history." });
  }

  const topSenders = $("#samTopSenders");
  if (topSenders) {
    const rows = directory.slice().sort((a, b) => (b.totalEmails || 0) - (a.totalEmails || 0)).slice(0, 8).map((sender) => `
      <tr>
        <td>${escapeHtml(sender.displayName || sender.email)}</td>
        <td>${escapeHtml(sender.entityLabel || sender.companyName || "—")}</td>
        <td>${escapeHtml(sender.jesseImportance || "medium")}</td>
        <td>${escapeHtml(prettifyFolder((sender.foldersSeen || []).slice(-1)[0]))}</td>
        <td>${escapeHtml(fmtDateTime(sender.lastSeen))}</td>
      </tr>
    `).join("");
    topSenders.innerHTML = rows
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Sender</th><th>Entity</th><th>Jesse importance</th><th>Latest folder</th><th>Last seen</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : samEmptyState({ title: "No sender directory yet", detail: "Run Sam classification against mailboxes to populate sender activity." });
  }

  const watchlist = $("#samWatchlist");
  if (watchlist) {
    watchlist.innerHTML = topNeedsRule.length
      ? `<div class="sam-editor-grid">${topNeedsRule.map((sender) => `
          <article class="project-card sam-edit-card">
            <div class="card-head">
              <div>
                <h3>${escapeHtml(sender.displayName || sender.email)}</h3>
                <p class="muted">${escapeHtml(sender.entityLabel || sender.companyName || sender.email)}</p>
              </div>
              <div class="sam-chip-row">
                ${samRelevanceBadge(sender.jesseImportance || "medium")}
                ${samConfidenceBadge(samConfidenceBucket(sender.avgConfidence || 0))}
              </div>
            </div>
            <div class="sam-kv-grid">
              <div><span>Total emails</span><strong>${escapeHtml(sender.totalEmails || 0)}</strong></div>
              <div><span>Linked rules</span><strong>${escapeHtml(sender.linkedRuleCount || 0)}</strong></div>
              <div><span>Last seen</span><strong>${escapeHtml(fmtDateTime(sender.lastSeen))}</strong></div>
              <div><span>Last folder</span><strong>${escapeHtml(prettifyFolder(sender.lastCategory || (sender.foldersSeen || []).slice(-1)[0]))}</strong></div>
            </div>
            <p class="muted">${escapeHtml(sender.linkedRuleCount ? "Confidence is still soft for this active sender; tighten metadata or add a more explicit exception." : "No explicit rule coverage exists for this active sender yet.")}</p>
          </article>
        `).join("")}</div>`
      : samEmptyState({ title: "No urgent sender gaps", detail: "High-importance or low-confidence senders needing explicit treatment will appear here." });
  }
}

function renderSamDecisionPage(data) {
  const statsNode = $("#samDecisionStats");
  if (!statsNode) return;

  const decisions = Array.isArray(data?.recentDecisions) ? data.recentDecisions : [];
  const searchEl = $("#samDecisionSearch");
  const folderEl = $("#samDecisionFolderFilter");
  const mailboxEl = $("#samDecisionMailboxFilter");
  const sourceEl = $("#samDecisionSourceFilter");
  const query = (searchEl?.value || "").trim().toLowerCase();
  const folder = folderEl?.value || "all";
  const mailbox = mailboxEl?.value || "all";
  const source = sourceEl?.value || "all";
  const sources = Array.from(new Set(decisions.map((item) => item.decisionSource).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  wireSamSelect("#samDecisionFolderFilter", getSamFolderOptions(data), () => renderSamDecisionPage(window.__samData || data), "All folders");
  wireSamSelect("#samDecisionMailboxFilter", getSamMailboxOptions(data), () => renderSamDecisionPage(window.__samData || data), "All mailboxes");
  if (sourceEl) {
    const prior = sourceEl.value || "all";
    sourceEl.innerHTML = [`<option value="all">All sources</option>`, ...sources.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(titleCaseToken(value))}</option>`)].join("");
    sourceEl.value = sources.includes(prior) ? prior : "all";
    if (sourceEl.dataset.wired !== "1") {
      sourceEl.addEventListener("change", () => renderSamDecisionPage(window.__samData || data));
      sourceEl.dataset.wired = "1";
    }
  }
  if (searchEl && searchEl.dataset.wired !== "1") {
    searchEl.addEventListener("input", () => renderSamDecisionPage(window.__samData || data));
    searchEl.dataset.wired = "1";
  }

  const filtered = decisions.filter((decision) => {
    const text = `${decision.displayName || ""} ${decision.email || ""} ${decision.companyName || ""} ${decision.explanation || ""}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (folder !== "all" && decision.derivedFolder !== folder) return false;
    if (mailbox !== "all" && decision.mailbox !== mailbox) return false;
    if (source !== "all" && decision.decisionSource !== source) return false;
    return true;
  });

  const sorted = filtered.slice().sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
  const selected = samSelectItem("decisions", "selectedId", sorted, (item) => item.decisionId || item.email || "");
  const cards = [
    ["Visible queue", filtered.length],
    ["Rule candidates", filtered.filter((item) => item.needsReview || item.override).length],
    ["Overrides", decisions.filter((item) => item.override).length],
    ["Needs review", decisions.filter((item) => item.needsReview).length],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const banner = $("#samDecisionBanner");
  if (banner) {
    const reviewCount = filtered.filter((item) => item.needsReview).length;
    const overrideCount = filtered.filter((item) => item.override).length;
    const safetyCount = filtered.filter((item) => item.safetySensitive).length;
    banner.innerHTML = `
      ${samBackendNotice(data)}
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>Operator path</h3>
          <p class="muted">Review the decision, correct the current outcome if needed, then promote stable patterns into sender or domain rules.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Queue health</h3>
          <div class="sam-mini-stat-grid">
            ${samMetricCard("Needs review", reviewCount, reviewCount ? "warn" : "")}
            ${samMetricCard("Safety-sensitive", safetyCount, safetyCount ? "warn" : "")}
            ${samMetricCard("Overrides live", overrideCount, overrideCount ? "good" : "")}
          </div>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Data honesty</h3>
          <p class="muted">The queue is still sender-derived until Sam writes a durable per-email decision log, so promote only stable patterns into rules.</p>
        </article>
      </div>
    `;
  }

  const table = $("#samDecisionTable");
  const inspector = $("#samDecisionInspector");
  if (!table) return;
  if (!sorted.length) {
    table.innerHTML = samEmptyState({ title: "No matching decisions", detail: "Adjust the search or folder filter. Exact per-email audits will arrive once Sam writes a dedicated decision log." });
    if (inspector) inspector.innerHTML = samEmptyState({ title: "No decision selected", detail: "Select a queue item when the current filter returns results." });
    return;
  }

  table.innerHTML = `<div class="sam-selection-list">${sorted.map((decision) => `
    <button class="sam-selection-button" type="button" data-sam-decision-select="${escapeHtml(decision.decisionId || decision.email || "")}">
      ${samSelectionCard({
        title: decision.displayName || decision.email,
        subtitle: `${decision.email || "—"}${decision.companyName ? ` · ${decision.companyName}` : ""}`,
        active: (selected?.decisionId || selected?.email) === (decision.decisionId || decision.email),
        chips: `${samSourceBadge(decision.decisionSource || "derived")}${samConfidenceBadge(decision.confidenceLabel)}${decision.needsReview ? `<span class="chip chip-warn">Needs review</span>` : ""}`,
        body: decision.explanationFields?.summary || decision.explanation || "",
        meta: `
          <span>${escapeHtml(decision.classificationLabel || decision.classificationType || "—")}</span>
          <span>${escapeHtml(prettifyFolder(decision.derivedFolder))}</span>
          <span>${escapeHtml((decision.linkedRules || []).length)} linked rules</span>
          <span>${escapeHtml(relativeTime(decision.lastSeen))}</span>
        `,
        alert: decision.override ? "Override is currently active for this sender." : (decision.needsReview ? "This decision is a review candidate." : ""),
      })}
    </button>
  `).join("")}</div>`;

  table.querySelectorAll("[data-sam-decision-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      samUiState.decisions.selectedId = btn.dataset.samDecisionSelect || "";
      renderSamDecisionPage(window.__samData || data);
    });
  });

  if (inspector) {
    const senderDraft = samDecisionRuleDraft(selected, "sender");
    const domain = (selected?.email || "").split("@")[1] || "";
    const domainDraft = samDecisionRuleDraft(selected, "domain");
    inspector.innerHTML = selected ? `
      <article class="sam-inspector-shell">
        <div class="sam-inspector-header">
          <div>
            <h3>${escapeHtml(selected.displayName || selected.email)}</h3>
            <p class="muted">${escapeHtml(selected.email || "—")} · ${escapeHtml(selected.companyName || "No company")} · ${escapeHtml(selected.entityLabel || "Entity")}</p>
          </div>
          <div class="sam-chip-row">
            ${samRelevanceBadge(selected.jesseRelevance)}
            ${samRelevanceBadge(selected.urgencySafety)}
            ${samConfidenceBadge(selected.confidenceLabel)}
          </div>
        </div>

        <div class="sam-mini-stat-grid">
          ${samMetricCard("Current routing", selected.classificationLabel || selected.classificationType || "—")}
          ${samMetricCard("Folder", prettifyFolder(selected.derivedFolder))}
          ${samMetricCard("Decision source", titleCaseToken(selected.decisionSource || "derived"))}
          ${samMetricCard("Last seen", fmtDateTime(selected.lastSeen))}
        </div>

        <div class="sam-inspector-section">
          <h4>Current rule context</h4>
          <div class="sam-kv-grid">
            <div><span>Sender</span><strong>${escapeHtml(selected.email || "—")}</strong></div>
            <div><span>Domain</span><strong>${escapeHtml(domain || "—")}</strong></div>
            <div><span>Linked rules</span><strong>${escapeHtml((selected.linkedRules || []).length || 0)}</strong></div>
            <div><span>Promote bias</span><strong>${escapeHtml(selected.override ? "Existing override can be promoted" : "No override yet")}</strong></div>
          </div>
          ${(selected.linkedRules || []).length
            ? `<div class="sam-mini-list">${selected.linkedRules.map((rule) => `<span class="chip">${escapeHtml(`${samRuleScopeLabel(rule.kind)} · ${rule.match || "match"} · ${rule.effectSummary || "action"}`)}</span>`).join(" ")}</div>`
            : `<p class="muted">No explicit sender/domain rules are linked to this decision yet.</p>`}
        </div>

        <div class="sam-inspector-section">
          <h4>Why Sam chose this</h4>
          <p class="muted">${escapeHtml(selected.explanationFields?.summary || selected.explanation || "")}</p>
          <div class="sam-kv-grid">
            <div><span>Why it matters</span><strong>${escapeHtml(selected.explanationFields?.relevance || selected.relevanceNote || "—")}</strong></div>
            <div><span>Safety note</span><strong>${escapeHtml(selected.explanationFields?.safety || "—")}</strong></div>
            <div><span>Transparency</span><strong>${escapeHtml(selected.explanationFields?.transparency || "—")}</strong></div>
            <div><span>Purchase cue</span><strong>${escapeHtml(selected.purchaseHistoryCue || "—")}</strong></div>
          </div>
          ${samDetailList(selected.explanationFields?.evidence || [], "No explicit evidence notes yet")}
        </div>

        <form id="samDecisionInspectorForm" class="sam-form-stack"
          data-sender="${escapeHtml(selected.email || "")}"
          data-domain="${escapeHtml((selected.email || "").split("@")[1] || "")}"
          data-override-id="${escapeHtml(selected.override?.id || "")}">
          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Override routing</h4>
              <p class="muted">Use this only when the current decision is wrong. Stable patterns should move into the rules engine.</p>
            </div>
            <div class="sam-form-grid">
              <label><span>Category</span><select name="classificationType">${samCategoryOptions(data, selected.override?.classificationType || selected.classificationType)}</select></label>
              <label><span>Folder</span><select name="folder">${samFolderOptions(data, selected.override?.folder || selected.derivedFolder)}</select></label>
              <label><span>Jesse relevance</span><select name="jesseRelevance">${["high", "medium", "low"].map((value) => `<option value="${value}" ${(selected.override?.jesseRelevance || selected.jesseRelevance) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label><span>Urgency / safety</span><select name="urgencySafety">${["high", "medium", "low"].map((value) => `<option value="${value}" ${(selected.override?.urgencySafety || selected.urgencySafety) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label><span>Confidence</span><select name="confidence">${["high", "medium", "low"].map((value) => `<option value="${value}" ${(selected.override?.confidence || selected.confidenceLabel) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label><span>Importance note</span><input class="input" name="importanceNote" value="${escapeHtml(selected.override?.importanceNote || selected.importanceNote || "")}" /></label>
            </div>
          </div>

          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Operator reasoning</h4>
            </div>
            <label><span>Why it matters to Jesse</span><textarea class="input" rows="2" name="relevanceNote">${escapeHtml(selected.override?.relevanceNote || selected.relevanceNote || "")}</textarea></label>
            <label><span>Safety note</span><textarea class="input" rows="2" name="safetyNote">${escapeHtml(selected.override?.safetyNote || selected.explanationFields?.safety || "")}</textarea></label>
            <label><span>Decision explanation</span><textarea class="input" rows="2" name="explanation">${escapeHtml(selected.override?.explanation || "")}</textarea></label>
            <label><span>Evidence</span><textarea class="input" rows="2" name="evidence">${escapeHtml(selected.override?.evidence || selected.explanation || "")}</textarea></label>
            <label class="sam-checkbox"><input type="checkbox" name="promoteToSenderRule" ${(selected.override?.promoteToSenderRule || false) ? "checked" : ""} /> Promote this into a sender/domain rule when stable</label>
          </div>

          <div class="sam-action-row">
            <button class="btn btn-active" type="submit">${selected.override ? "Update override" : "Save override"}</button>
            ${selected.override ? `<button class="btn" type="button" data-sam-delete-override="${escapeHtml(selected.override.id)}">Delete override</button>` : ""}
          </div>
        </form>

        <div class="sam-inspector-section">
          <h4>Promote into rule</h4>
          <p class="muted">Create a prefilled rule draft directly from this decision instead of re-entering the same intent on the Rules page.</p>
          <div class="sam-kv-grid">
            <div><span>Suggested sender scope</span><strong>${escapeHtml(senderDraft.match || "—")}</strong></div>
            <div><span>Suggested domain scope</span><strong>${escapeHtml(domainDraft.match || "—")}</strong></div>
            <div><span>Suggested action</span><strong>${escapeHtml(`${selected.classificationLabel || selected.classificationType || "Advisory"} -> ${prettifyFolder(selected.derivedFolder)}`)}</strong></div>
            <div><span>Confidence</span><strong>${escapeHtml(selected.override?.confidence || selected.confidenceLabel || "medium")}</strong></div>
          </div>
          <div class="sam-action-row">
            <button class="btn btn-active" type="button" data-sam-draft-rule="sender">Draft sender rule</button>
            <button class="btn" type="button" data-sam-draft-rule="domain" ${domain ? "" : "disabled"}>Draft domain rule</button>
          </div>
        </div>
      </article>
    ` : samEmptyState({ title: "No decision selected", detail: "Select a decision from the queue." });

    $("#samDecisionInspectorForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      try {
        markSamFormClean(form);
        await samWrite("upsertDecisionOverride", {
          id: form.dataset.overrideId || undefined,
          sender: form.dataset.sender,
          domain: form.dataset.domain,
          classificationType: fd.get("classificationType"),
          folder: fd.get("folder"),
          jesseRelevance: fd.get("jesseRelevance"),
          urgencySafety: fd.get("urgencySafety"),
          confidence: fd.get("confidence"),
          confidenceScore: { high: 3, medium: 2, low: 1 }[fd.get("confidence")] || 2,
          importanceNote: fd.get("importanceNote"),
          relevanceNote: fd.get("relevanceNote"),
          safetyNote: fd.get("safetyNote"),
          explanation: fd.get("explanation"),
          evidence: fd.get("evidence"),
          promoteToSenderRule: fd.get("promoteToSenderRule") === "on",
        });
      } catch (err) {
        alert(err.message);
      }
    });

    inspector.querySelectorAll("[data-sam-delete-override]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await samWrite("deleteDecisionOverride", { id: btn.dataset.samDeleteOverride });
        } catch (err) {
          alert(err.message);
        }
      });
    });

    inspector.querySelectorAll("[data-sam-draft-rule]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const scope = btn.dataset.samDraftRule || "sender";
        const draft = samDecisionRuleDraft(selected, scope);
        samSaveRuleDraft(draft);
        window.location.href = "./sam-rules.html";
      });
    });
  }
}

function renderSamPoliciesPage(data) {
  const statsNode = $("#samPolicyStats");
  if (!statsNode) return;

  const policies = data?.policies || {};
  const priorityRules = Array.isArray(policies.priorityRules) ? policies.priorityRules : [];
  const topicProfiles = policies.topicProfiles || {};
  const notifyTerms = policies.notify?.telegramImmediateWhen || [];
  const exceptionRules = Array.isArray(policies.exceptionRules) ? policies.exceptionRules : [];
  const taxonomy = getSamTaxonomy(data);

  const cards = [
    ["Mode", policies.mode || "unknown"],
    ["Taxonomy classes", taxonomy.length],
    ["Priority rules", priorityRules.length],
    ["Notify triggers", notifyTerms.length],
    ["Overrides", exceptionRules.length],
    ["Learning queue", (data?.learning?.queue || []).length],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const summary = $("#samPolicySummary");
  if (summary) {
    summary.innerHTML = `
      <article class="project-card sam-card-accent">
        <h3>Routing mode</h3>
        <p class="muted">${escapeHtml(policies.mode || "Unknown")}</p>
        <p class="muted">Use this page to change broad routing posture. Use Rules and Directory for sender-specific treatment.</p>
        ${samBackendNotice(data)}
      </article>
      <article class="project-card sam-card-accent">
        <h3>Current taxonomy</h3>
        <div class="sam-pill-grid">${taxonomy.map((item) => `<span class="chip ${item.safetySensitive ? "chip-ok" : ""}">${escapeHtml(item.label)}</span>`).join(" ")}</div>
      </article>
      <article class="project-card sam-card-accent">
        <h3>Improve Sam results</h3>
        <div class="sam-mini-stat-grid">
          ${samMetricCard("Priority rules", priorityRules.length)}
          ${samMetricCard("Notify terms", notifyTerms.length)}
          ${samMetricCard("Exceptions", exceptionRules.length)}
          ${samMetricCard("Learning queue", (data?.learning?.queue || []).length, (data?.learning?.queue || []).length ? "warn" : "")}
        </div>
      </article>
    `;
  }

  const priorityWrap = $("#samPriorityRules");
  if (priorityWrap) {
    priorityWrap.innerHTML = `
      <form id="samPolicyForm" class="sam-form-stack">
        <div class="sam-form-section">
          <div class="sam-form-section-head">
            <h4>Routing posture</h4>
            <p class="muted">Set the default folder map and the short note that explains how the classifier should behave overall.</p>
          </div>
          <label><span>Policy notes</span><textarea id="samPolicyNotes" class="input" rows="3">${escapeHtml(policies.notes || "")}</textarea></label>
          <div class="sam-form-grid">${taxonomy.map((item) => `
            <label><span>${escapeHtml(item.label)} folder</span><input class="input" data-sam-folder-key="${escapeHtml(item.id)}" value="${escapeHtml((policies.folderMap || {})[item.id] || "")}" /></label>
          `).join("")}</div>
        </div>

        <div class="sam-form-section">
          <div class="sam-form-section-head">
            <h4>Alerting</h4>
            <p class="muted">Terms here control what gets elevated fast without having to add sender-level rules.</p>
          </div>
          <label><span>Immediate notify terms</span><textarea id="samNotifyTermsInput" class="input" rows="2">${escapeHtml((notifyTerms || []).join(", "))}</textarea></label>
        </div>

        <div class="sam-form-section">
          <div class="sam-form-section-head">
            <h4>Reasoning policy</h4>
            <p class="muted">These notes teach Sam how to explain and prioritize decisions. Keep them short and operator-readable.</p>
          </div>
          <label><span>Safety bias</span><textarea id="samSafetyBiasInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.safetyBias || "")}</textarea></label>
          <label><span>Jesse context guidance</span><textarea id="samJesseContextInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.jesseContext || "")}</textarea></label>
          <label><span>Retail / shopping reasoning</span><textarea id="samRetailPolicyInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.retailPolicy || "")}</textarea></label>
          <label><span>Confidence policy</span><textarea id="samConfidencePolicyInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.confidencePolicy || "")}</textarea></label>
          <label><span>Override policy</span><textarea id="samOverridePolicyInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.overridePolicy || "")}</textarea></label>
          <label><span>Learning policy</span><textarea id="samLearningPolicyInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.learningPolicy || "")}</textarea></label>
          <label><span>Transparency policy</span><textarea id="samTransparencyPolicyInput" class="input" rows="2">${escapeHtml(policies.reasoningPolicy?.transparencyPolicy || "")}</textarea></label>
        </div>

        <div class="sam-action-row"><button class="btn btn-active" type="submit">Save policy changes</button></div>
      </form>
    `;
    $("#samPolicyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nextFolderMap = {};
      priorityWrap.querySelectorAll("[data-sam-folder-key]").forEach((input) => {
        nextFolderMap[input.dataset.samFolderKey] = input.value.trim();
      });
      const nextTopicProfiles = {};
      document.querySelectorAll("[data-sam-topic-profile]").forEach((input) => {
        const key = (input.dataset.samTopicProfile || "").trim();
        if (!key) return;
        nextTopicProfiles[key] = csvToList(input.value || "");
      });
      const nextPriorityRules = [];
      document.querySelectorAll("[data-sam-priority-rule]").forEach((row) => {
        const name = row.querySelector('[data-rule-field="name"]')?.value?.trim() || "";
        const when = row.querySelector('[data-rule-field="when"]')?.value?.trim() || "";
        const target = row.querySelector('[data-rule-field="target"]')?.value?.trim() || "";
        const notify = row.querySelector('[data-rule-field="notify"]')?.value?.trim() || "";
        if (!name && !when && !target && !notify) return;
        nextPriorityRules.push({ name, when, target, ...(notify ? { notify } : {}) });
      });
      try {
        await samWrite("savePolicies", {
          mode: policies.mode || "single-folder-exclusive",
          notes: $("#samPolicyNotes")?.value || "",
          folderMap: nextFolderMap,
          notifyTerms: csvToList($("#samNotifyTermsInput")?.value || ""),
          topicProfiles: nextTopicProfiles,
          priorityRules: nextPriorityRules,
          reasoningPolicy: {
            safetyBias: $("#samSafetyBiasInput")?.value || "",
            jesseContext: $("#samJesseContextInput")?.value || "",
            retailPolicy: $("#samRetailPolicyInput")?.value || "",
            confidencePolicy: $("#samConfidencePolicyInput")?.value || "",
            overridePolicy: $("#samOverridePolicyInput")?.value || "",
            learningPolicy: $("#samLearningPolicyInput")?.value || "",
            transparencyPolicy: $("#samTransparencyPolicyInput")?.value || "",
          },
        });
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const topicsWrap = $("#samTopicProfiles");
  if (topicsWrap) {
    topicsWrap.innerHTML = `
      <div class="sam-form-stack">
        <div class="sam-form-section">
          <div class="sam-form-section-head">
            <h4>Priority rule editor</h4>
            <p class="muted">These are the broad routing rules Sam uses before falling back to weaker inference. Edit them here, then save from the main policy form.</p>
          </div>
          <div id="samPriorityRuleList" class="sam-stack-grid">
            ${(priorityRules.length ? priorityRules : [{ name: "", when: "", target: "", notify: "" }]).map((rule, index) => `
              <article class="project-card sam-edit-card sam-policy-rule-card" data-sam-priority-rule>
                <div class="sam-form-grid">
                  <label><span>Rule name</span><input class="input" data-rule-field="name" value="${escapeHtml(rule.name || "")}" placeholder="medium_relevant_topics" /></label>
                  <label><span>Target folder</span><select class="input" data-rule-field="target"><option value="">Choose folder</option>${samFolderOptions(data, rule.target || "")}</select></label>
                  <label class="sam-form-span-2"><span>Condition</span><input class="input" data-rule-field="when" value="${escapeHtml(rule.when || "")}" placeholder="medium + interesting topic match" /></label>
                  <label><span>Notify channel</span><input class="input" data-rule-field="notify" value="${escapeHtml(rule.notify || "")}" placeholder="telegram" /></label>
                </div>
                <div class="sam-action-row"><button class="btn" type="button" data-delete-priority-rule ${priorityRules.length <= 1 && index === 0 ? "disabled" : ""}>Remove rule</button></div>
              </article>
            `).join("")}
          </div>
          <div class="sam-action-row">
            <button class="btn" type="button" id="samAddPriorityRule">Add priority rule</button>
            <button class="btn" type="button" id="samPolicyRefreshBtn">Refresh snapshot</button>
          </div>
        </div>
      </div>
    `;

    const ruleList = $("#samPriorityRuleList");
    $("#samAddPriorityRule")?.addEventListener("click", () => {
      if (!ruleList) return;
      const card = document.createElement("article");
      card.className = "project-card sam-edit-card sam-policy-rule-card";
      card.dataset.samPriorityRule = "";
      card.innerHTML = `
        <div class="sam-form-grid">
          <label><span>Rule name</span><input class="input" data-rule-field="name" value="" placeholder="new_rule_name" /></label>
          <label><span>Target folder</span><select class="input" data-rule-field="target"><option value="">Choose folder</option>${samFolderFieldOptions(data)}</select></label>
          <label class="sam-form-span-2"><span>Condition</span><input class="input" data-rule-field="when" value="" placeholder="condition" /></label>
          <label><span>Notify channel</span><input class="input" data-rule-field="notify" value="" placeholder="telegram" /></label>
        </div>
        <div class="sam-action-row"><button class="btn" type="button" data-delete-priority-rule>Remove rule</button></div>
      `;
      ruleList.appendChild(card);
      card.querySelector("[data-delete-priority-rule]")?.addEventListener("click", () => card.remove());
    });
    topicsWrap.querySelectorAll("[data-delete-priority-rule]").forEach((button) => {
      button.addEventListener("click", () => button.closest("[data-sam-priority-rule]")?.remove());
    });
    $("#samPolicyRefreshBtn")?.addEventListener("click", async () => {
      try {
        await samWrite("refresh", {});
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const notifyWrap = $("#samNotifyPolicies");
  if (notifyWrap) {
    notifyWrap.innerHTML = `
      <div class="sam-stack-grid">
        <article class="project-card sam-edit-card">
          <h3>Reasoning expectations</h3>
          <div class="kv"><span>Jesse context</span><strong>${escapeHtml(policies.reasoningPolicy?.jesseContext || "—")}</strong></div>
          <div class="kv"><span>Retail policy</span><strong>${escapeHtml(policies.reasoningPolicy?.retailPolicy || "—")}</strong></div>
          <div class="kv"><span>Confidence policy</span><strong>${escapeHtml(policies.reasoningPolicy?.confidencePolicy || "—")}</strong></div>
          <div class="kv"><span>Override policy</span><strong>${escapeHtml(policies.reasoningPolicy?.overridePolicy || "—")}</strong></div>
          <div class="kv"><span>Learning policy</span><strong>${escapeHtml(policies.reasoningPolicy?.learningPolicy || "—")}</strong></div>
          <div class="kv"><span>Transparency</span><strong>${escapeHtml(policies.reasoningPolicy?.transparencyPolicy || "—")}</strong></div>
        </article>
        <article class="project-card sam-edit-card">
          <h3>Notify terms</h3>
          ${notifyTerms.length ? `<div class="sam-pill-grid">${notifyTerms.map((item) => `<span class="chip chip-ok">${escapeHtml(item)}</span>`).join(" ")}</div>` : `<p class="muted">No immediate notify terms configured.</p>`}
          <p class="muted">Edit immediate notify terms in the main policy form. This rail is for quick reference while tuning rules.</p>
        </article>
        <article class="project-card sam-edit-card">
          <h3>Article routing / topic profiles</h3>
          <p class="muted">These keyword sets drive newsletter and content relevance decisions like Medium, IT news, Humble, retail, and LinkedIn role filtering.</p>
          ${Object.keys(topicProfiles).length
            ? `<div class="sam-form-stack">${Object.entries(topicProfiles).map(([name, values]) => `
                <label>
                  <span>${escapeHtml(name)}</span>
                  <textarea class="input" rows="3" data-sam-topic-profile="${escapeHtml(name)}" placeholder="comma separated keywords">${escapeHtml(Array.isArray(values) ? values.join(", ") : "")}</textarea>
                </label>
              `).join("")}</div>`
            : `<p class="muted">No topic profiles yet.</p>`}
        </article>
        <article class="project-card sam-edit-card">
          <h3>Maintenance</h3>
          <div class="kv"><span>Backend mode</span><strong>${escapeHtml((data?.__backend || {}).mode || "snapshot-only")}</strong></div>
          <div class="kv"><span>Writeback</span><strong>${escapeHtml((data?.__backend || {}).writable ? "enabled" : "disabled")}</strong></div>
          <div class="kv"><span>Last snapshot</span><strong>${escapeHtml(fmtDateTime(data?.generatedAt))}</strong></div>
          <p class="muted">Use Refresh snapshot after backend/state changes if you want a clean reread without editing policy content.</p>
        </article>
      </div>
    `;
  }

  const exceptionWrap = $("#samExceptionRules");
  if (exceptionWrap) {
    exceptionWrap.innerHTML = exceptionRules.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Sender / Domain</th><th>Category</th><th>Folder</th><th>Explanation</th></tr></thead><tbody>${exceptionRules.map((rule) => `
          <tr>
            <td>${escapeHtml(rule.type || "rule")}</td>
            <td>${escapeHtml(rule.sender || rule.domain || "—")}</td>
            <td>${escapeHtml(rule.classificationType || "—")}</td>
            <td>${escapeHtml(prettifyFolder(rule.folder))}</td>
            <td class="muted">${escapeHtml(rule.explanation || rule.evidence || "")}</td>
          </tr>
        `).join("")}</tbody></table></div>`
      : samEmptyState({ title: "No learned exceptions yet", detail: "Inbox overrides will persist here and can optionally be promoted into future sender rules." });
  }
}

function renderSamRulesPage(data) {
  const statsNode = $("#samRuleStats");
  if (!statsNode) return;

  const rules = Array.isArray(data?.senderRules) ? data.senderRules : [];
  const patternRules = samPatternRules(data);
  const searchEl = $("#samSenderRuleSearch");
  const query = (searchEl?.value || "").trim().toLowerCase();
  const kind = $("#samSenderRuleKindFilter")?.value || "all";
  const source = $("#samSenderRuleSourceFilter")?.value || "all";
  const draft = samLoadRuleDraft();
  const sources = Array.from(new Set(rules.map((rule) => rule.source).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  wireSamSelect("#samSenderRuleKindFilter", ["sender", "domain"], () => renderSamRulesPage(window.__samData || data), "All scopes");
  const sourceSelect = $("#samSenderRuleSourceFilter");
  if (sourceSelect) {
    const prior = sourceSelect.value || "all";
    sourceSelect.innerHTML = [`<option value="all">All sources</option>`, ...sources.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(samRuleSourceLabel(value))}</option>`)].join("");
    sourceSelect.value = sources.includes(prior) ? prior : "all";
    if (sourceSelect.dataset.wired !== "1") {
      sourceSelect.addEventListener("change", () => renderSamRulesPage(window.__samData || data));
      sourceSelect.dataset.wired = "1";
    }
  }
  if (searchEl && searchEl.dataset.wired !== "1") {
    searchEl.addEventListener("input", () => renderSamRulesPage(window.__samData || data));
    searchEl.dataset.wired = "1";
  }

  const filtered = rules.filter((rule) => {
    const text = `${rule.group || ""} ${rule.match || ""} ${rule.description || ""} ${rule.classificationType || ""} ${rule.targetFolder || ""}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (kind !== "all" && rule.kind !== kind) return false;
    if (source !== "all" && rule.source !== source) return false;
    return true;
  });

  const cards = [
    ["Entity rules", rules.length],
    ["Domain rules", rules.filter((rule) => rule.kind === "domain").length],
    ["Sender rules", rules.filter((rule) => rule.kind === "sender").length],
    ["Pattern rules", patternRules.length],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const table = $("#samSenderRuleTable");
  const summary = $("#samRuleSummary");
  const inspector = $("#samRuleInspector");
  const patternTable = $("#samPatternRuleTable");
  const executionModel = $("#samRuleExecutionModel");
  const selected = samSelectItem("rules", "selectedId", filtered, (item) => item.id || `${item.group}:${item.match}`);
  if (summary) {
    const customCount = rules.filter((rule) => rule.source === "custom").length;
    const promotedCount = rules.filter((rule) => rule.group === "Promoted inbox overrides").length;
    summary.innerHTML = `
      ${samBackendNotice(data)}
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>Rule families</h3>
          <p class="muted">Use entity rules for exact senders or domains. Keep category, topic, and notify logic in pattern rules so Sam can distinguish specific exceptions from broader policy.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Engine snapshot</h3>
          <div class="sam-mini-stat-grid">
            ${samMetricCard("Legacy lists", rules.filter((rule) => rule.source === "legacy").length)}
            ${samMetricCard("Custom rules", customCount, customCount ? "good" : "")}
            ${samMetricCard("Promoted overrides", promotedCount, promotedCount ? "warn" : "")}
          </div>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Draft flow</h3>
          <p class="muted">${escapeHtml(draft?.originLabel ? `A rule draft from ${draft.originLabel} is ready in the builder.` : "Draft a rule from a decision or directory record to avoid re-entering scope and action by hand.")}</p>
        </article>
      </div>
    `;
  }
  if (!table) return;
  table.innerHTML = filtered.length ? `<div class="sam-selection-list">${filtered.map((rule) => {
    const structure = samBuildRuleStructure(rule, data);
    return `
    <button class="sam-selection-button" type="button" data-sam-rule-select="${escapeHtml(rule.id || `${rule.group}:${rule.match}`)}">
      ${samSelectionCard({
        title: structure.scopeValue || "Rule",
        subtitle: `${structure.scopeLabel} · ${rule.group || "Rule group"}`,
        active: (selected?.id || `${selected?.group}:${selected?.match}`) === (rule.id || `${rule.group}:${rule.match}`),
        chips: `<span class="chip">${escapeHtml(structure.precedence.label)} precedence</span>${samRelevanceBadge(rule.jesseRelevance)}<span class="chip">${escapeHtml(samRuleSourceLabel(rule.source))}</span>`,
        body: structure.conditions.join(" · "),
        meta: `
          <span>${escapeHtml(`Action: ${structure.actionSummary}`)}</span>
          <span>${escapeHtml(`Notes: ${rule.notes || rule.description || "none"}`)}</span>
        `,
      })}
    </button>
  `;
  }).join("")}</div>` : samEmptyState({ title: "No entity rules match", detail: "Adjust the filters or add a sender/domain rule. These edits persist to Sam state when the local write server is running." });

  table.querySelectorAll("[data-sam-rule-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      samUiState.rules.selectedId = btn.dataset.samRuleSelect || "";
      renderSamRulesPage(window.__samData || data);
    });
  });

  if (inspector) {
    const selectedKey = selected?.id || "";
    const isLegacy = Boolean(selected?.legacyKey);
    const selectedStructure = selected ? samBuildRuleStructure(selected, data) : null;
      const createDefaults = {
      mode: draft?.mode || "custom",
      legacyKey: "mustNotifySenders",
      kind: draft?.kind || draft?.scope || "sender",
      match: draft?.match || "",
      group: draft?.group || "Custom control-plane rules",
      classificationType: draft?.classificationType || "reviewAction",
      targetFolder: draft?.targetFolder || "",
      jesseRelevance: draft?.jesseRelevance || "medium",
        urgencySafety: draft?.urgencySafety || "medium",
        description: draft?.description || "",
        notes: draft?.notes || "",
      promoteOverride: draft?.group === "Promoted inbox overrides",
    };
    inspector.innerHTML = `
      <div class="sam-stack-grid">
        <article class="sam-inspector-shell">
          <div class="sam-inspector-header">
            <div>
              <h3>Create rule</h3>
              <p class="muted">Every rule should be explicit about scope, match conditions, precedence, and action.</p>
            </div>
          </div>
          ${draft?.originLabel ? `<div class="sam-inline-alert">Draft loaded from ${escapeHtml(draft.originLabel)}. Review the scope and action, then save it as a durable rule.</div>` : ""}
          <form id="samRuleCreateForm" class="sam-form-stack">
            <div class="sam-form-section">
              <div class="sam-form-section-head">
                <h4>Scope</h4>
                <p class="muted">Choose whether this rule applies to one sender, a domain, or a legacy list bucket.</p>
              </div>
              <div class="sam-form-grid">
                <label><span>Rule mode</span><select name="mode"><option value="custom" ${createDefaults.mode === "custom" ? "selected" : ""}>Custom rule</option><option value="legacy" ${createDefaults.mode === "legacy" ? "selected" : ""}>Legacy list entry</option></select></label>
                <label><span>Scope kind</span><select name="kind">${["sender", "domain"].map((value) => `<option value="${value}" ${createDefaults.kind === value ? "selected" : ""}>${samRuleScopeLabel(value)}</option>`).join("")}</select></label>
                <label><span>Match value</span><input class="input" name="match" value="${escapeHtml(createDefaults.match)}" placeholder="sender@example.com or example.com" /></label>
                <label><span>Legacy group</span><select name="legacyKey">${samRuleGroupOptions(createDefaults.legacyKey)}</select></label>
                <label><span>Rule group</span><input class="input" name="group" value="${escapeHtml(createDefaults.group)}" placeholder="Custom control-plane rules" /></label>
              </div>
            </div>
            <div class="sam-form-section">
              <div class="sam-form-section-head">
                <h4>Action and outcome</h4>
              </div>
              <div class="sam-form-grid">
                <label><span>Category</span><select name="classificationType">${samCategoryOptions(data, createDefaults.classificationType)}</select></label>
                <label><span>Target folder</span><select name="targetFolder"><option value="">No explicit folder</option>${samFolderOptions(data, createDefaults.targetFolder)}</select></label>
                <label><span>Jesse relevance</span><select name="jesseRelevance">${["high", "medium", "low"].map((value) => `<option value="${value}" ${createDefaults.jesseRelevance === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
                <label><span>Urgency / safety</span><select name="urgencySafety">${["high", "medium", "low"].map((value) => `<option value="${value}" ${createDefaults.urgencySafety === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              </div>
            </div>
            <div class="sam-form-section">
              <div class="sam-form-section-head">
                <h4>Notes for humans and AI</h4>
              </div>
              <label><span>Rule note</span><textarea class="input" rows="2" name="description" placeholder="What this rule should do and why">${escapeHtml(createDefaults.description)}</textarea></label>
              <label><span>Support note</span><textarea class="input" rows="2" name="notes" placeholder="Confidence, exceptions, or operator context">${escapeHtml(createDefaults.notes)}</textarea></label>
              <label class="sam-checkbox"><input type="checkbox" name="promoteOverride" ${createDefaults.promoteOverride ? "checked" : ""} /> Mark as a promoted-override style rule</label>
            </div>
            <div class="sam-action-row">
              <button class="btn btn-active" type="submit">Create rule</button>
              ${draft ? `<button class="btn" type="button" data-sam-clear-draft="1">Clear draft</button>` : ""}
            </div>
          </form>
        </article>

        ${selected ? `
          <article class="sam-inspector-shell">
            <div class="sam-inspector-header">
              <div>
                <h3>${escapeHtml(selectedStructure.scopeValue || "Selected rule")}</h3>
                <p class="muted">${escapeHtml(selected.group || "Rule group")} · ${escapeHtml(samRuleSourceLabel(selected.source || "rule"))}</p>
              </div>
              <div class="sam-chip-row">
                <span class="chip">${escapeHtml(selectedStructure.scopeLabel)}</span>
                <span class="chip">${escapeHtml(selectedStructure.precedence.label)} precedence</span>
                ${samRelevanceBadge(selected.jesseRelevance)}
              </div>
            </div>
            <div class="sam-kv-grid">
              <div><span>Scope</span><strong>${escapeHtml(selectedStructure.scopeLabel)}</strong></div>
              <div><span>Match</span><strong>${escapeHtml(selectedStructure.scopeValue || "—")}</strong></div>
              <div><span>Conditions</span><strong>${escapeHtml(selectedStructure.conditions.join(" · ") || "—")}</strong></div>
              <div><span>Precedence</span><strong>${escapeHtml(selectedStructure.precedence.summary)}</strong></div>
              <div><span>Action</span><strong>${escapeHtml(selectedStructure.actionSummary)}</strong></div>
              <div><span>Confidence / notes</span><strong>${escapeHtml(selected.notes || selected.description || "No extra notes")}</strong></div>
            </div>
            ${isLegacy
              ? `<form id="samRuleEditForm" class="sam-form-stack" data-rule-id="${escapeHtml(selectedKey)}" data-legacy-key="${escapeHtml(selected.legacyKey || "")}" data-rule-match="${escapeHtml(selected.match || "")}">
                  <div class="sam-inline-alert">Legacy list entries support match editing only. Use a custom rule when you need richer metadata or action structure.</div>
                  <label><span>Match value</span><input class="input" name="match" value="${escapeHtml(selected.match || "")}" /></label>
                  <div class="sam-action-row">
                    <button class="btn btn-active" type="submit">Save rule</button>
                    <button class="btn" type="button" data-sam-rule-delete="${escapeHtml(selected.id || "")}" data-legacy-key="${escapeHtml(selected.legacyKey || "")}" data-match="${escapeHtml(selected.match || "")}">Delete rule</button>
                  </div>
                </form>`
              : `<form id="samRuleEditForm" class="sam-form-stack" data-rule-id="${escapeHtml(selected.id || "")}">
                  <div class="sam-form-section">
                    <div class="sam-form-grid">
                      <label><span>Group</span><input class="input" name="group" value="${escapeHtml(selected.group || "")}" /></label>
                      <label><span>Scope kind</span><select name="kind">${["sender", "domain"].map((value) => `<option value="${value}" ${selected.kind === value ? "selected" : ""}>${samRuleScopeLabel(value)}</option>`).join("")}</select></label>
                      <label><span>Match</span><input class="input" name="match" value="${escapeHtml(selected.match || "")}" /></label>
                      <label><span>Category</span><select name="classificationType">${samCategoryOptions(data, selected.classificationType || "reviewAction")}</select></label>
                      <label><span>Target folder</span><select name="targetFolder"><option value="">No explicit folder</option>${samFolderOptions(data, selected.targetFolder || "")}</select></label>
                      <label><span>Jesse relevance</span><select name="jesseRelevance">${["high", "medium", "low"].map((value) => `<option value="${value}" ${selected.jesseRelevance === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
                      <label><span>Urgency / safety</span><select name="urgencySafety">${["high", "medium", "low"].map((value) => `<option value="${value}" ${selected.urgencySafety === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
                    </div>
                    <label><span>Rule note</span><textarea class="input" rows="2" name="description">${escapeHtml(selected.description || "")}</textarea></label>
                    <label><span>Support note</span><textarea class="input" rows="2" name="notes">${escapeHtml(selected.notes || "")}</textarea></label>
                  </div>
                  <label class="sam-checkbox"><input type="checkbox" name="promoteOverride" ${selected.promoteOverride ? "checked" : ""} /> Treat as promoted override</label>
                  <div class="sam-action-row">
                    <button class="btn btn-active" type="submit">Save rule</button>
                    <button class="btn" type="button" data-sam-rule-delete="${escapeHtml(selected.id || "")}" data-match="${escapeHtml(selected.match || "")}">Delete rule</button>
                  </div>
                </form>`
            }
          </article>
        ` : samEmptyState({ title: "No rule selected", detail: "Select a rule from the inventory to inspect or edit it." })}
      </div>
    `;

    $("#samRuleCreateForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      try {
        if (fd.get("mode") === "legacy") {
          await samWrite("upsertRule", {
            legacyKey: fd.get("legacyKey"),
            kind: fd.get("kind"),
            match: fd.get("match"),
          });
        } else {
          await samWrite("upsertRule", {
            group: fd.get("group") || "Custom control-plane rules",
            kind: fd.get("kind"),
            match: fd.get("match"),
            classificationType: fd.get("classificationType"),
            targetFolder: fd.get("targetFolder"),
            jesseRelevance: fd.get("jesseRelevance"),
            urgencySafety: fd.get("urgencySafety"),
            description: fd.get("description"),
            notes: fd.get("notes"),
            promoteOverride: fd.get("promoteOverride") === "on",
          });
        }
        samClearRuleDraft();
      } catch (err) {
        alert(err.message);
      }
    });

    inspector.querySelectorAll("[data-sam-clear-draft]").forEach((btn) => {
      btn.addEventListener("click", () => {
        samClearRuleDraft();
        renderSamRulesPage(window.__samData || data);
      });
    });

    $("#samRuleEditForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      try {
        if (form.dataset.legacyKey) {
          await samWrite("upsertRule", {
            id: form.dataset.ruleId || undefined,
            legacyKey: form.dataset.legacyKey || undefined,
            previousMatch: form.dataset.ruleMatch || "",
            match: fd.get("match"),
          });
        } else {
          await samWrite("upsertRule", {
            id: form.dataset.ruleId || undefined,
            group: fd.get("group"),
            kind: fd.get("kind"),
            match: fd.get("match"),
            classificationType: fd.get("classificationType"),
            targetFolder: fd.get("targetFolder"),
            jesseRelevance: fd.get("jesseRelevance"),
            urgencySafety: fd.get("urgencySafety"),
            description: fd.get("description"),
            notes: fd.get("notes"),
            promoteOverride: fd.get("promoteOverride") === "on",
          });
        }
      } catch (err) {
        alert(err.message);
      }
    });

    inspector.querySelectorAll("[data-sam-rule-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await samWrite("deleteRule", {
            id: btn.dataset.samRuleDelete,
            legacyKey: btn.dataset.legacyKey || undefined,
            match: btn.dataset.match || "",
          });
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  if (patternTable) {
    patternTable.innerHTML = patternRules.length
      ? `<div class="sam-selection-list">${patternRules.map((rule) => {
          const structure = samBuildRuleStructure(rule, data);
          return `<article class="sam-detail-stack">
            <div class="sam-selection-head">
              <div>
                <h3>${escapeHtml(rule.description || "Pattern rule")}</h3>
                <p class="muted">${escapeHtml(rule.group || "Pattern rule")}</p>
              </div>
              <div class="sam-chip-row">
                <span class="chip">${escapeHtml(structure.precedence.label)} precedence</span>
                <span class="chip">${escapeHtml(samRuleSourceLabel(rule.source))}</span>
              </div>
            </div>
            <div class="sam-kv-grid">
              <div><span>Condition</span><strong>${escapeHtml(structure.conditions.join(" · ") || "—")}</strong></div>
              <div><span>Action</span><strong>${escapeHtml(structure.actionSummary)}</strong></div>
              <div><span>Notify</span><strong>${escapeHtml(rule.notify || "none")}</strong></div>
              <div><span>Edit path</span><strong>Policies page</strong></div>
            </div>
          </article>`;
        }).join("")}</div>`
      : samEmptyState({ title: "No pattern rules configured", detail: "Priority/category rules and notify triggers will appear here as a separate rule family." });
  }

  if (executionModel) {
    const order = [
      ["1. Operator override", "Wins immediately for the specific decision or sender/domain override."],
      ["2. Sender rule", "Exact sender match beats broader domain and category logic."],
      ["3. Domain rule", "Applies to all mail from a domain unless a sender rule overrides it."],
      ["4. Pattern/category rule", "Broad content or notify policies apply when no entity-specific rule wins."],
      ["5. Derived inference", "Fallback when Sam only has history and no explicit rule."],
    ];
    executionModel.innerHTML = `<div class="sam-stack-grid">${order.map(([title, detail]) => `<article class="sam-detail-stack"><strong>${escapeHtml(title)}</strong><p class="muted">${escapeHtml(detail)}</p></article>`).join("")}</div>`;
  }
}

function renderSamDirectoryPage(data) {
  const statsNode = $("#samDirectoryStats");
  if (!statsNode) return;

  const directory = Array.isArray(data?.directory) ? data.directory : [];
  const searchEl = $("#samDirectorySearch");
  const entityEl = $("#samDirectoryTypeFilter");
  const importanceEl = $("#samDirectoryImportanceFilter");
  const query = (searchEl?.value || "").trim().toLowerCase();
  const entityType = entityEl?.value || "all";
  const importance = importanceEl?.value || "all";
  if (entityEl) {
    const types = getSamEntityTypes(data);
    const prior = entityEl.value || "all";
    entityEl.innerHTML = [`<option value="all">All entity types</option>`, ...types.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(titleCaseToken(value))}</option>`)].join("");
    entityEl.value = types.includes(prior) ? prior : "all";
    if (entityEl.dataset.wired !== "1") {
      entityEl.addEventListener("change", () => renderSamDirectoryPage(window.__samData || data));
      entityEl.dataset.wired = "1";
    }
  }
  if (importanceEl) {
    const values = ["high", "medium", "low"];
    const prior = importanceEl.value || "all";
    importanceEl.innerHTML = [`<option value="all">All importance</option>`, ...values.map((value) => `<option value="${value}">${escapeHtml(titleCaseToken(value))}</option>`)].join("");
    importanceEl.value = values.includes(prior) ? prior : "all";
    if (importanceEl.dataset.wired !== "1") {
      importanceEl.addEventListener("change", () => renderSamDirectoryPage(window.__samData || data));
      importanceEl.dataset.wired = "1";
    }
  }
  if (searchEl && searchEl.dataset.wired !== "1") {
    searchEl.addEventListener("input", () => renderSamDirectoryPage(window.__samData || data));
    searchEl.dataset.wired = "1";
  }

  const filtered = directory.filter((sender) => {
    const text = `${sender.displayName || ""} ${sender.email || ""} ${sender.companyName || ""} ${(sender.domains || []).join(" ")} ${(sender.tags || []).join(" ")} ${sender.notes || ""} ${sender.roleOrPurpose || ""}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (entityType !== "all" && sender.entityType !== entityType) return false;
    if (importance !== "all" && sender.jesseImportance !== importance) return false;
    return true;
  });

  const cards = [
    ["Visible records", filtered.length],
    ["Known entities", directory.length],
    ["High importance", directory.filter((sender) => sender.jesseImportance === "high").length],
    ["Needs review", directory.filter((sender) => sender.operatorReviewStatus === "needs-review").length],
    ["Entity types", getSamEntityTypes(data).length],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const table = $("#samDirectoryTable");
  const summary = $("#samDirectorySummary");
  const inspector = $("#samDirectoryInspector");
  const sorted = filtered.slice().sort((a, b) => {
    const importanceScore = { high: 0, medium: 1, low: 2 };
    const importanceCmp = (importanceScore[a.jesseImportance] ?? 9) - (importanceScore[b.jesseImportance] ?? 9);
    if (importanceCmp !== 0) return importanceCmp;
    return String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""));
  });
  const visibleDirectory = sorted.slice(0, 100);
  const selected = samSelectItem("directory", "selectedEmail", visibleDirectory, (item) => item.email || "");
  if (summary) {
    const needsReview = filtered.filter((sender) => sender.operatorReviewStatus === "needs-review" || (sender.avgConfidence || 0) < 2).length;
    const thinProfiles = filtered.filter((sender) => !(sender.companyName || sender.roleOrPurpose || sender.entityProfile?.common?.relationshipToJesse)).length;
    summary.innerHTML = `
      ${samBackendNotice(data)}
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>What belongs here</h3>
          <p class="muted">Directory is the entity reference layer: who this sender is, how they relate to Jesse, and what supporting notes Sam should know.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Profile backlog</h3>
          <div class="sam-mini-stat-grid">
            ${samMetricCard("Needs review", needsReview, needsReview ? "warn" : "")}
            ${samMetricCard("Thin profiles", thinProfiles, thinProfiles ? "warn" : "")}
            ${samMetricCard("High importance", filtered.filter((sender) => sender.jesseImportance === "high").length)}
          </div>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Rules stay separate</h3>
          <p class="muted">Use the Rules Engine for sender/domain actions. The directory should describe the entity, not carry the full routing policy.</p>
        </article>
      </div>
    `;
  }
  if (table) {
    table.innerHTML = sorted.length
      ? `<div class="sam-selection-list">
          ${sorted.length > visibleDirectory.length ? `<div class="sam-inline-alert">Showing the first ${visibleDirectory.length} matching directory records. Search or filter to narrow the profile list.</div>` : ""}
          ${visibleDirectory.map((sender) => `
          <button class="sam-selection-button" type="button" data-sam-directory-select="${escapeHtml(sender.email || "")}">
            ${samSelectionCard({
              title: sender.displayName || sender.email,
              subtitle: `${sender.companyName || sender.email || "—"} · ${((sender.domains || []).join(", ") || "—")}`,
              active: selected?.email === sender.email,
              chips: `${samRelevanceBadge(sender.jesseImportance)}<span class="chip">${escapeHtml(sender.entityLabel || "Entity")}</span><span class="chip">${escapeHtml(sender.relationshipStrength || "light")}</span>`,
              body: sender.roleOrPurpose || sender.relevanceNote || sender.notes || "No operator notes yet.",
              meta: `
                <span>${escapeHtml(sender.email || "—")}</span>
                <span>${escapeHtml(sender.totalEmails || 0)} tracked</span>
                <span>${escapeHtml(relativeTime(sender.lastSeen))}</span>
              `,
              alert: (sender.operatorReviewStatus === "needs-review" || (sender.avgConfidence || 0) < 2) ? "This sender should be reviewed." : "",
            })}
          </button>
        `).join("")}</div>`
      : samEmptyState({ title: "No directory records match", detail: "Adjust the search or filters to inspect more of the sender directory." });
  }

  table?.querySelectorAll("[data-sam-directory-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      samUiState.directory.selectedEmail = btn.dataset.samDirectorySelect || "";
      renderSamDirectoryPage(window.__samData || data);
    });
  });

  if (inspector) {
    const common = selected?.entityProfile?.common || {};
    const latestFolder = (selected?.foldersSeen || []).slice(-1)[0] || "";
    inspector.innerHTML = selected ? `
      <article class="sam-inspector-shell">
        <div class="sam-inspector-header">
          <div>
            <h3>${escapeHtml(selected.displayName || selected.email)}</h3>
            <p class="muted">${escapeHtml(selected.email || "—")} · ${escapeHtml(selected.companyName || "No company")} · ${escapeHtml(selected.entityLabel || "Entity")}</p>
          </div>
          <div class="sam-chip-row">
            ${samRelevanceBadge(selected.jesseImportance)}
            <span class="chip">${escapeHtml(selected.relationshipStrength || "light")}</span>
            ${selected.confirmedSpam ? `<span class="chip chip-bad">Confirmed spam</span>` : ""}
          </div>
        </div>

        <div class="sam-mini-stat-grid">
          ${samMetricCard("Emails tracked", selected.totalEmails || 0)}
          ${samMetricCard("Confidence", selected.avgConfidence || 0, (selected.avgConfidence || 0) < 2 ? "warn" : "")}
          ${samMetricCard("Last seen", fmtDateTime(selected.lastSeen))}
          ${samMetricCard("Entity type", selected.entityLabel || "Entity")}
        </div>

        <div class="sam-inspector-section">
          <h4>Profile reference</h4>
          <div class="sam-kv-grid">
            <div><span>Email</span><strong>${escapeHtml(selected.email || "—")}</strong></div>
            <div><span>Company / entity</span><strong>${escapeHtml(selected.companyName || common.operatingName || "—")}</strong></div>
            <div><span>Role / purpose</span><strong>${escapeHtml(selected.roleOrPurpose || "—")}</strong></div>
            <div><span>Relationship to Jesse</span><strong>${escapeHtml(common.relationshipToJesse || "—")}</strong></div>
            <div><span>Review status</span><strong>${escapeHtml(selected.operatorReviewStatus || "—")}</strong></div>
            <div><span>Account reference</span><strong>${escapeHtml(common.accountReference || "—")}</strong></div>
            <div><span>Website</span><strong>${escapeHtml(common.websiteUrl || "—")}</strong></div>
            <div><span>Purchase cue</span><strong>${escapeHtml(selected.purchaseHistoryCue || "—")}</strong></div>
          </div>
          ${samDetailList(selected.evidence || [], "No evidence notes yet")}
        </div>

        <div class="sam-inspector-section">
          <h4>Routing reference</h4>
          <div class="sam-kv-grid">
            <div><span>Last category</span><strong>${escapeHtml(selected.lastCategory || "—")}</strong></div>
            <div><span>Last folder</span><strong>${escapeHtml(prettifyFolder(latestFolder))}</strong></div>
            <div><span>Linked rules</span><strong>${escapeHtml((selected.linkedRules || []).length || 0)}</strong></div>
            <div><span>Operator preference</span><strong>${escapeHtml(selected.operatorCategoryPreference || selected.operatorFolderPreference || "none")}</strong></div>
          </div>
          ${(selected.linkedRules || []).length
            ? `<div class="sam-mini-list">${selected.linkedRules.map((rule) => `<span class="chip">${escapeHtml(`${samRuleScopeLabel(rule.kind)} · ${rule.match || "match"}`)}</span>`).join(" ")}</div>`
            : `<p class="muted">No explicit entity rules are linked to this directory record yet.</p>`}
          <div class="sam-action-row">
            <button class="btn" type="button" data-sam-directory-draft-rule="${escapeHtml(selected.email || "")}">Draft sender rule</button>
            <a class="btn" href="./sam-rules.html">Open Rules Engine</a>
          </div>
        </div>

        <form id="samDirectoryInspectorForm" class="sam-form-stack" data-email="${escapeHtml(selected.email || "")}">
          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Identity</h4>
            </div>
            <div class="sam-form-grid">
              <label><span>Entity type</span><select name="entityType">${samEntityOptions(data, selected.entityType || "")}</select></label>
              <label><span>Display name</span><input class="input" name="displayName" value="${escapeHtml(selected.displayName || "")}" /></label>
              <label><span>Company</span><input class="input" name="companyName" value="${escapeHtml(selected.companyName || "")}" /></label>
              <label><span>Role / purpose</span><input class="input" name="roleOrPurpose" value="${escapeHtml(selected.roleOrPurpose || "")}" /></label>
              <label><span>Legal name</span><input class="input" name="entityLegalName" value="${escapeHtml(common.legalName || "")}" /></label>
              <label><span>Operating name</span><input class="input" name="entityOperatingName" value="${escapeHtml(common.operatingName || "")}" /></label>
              <label><span>Website</span><input class="input" name="websiteUrl" value="${escapeHtml(common.websiteUrl || "")}" /></label>
            </div>
          </div>

          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Relationship and importance</h4>
            </div>
            <div class="sam-form-grid">
              <label><span>Jesse importance</span><select name="jesseImportance">${["high", "medium", "low"].map((value) => `<option value="${value}" ${selected.jesseImportance === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label><span>Review status</span><select name="operatorReviewStatus">${["", "ready", "needs-review", "verified", "hold"].map((value) => `<option value="${value}" ${String(selected.operatorReviewStatus || "") === value ? "selected" : ""}>${value || "None"}</option>`).join("")}</select></label>
              <label><span>Tags</span><input class="input" name="tags" value="${escapeHtml((selected.tags || []).join(", "))}" /></label>
              <label><span>Importance reason</span><input class="input" name="importanceReason" value="${escapeHtml(selected.importanceReason || "")}" /></label>
              <label><span>Relationship to Jesse</span><input class="input" name="relationshipToJesse" value="${escapeHtml(common.relationshipToJesse || "")}" /></label>
              <label><span>Relationship owner</span><input class="input" name="relationshipOwner" value="${escapeHtml(common.contactOwner || "")}" /></label>
              <label><span>Account reference</span><input class="input" name="accountReference" value="${escapeHtml(common.accountReference || "")}" /></label>
              <label><span>Service area</span><input class="input" name="serviceArea" value="${escapeHtml(common.serviceArea || "")}" /></label>
              <label><span>Department</span><input class="input" name="department" value="${escapeHtml(common.department || "")}" /></label>
            </div>
          </div>

          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Reference notes</h4>
            </div>
            <div class="sam-form-grid">
              <label><span>Subscription status</span><input class="input" name="subscriptionStatus" value="${escapeHtml(common.subscriptionStatus || "")}" /></label>
              <label><span>Billing cadence</span><input class="input" name="billingCadence" value="${escapeHtml(common.billingCadence || "")}" /></label>
              <label><span>Product focus</span><input class="input" name="productFocus" value="${escapeHtml(common.productFocus || "")}" /></label>
              <label><span>Institution type</span><input class="input" name="institutionType" value="${escapeHtml(common.institutionType || "")}" /></label>
              <label><span>Purchase history cues</span><input class="input" name="purchaseHistoryCues" value="${escapeHtml((common.purchaseHistoryCues || []).join(", "))}" /></label>
              <label><span>Newsletter topics</span><input class="input" name="newsletterTopics" value="${escapeHtml((common.newsletterTopics || []).join(", "))}" /></label>
            </div>
            <label><span>Jesse relevance notes</span><textarea class="input" rows="2" name="jesseRelevanceNotes">${escapeHtml(common.jesseRelevanceNotes || "")}</textarea></label>
            <label><span>Evidence notes</span><textarea class="input" rows="2" name="evidenceNotes">${escapeHtml((common.evidenceNotes || []).join(", "))}</textarea></label>
            <label><span>Notes</span><textarea class="input" rows="3" name="notes">${escapeHtml(selected.notes || "")}</textarea></label>
          </div>

          <div class="sam-action-row"><button class="btn btn-active" type="submit">Save sender</button></div>
        </form>
      </article>
    ` : samEmptyState({ title: "No sender selected", detail: "Select a sender record to inspect and edit it." });

    $("#samDirectoryInspectorForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      try {
        await samWrite("upsertDirectory", {
          email: form.dataset.email,
          entityType: fd.get("entityType"),
          displayName: fd.get("displayName"),
          companyName: fd.get("companyName"),
          roleOrPurpose: fd.get("roleOrPurpose"),
          jesseImportance: fd.get("jesseImportance"),
          operatorCategoryPreference: selected.operatorCategoryPreference || "",
          operatorFolderPreference: selected.operatorFolderPreference || "",
          operatorReviewStatus: fd.get("operatorReviewStatus"),
          relationshipToJesse: fd.get("relationshipToJesse"),
          serviceArea: fd.get("serviceArea"),
          department: fd.get("department"),
          accountReference: fd.get("accountReference"),
          subscriptionStatus: fd.get("subscriptionStatus"),
          billingCadence: fd.get("billingCadence"),
          productFocus: fd.get("productFocus"),
          institutionType: fd.get("institutionType"),
          websiteUrl: fd.get("websiteUrl"),
          relationshipOwner: fd.get("relationshipOwner"),
          entityLegalName: fd.get("entityLegalName"),
          entityOperatingName: fd.get("entityOperatingName"),
          tags: csvToList(fd.get("tags")),
          importanceReason: fd.get("importanceReason"),
          jesseRelevanceNotes: fd.get("jesseRelevanceNotes"),
          purchaseHistoryCues: csvToList(fd.get("purchaseHistoryCues")),
          newsletterTopics: csvToList(fd.get("newsletterTopics")),
          evidenceNotes: csvToList(fd.get("evidenceNotes")),
          notes: fd.get("notes"),
        });
      } catch (err) {
        alert(err.message);
      }
    });

    inspector.querySelectorAll("[data-sam-directory-draft-rule]").forEach((btn) => {
      btn.addEventListener("click", () => {
        samSaveRuleDraft(samDirectoryRuleDraft(selected, data));
        window.location.href = "./sam-rules.html";
      });
    });
  }

  const highlights = $("#samDirectoryHighlights");
  if (highlights) {
    const mostActive = directory.slice().sort((a, b) => (b.totalEmails || 0) - (a.totalEmails || 0))[0];
    const newest = directory.slice().sort((a, b) => new Date(b.firstSeen || 0) - new Date(a.firstSeen || 0))[0];
    const highestImportance = directory.find((item) => item.jesseImportance === "high");
    const reviewCandidate = directory.find((item) => item.operatorReviewStatus === "needs-review");
    const cardsHtml = [
      mostActive ? { title: "Most active entity", value: mostActive.displayName || mostActive.email, detail: `${mostActive.totalEmails || 0} emails tracked` } : null,
      newest ? { title: "Newest entity", value: newest.displayName || newest.email, detail: `First seen ${fmtDateTime(newest.firstSeen)}` } : null,
      highestImportance ? { title: "Pinned high importance", value: highestImportance.displayName || highestImportance.email, detail: highestImportance.importanceReason || "Marked important for Jesse." } : null,
      reviewCandidate ? { title: "Needs profile review", value: reviewCandidate.displayName || reviewCandidate.email, detail: reviewCandidate.relevanceNote || "Operator flagged this record for review." } : null,
    ].filter(Boolean);
    highlights.innerHTML = cardsHtml.length
      ? cardsHtml.map((card) => `<article class="project-card sam-card-accent"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.value)}</p><p class="muted">${escapeHtml(card.detail)}</p></article>`).join("")
      : samEmptyState({ title: "No highlights yet", detail: "Sender-level insights will appear here as directory coverage grows." });
  }
}

function renderSamLearningPage(data) {
  const statsNode = $("#samLearningStats");
  if (!statsNode) return;

  const articles = Array.isArray(data?.newsletterSources) ? data.newsletterSources : [];
  const shopping = Array.isArray(data?.shoppingHighlights) ? data.shoppingHighlights : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const notebookQueued = articles.filter((item) => /queued|pending/i.test(item.notebooklm_status || item.notebooklmStatus || "")).length;
  const highInterestShopping = shopping.filter((item) => Number(item.interest_score || item.interestScore || 0) >= 0.7).length;
  const highInterestEvents = events.filter((item) => Number(item.interest_score || item.interestScore || 0) >= 0.7).length;

  const cards = [
    ["Articles", articles.length],
    ["Notebook queued", notebookQueued],
    ["Shopping picks", shopping.length],
    ["High-interest deals", highInterestShopping],
    ["Events", events.length],
    ["High-interest events", highInterestEvents],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const suggestionWrap = $("#samLearningSuggestions");
  if (suggestionWrap) {
    const visibleArticles = articles.slice(0, 80);
    suggestionWrap.innerHTML = articles.length
      ? `<div class="sam-selection-list">
          ${articles.length > visibleArticles.length ? `<div class="sam-inline-alert">Showing the first ${visibleArticles.length} article sources. NotebookLM status should be reviewed before downstream writing workflows consume them.</div>` : ""}
          ${visibleArticles.map((item) => `
          <article class="sam-selection-card">
            <div class="sam-selection-head">
              <div>
                <h3>${escapeHtml(item.article_title || item.articleTitle || "Article")}</h3>
                <p class="muted">${escapeHtml(item.source_newsletter || item.sourceNewsletter || item.domain || "Newsletter source")}</p>
              </div>
              <div class="sam-chip-row">
                <span class="chip">${escapeHtml(item.topic_area || item.topicArea || "topic")}</span>
                <span class="chip ${/added|complete/i.test(item.notebooklm_status || "") ? "chip-ok" : "chip-warn"}">${escapeHtml(item.notebooklm_status || item.notebooklmStatus || "notebook pending")}</span>
              </div>
            </div>
            <p class="muted">${escapeHtml(item.reason || "")}</p>
            <div class="sam-selection-meta"><span>${escapeHtml(item.url || "")}</span><span>${escapeHtml(item.notebooklm_target || item.notebooklmTarget || "")}</span></div>
            <form class="sam-inline-review-form" data-sam-review-kind="content">
              <input type="hidden" name="sourceKey" value="${escapeHtml(samRegisterItemKey(item, "article"))}" />
              <input type="hidden" name="sourceMessageId" value="${escapeHtml(item.source_message_id || item.sourceMessageId || "")}" />
              <input type="hidden" name="title" value="${escapeHtml(item.article_title || item.articleTitle || "")}" />
              <input type="hidden" name="url" value="${escapeHtml(item.url || "")}" />
              <label><span>Status</span><select name="reviewStatus">${samInlineStatusOptions()}</select></label>
              <label><span>Interest</span><input name="interestScore" value="${escapeHtml(item.relevance_score || item.relevanceScore || "")}" /></label>
              <label><span>Topic</span><input name="topicArea" value="${escapeHtml(item.topic_area || item.topicArea || "")}" /></label>
              <label><span>Notebook</span><input name="notebookTarget" value="${escapeHtml(item.notebooklm_target || item.notebooklmTarget || "")}" /></label>
              <label class="sam-field-wide"><span>Notes</span><input name="operatorNotes" placeholder="What Sam should learn from this" /></label>
              <label class="sam-checkbox"><input type="checkbox" name="jrCandidate" /> <span>JR writing candidate</span></label>
              <label class="sam-checkbox"><input type="checkbox" name="promotePolicyHint" checked /> <span>Learn from this</span></label>
              <button class="btn" type="submit">Save</button>
              <span class="muted" data-sam-review-alert></span>
            </form>
          </article>
        `).join("")}</div>`
      : samEmptyState({ title: "No suggestions", detail: "Suggestions will appear once Sam has more learning history to review." });
  }

  const topicsWrap = $("#samLearningTopics");
  if (topicsWrap) {
    const visibleShopping = shopping.slice(0, 60);
    topicsWrap.innerHTML = shopping.length
      ? `<div class="sam-selection-list">${visibleShopping.map((item) => `
          <article class="sam-selection-card">
            <div class="sam-selection-head">
              <div>
                <h3>${escapeHtml(item.item_name || item.itemName || "Shopping item")}</h3>
                <p class="muted">${escapeHtml(item.retailer || item.sender_email || "Retail source")}</p>
              </div>
              <div class="sam-chip-row">
                <span class="chip">${escapeHtml([item.currency, item.price].filter(Boolean).join(" ") || "price unknown")}</span>
                <span class="chip">${escapeHtml(item.discount || "no discount captured")}</span>
              </div>
            </div>
            <p class="muted">${escapeHtml(item.reason || "")}</p>
            <div class="sam-selection-meta"><span>${escapeHtml(item.category || "category")}</span><span>Interest ${escapeHtml(item.interest_score || item.interestScore || "—")}</span></div>
            <form class="sam-inline-review-form" data-sam-review-kind="shopping">
              <input type="hidden" name="sourceKey" value="${escapeHtml(samRegisterItemKey(item, "shopping"))}" />
              <input type="hidden" name="sourceMessageId" value="${escapeHtml(item.source_message_id || item.sourceMessageId || "")}" />
              <input type="hidden" name="retailer" value="${escapeHtml(item.retailer || "")}" />
              <input type="hidden" name="itemName" value="${escapeHtml(item.item_name || item.itemName || "")}" />
              <label><span>Status</span><select name="reviewStatus">${samInlineStatusOptions()}</select></label>
              <label><span>Interest</span><input name="interestScore" value="${escapeHtml(item.interest_score || item.interestScore || "")}" /></label>
              <label class="sam-field-wide"><span>Action</span><input name="actionRequired" placeholder="Buy, watch, ignore, or compare" /></label>
              <label class="sam-field-wide"><span>Notes</span><input name="operatorNotes" placeholder="Why this is or is not a useful highlight" /></label>
              <label class="sam-checkbox"><input type="checkbox" name="promotePolicyHint" checked /> <span>Learn from this</span></label>
              <button class="btn" type="submit">Save</button>
              <span class="muted" data-sam-review-alert></span>
            </form>
          </article>
        `).join("")}</div>`
      : samEmptyState({ title: "No shopping highlights", detail: "Only specific useful bargains or personally relevant items should appear here." });
  }

  const backlogWrap = $("#samLearningBacklog");
  if (backlogWrap) {
    backlogWrap.innerHTML = events.length
      ? `<div class="sam-selection-list">${events.slice(0, 60).map((item) => `
          <article class="sam-selection-card">
            <div class="sam-selection-head">
              <div>
                <h3>${escapeHtml(item.event_title || item.eventTitle || "Event")}</h3>
                <p class="muted">${escapeHtml(item.sender_email || item.senderEmail || "Event source")}</p>
              </div>
              <div class="sam-chip-row">
                <span class="chip">${escapeHtml(item.event_date || item.eventDate || "date unknown")}</span>
                <span class="chip">${escapeHtml(item.event_type || item.eventType || "event")}</span>
              </div>
            </div>
            <p class="muted">${escapeHtml(item.notes || "")}</p>
            <div class="sam-selection-meta"><span>${escapeHtml(item.event_location || item.eventLocation || "")}</span><span>Interest ${escapeHtml(item.interest_score || item.interestScore || "—")}</span><span>${escapeHtml(item.action_required || item.actionRequired || "")}</span></div>
            <form class="sam-inline-review-form" data-sam-review-kind="event">
              <input type="hidden" name="sourceKey" value="${escapeHtml(samRegisterItemKey(item, "event"))}" />
              <input type="hidden" name="sourceMessageId" value="${escapeHtml(item.source_message_id || item.sourceMessageId || "")}" />
              <input type="hidden" name="eventTitle" value="${escapeHtml(item.event_title || item.eventTitle || "")}" />
              <label><span>Status</span><select name="reviewStatus">${samInlineStatusOptions()}</select></label>
              <label><span>Interest</span><input name="interestScore" value="${escapeHtml(item.interest_score || item.interestScore || "")}" /></label>
              <label><span>Calendar</span><select name="calendarAction"><option value="">No calendar action</option><option value="queue_add">Queue add</option><option value="watch">Watch only</option></select></label>
              <label class="sam-field-wide"><span>Action</span><input name="actionRequired" value="${escapeHtml(item.action_required || item.actionRequired || "")}" /></label>
              <label class="sam-field-wide"><span>Notes</span><input name="operatorNotes" placeholder="Why this event matters or should be ignored" /></label>
              <label class="sam-checkbox"><input type="checkbox" name="promotePolicyHint" checked /> <span>Learn from this</span></label>
              <button class="btn" type="submit">Save</button>
              <span class="muted" data-sam-review-alert></span>
            </form>
          </article>
        `).join("")}</div>`
      : samEmptyState({ title: "No event highlights", detail: "Interesting invited or advertised events will appear here after Sam extracts them." });
  }
  bindSamRegisterReviewForms();
}

function samInlineStatusOptions(current = "reviewed") {
  return ["reviewed", "needs-review", "actioned", "ignored"].map((value) => `<option value="${value}" ${value === current ? "selected" : ""}>${escapeHtml(titleCaseToken(value))}</option>`).join("");
}

function samRegisterItemKey(item, prefix) {
  return `${prefix}:${item.source_message_id || item.sourceMessageId || ""}:${item.url || item.item_name || item.itemName || item.event_title || item.eventTitle || item.captured_at || item.capturedAt || ""}`.slice(0, 240);
}

function bindSamRegisterReviewForms() {
  document.querySelectorAll(".sam-inline-review-form").forEach((form) => {
    if (form.dataset.wired === "1") return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const kind = form.dataset.samReviewKind || "";
      const alertNode = form.querySelector("[data-sam-review-alert]");
      const button = form.querySelector("button[type='submit']");
      const payload = {};
      for (const [key, value] of fd.entries()) payload[key] = value;
      payload.promotePolicyHint = fd.get("promotePolicyHint") === "on";
      payload.jrCandidate = fd.get("jrCandidate") === "on";
      const op = kind === "content" ? "upsertContentReview" : kind === "shopping" ? "upsertShoppingReview" : kind === "event" ? "upsertEventReview" : "";
      if (!op) return;
      if (alertNode) alertNode.textContent = "Saving...";
      if (button) button.disabled = true;
      try {
        markSamFormClean(form);
        await samWrite(op, payload);
        if (alertNode) alertNode.textContent = "Saved";
      } catch (err) {
        if (alertNode) alertNode.textContent = err.message || String(err);
      } finally {
        if (button) button.disabled = false;
      }
    });
    form.dataset.wired = "1";
  });
}

function renderSamAutomationPage(data) {
  const statsNode = $("#samAutomationStats");
  if (!statsNode) return;

  const automation = data?.automation || {};
  const mailboxes = Array.isArray(automation.mailboxes) ? automation.mailboxes : [];
  const runs = Array.isArray(automation.runs) ? automation.runs : [];
  const lastSweep = mailboxes.map((item) => item.lastSweepAt).filter(Boolean).sort().reverse()[0];

  const cards = [
    ["Mailboxes", mailboxes.length],
    ["Last sweep", lastSweep ? fmtDateTime(lastSweep) : "No runs"],
    ["Last escalation", automation.lastEscalationAt ? fmtDateTime(automation.lastEscalationAt) : "None"],
    ["Weeks processed", automation.yahooHistory?.weeksProcessed || 0],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const guide = $("#samAutomationGuide");
  if (guide) {
    guide.innerHTML = `
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>What this page is for</h3>
          <p class="muted">Use Automation to verify Sam is actually running, mailboxes are sweeping, and escalation windows are healthy.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Operator actions</h3>
          <div class="sam-mini-stat-grid">
            ${samMetricCard("Mailbox sweeps", mailboxes.length)}
            ${samMetricCard("Run log rows", runs.length, runs.length ? "good" : "warn")}
            ${samMetricCard("Weeks processed", automation.yahooHistory?.weeksProcessed || 0)}
          </div>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Current gap</h3>
          <p class="muted">${runs.length ? "Run-level telemetry exists." : "Mailbox state is visible, but durable per-run logging is still missing."}</p>
        </article>
      </div>
    `;
  }

  const mailboxWrap = $("#samMailboxTable");
  if (mailboxWrap) {
    mailboxWrap.innerHTML = mailboxes.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Mailbox</th><th>Status</th><th>Last sweep</th></tr></thead><tbody>${mailboxes.map((mailbox) => `
          <tr>
            <td>${escapeHtml(mailbox.name || "—")}</td>
            <td><span class="chip chip-ok">${escapeHtml(mailbox.status || "unknown")}</span></td>
            <td>${escapeHtml(fmtDateTime(mailbox.lastSweepAt))}</td>
          </tr>
        `).join("")}</tbody></table></div>`
      : samEmptyState({ title: "No mailbox sweeps recorded", detail: "Mailbox status will render here after Sam automation writes sweep state." });
  }

  const historyWrap = $("#samAutomationHistory");
  if (historyWrap) {
    historyWrap.innerHTML = `
      <article class="project-card">
        <h3>Yahoo history anchor</h3>
        <div class="kv"><span>Last anchor date</span><strong>${escapeHtml(automation.yahooHistory?.lastAnchorDate || "—")}</strong></div>
        <div class="kv"><span>Window start</span><strong>${escapeHtml(automation.yahooHistory?.lastWindowStart || "—")}</strong></div>
        <div class="kv"><span>Window end</span><strong>${escapeHtml(automation.yahooHistory?.lastWindowEnd || "—")}</strong></div>
      </article>
    `;
  }

  const runWrap = $("#samRunTable");
  if (runWrap) {
    runWrap.innerHTML = runs.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Started</th><th>Mailbox</th><th>Status</th><th>Processed</th><th>Notes</th></tr></thead><tbody>${runs.map((run) => `
          <tr>
            <td>${escapeHtml(fmtDateTime(run.startedAt))}</td>
            <td>${escapeHtml(run.mailbox || "—")}</td>
            <td>${escapeHtml(run.status || "—")}</td>
            <td>${escapeHtml(run.processed || 0)}</td>
            <td class="muted">${escapeHtml(run.notes || "")}</td>
          </tr>
        `).join("")}</tbody></table></div>`
      : samEmptyState({ title: "No persisted automation run log yet", detail: "Current state only tracks last sweep timestamps and history windows. Add run-level event capture later for exact automation analytics." });
  }
}

function samFinanceRowKey(item) {
  return item?.ledgerKey || item?.ledger_key || item?.sourceMessageId || item?.source_message_id || `${item?.supplier || "finance"}-${item?.capturedAt || item?.captured_at || ""}`;
}

function samFinanceTypeOptions(rows, current = "all") {
  const values = Array.from(new Set(rows.map((item) => item.documentType || item.document_type).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [`<option value="all">All document types</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(titleCaseToken(value))}</option>`)].join("");
}

function renderSamFinancePage(data) {
  const statsNode = $("#samFinanceStats");
  if (!statsNode) return;

  const rows = Array.isArray(data?.financeLedger) ? data.financeLedger : [];
  const searchEl = $("#samFinanceSearch");
  const mailboxEl = $("#samFinanceMailboxFilter");
  const typeEl = $("#samFinanceTypeFilter");
  const query = (searchEl?.value || "").trim().toLowerCase();
  const mailbox = mailboxEl?.value || "all";
  const documentType = typeEl?.value || "all";

  wireSamSelect("#samFinanceMailboxFilter", getSamMailboxOptions(data), () => renderSamFinancePage(window.__samData || data), "All mailboxes");
  if (typeEl) {
    const prior = typeEl.value || "all";
    typeEl.innerHTML = samFinanceTypeOptions(rows, prior);
    typeEl.value = Array.from(typeEl.options).some((option) => option.value === prior) ? prior : "all";
    if (typeEl.dataset.wired !== "1") {
      typeEl.addEventListener("change", () => renderSamFinancePage(window.__samData || data));
      typeEl.dataset.wired = "1";
    }
  }
  if (searchEl && searchEl.dataset.wired !== "1") {
    searchEl.addEventListener("input", () => renderSamFinancePage(window.__samData || data));
    searchEl.dataset.wired = "1";
  }

  const filtered = rows.filter((item) => {
    const text = `${item.supplier || ""} ${item.senderEmail || ""} ${item.paymentMethod || ""} ${item.accountReference || ""} ${item.notes || ""} ${item.currentStatus || ""}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (mailbox !== "all" && item.mailbox !== mailbox) return false;
    if (documentType !== "all" && (item.documentType || item.document_type) !== documentType) return false;
    return true;
  });
  const visibleFinance = filtered.slice(0, 100);
  const selected = samSelectItem("finance", "selectedKey", visibleFinance, samFinanceRowKey);
  const needsReview = rows.filter((item) => item.reviewStatus === "needs-review" || item.actionRequired || !item.amount || item.currentStatus === "budget_exceeded").length;
  const budgetAlerts = rows.filter((item) => Number(item.budgetUsedPercent || 0) >= 75).length;
  const subscriptionRows = rows.filter((item) => /subscription|renewal|recurring/i.test(`${item.documentType || ""} ${item.frequency || ""} ${item.notes || ""}`));
  const amountTotal = rows.reduce((sum, item) => {
    const value = Number(String(item.amount || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const cards = [
    ["Ledger rows", rows.length],
    ["Visible rows", filtered.length],
    ["Needs review", needsReview],
    ["Budget alerts", budgetAlerts],
    ["Subscriptions", subscriptionRows.length],
    ["Known total", amountTotal ? amountTotal.toFixed(2) : "—"],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");

  const summary = $("#samFinanceSummary");
  if (summary) {
    summary.innerHTML = `
      ${samBackendNotice(data)}
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>Review posture</h3>
          <p class="muted">Correct the real supplier, payment method, amount, billing period, and budget status. Payment processors should not automatically become the supplier.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Policy learning</h3>
          <p class="muted">When you save a correction, Sam records the operator feedback and can promote a generic extraction policy hint instead of hardcoding a single sender.</p>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Duplicate safety</h3>
          <p class="muted">Rows with the same ledger key represent the same product or period and should be updated rather than double-counted.</p>
        </article>
      </div>
    `;
  }

  const table = $("#samFinanceTable");
  const inspector = $("#samFinanceInspector");
  if (table) {
    table.innerHTML = filtered.length
      ? `${filtered.length > visibleFinance.length ? `<div class="sam-inline-alert">Showing the first ${visibleFinance.length} matching ledger rows. Search or filter for older records.</div>` : ""}
        <div class="table-wrap"><table class="table sam-email-summary-table sam-compact-table">
          <thead><tr><th>Supplier</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
          <tbody>${visibleFinance.map((item) => {
            const key = samFinanceRowKey(item);
            return `<tr class="${samFinanceRowKey(selected) === key ? "sam-row-selected" : ""}" data-sam-finance-select="${escapeHtml(key)}">
              <td><strong>${escapeHtml(item.supplier || "—")}</strong><div class="muted">${escapeHtml(titleCaseToken(item.documentType || item.document_type || "unknown"))} · ${escapeHtml(item.mailbox || "—")}</div></td>
              <td>${escapeHtml([item.currency, item.amount].filter(Boolean).join(" ") || "—")}</td>
              <td>${item.reviewStatus === "reviewed" ? '<span class="chip chip-ok">Reviewed</span>' : `<span class="chip ${item.currentStatus === "budget_exceeded" ? "chip-warn" : ""}">${escapeHtml(item.currentStatus || "unreviewed")}</span>`}<div class="muted">${escapeHtml(item.budgetUsedPercent ? `${item.budgetUsedPercent}% of ${item.budgetAmount || "budget"}` : "")}</div></td>
              <td>${escapeHtml(fmtDateTime(item.capturedAt || item.captured_at))}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`
      : samEmptyState({ title: "No finance rows match", detail: "Adjust the mailbox, document type, or search filter." });
    table.querySelectorAll("[data-sam-finance-select]").forEach((row) => {
      row.addEventListener("click", () => {
        samUiState.finance.selectedKey = row.getAttribute("data-sam-finance-select") || "";
        renderSamFinancePage(window.__samData || data);
      });
    });
  }

  if (inspector) {
    inspector.innerHTML = selected ? `
      <article class="sam-inspector-shell">
        <div class="sam-inspector-header">
          <div>
            <h3>${escapeHtml(selected.supplier || "Finance record")}</h3>
            <p class="muted">${escapeHtml(selected.senderEmail || "—")} · ${escapeHtml(selected.mailbox || "—")}</p>
          </div>
          <div class="sam-chip-row">
            <span class="chip">${escapeHtml(titleCaseToken(selected.documentType || "finance"))}</span>
            ${selected.currentStatus === "budget_exceeded" ? '<span class="chip chip-warn">Budget exceeded</span>' : ""}
            ${selected.reviewStatus === "reviewed" ? '<span class="chip chip-ok">Reviewed</span>' : '<span class="chip chip-warn">Needs review</span>'}
          </div>
        </div>
        <div class="sam-kv-grid">
          <div><span>Payment method</span><strong>${escapeHtml(selected.paymentMethod || "—")}</strong></div>
          <div><span>Billing period</span><strong>${escapeHtml(selected.billingPeriod || "—")}</strong></div>
          <div><span>Frequency</span><strong>${escapeHtml(selected.frequency || "—")}</strong></div>
          <div><span>Ledger key</span><strong>${escapeHtml(samFinanceRowKey(selected))}</strong></div>
        </div>
        <form id="samFinanceInspectorForm" class="sam-form-stack" data-ledger-key="${escapeHtml(samFinanceRowKey(selected))}">
          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Assessment</h4>
              <p class="muted">Confirm whether this record is a real finance/tax item and whether it needs action.</p>
            </div>
          <div class="sam-form-grid">
            <label><span>Review status</span><select name="reviewStatus">${["needs-review", "reviewed", "actioned", "ignored"].map((value) => `<option value="${value}" ${(selected.reviewStatus || "needs-review") === value ? "selected" : ""}>${escapeHtml(titleCaseToken(value))}</option>`).join("")}</select></label>
            <label><span>Document type</span><input class="input" name="documentType" value="${escapeHtml(selected.documentType || "")}" /></label>
            <label><span>Status</span><input class="input" name="currentStatus" value="${escapeHtml(selected.currentStatus || "")}" /></label>
            <label><span>Tax relevance</span><select name="taxRelevance">${["unknown", "no", "possible", "yes"].map((value) => `<option value="${value}" ${(selected.taxRelevance || "unknown") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          </div>
          </div>
          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Money and supplier</h4>
              <p class="muted">Correct the actual supplier separately from sender and payment method.</p>
            </div>
          <div class="sam-form-grid">
            <label><span>Supplier</span><input class="input" name="supplier" value="${escapeHtml(selected.supplier || "")}" /></label>
            <label><span>Payment method</span><input class="input" name="paymentMethod" value="${escapeHtml(selected.paymentMethod || "")}" /></label>
            <label><span>Amount</span><input class="input" name="amount" value="${escapeHtml(selected.amount || "")}" /></label>
            <label><span>Currency</span><input class="input" name="currency" value="${escapeHtml(selected.currency || "")}" /></label>
            <label><span>Frequency</span><input class="input" name="frequency" value="${escapeHtml(selected.frequency || "")}" /></label>
            <label><span>Billing period</span><input class="input" name="billingPeriod" value="${escapeHtml(selected.billingPeriod || "")}" /></label>
            <label><span>Budget amount</span><input class="input" name="budgetAmount" value="${escapeHtml(selected.budgetAmount || "")}" /></label>
            <label><span>Budget used %</span><input class="input" name="budgetUsedPercent" value="${escapeHtml(selected.budgetUsedPercent || "")}" /></label>
            <label><span>Account reference</span><input class="input" name="accountReference" value="${escapeHtml(selected.accountReference || "")}" /></label>
          </div>
          </div>
          <div class="sam-form-section">
            <div class="sam-form-section-head">
              <h4>Healing and learning</h4>
              <p class="muted">Save the corrected ledger row and record a reusable extraction lesson.</p>
            </div>
          <div class="sam-form-grid">
            <label class="sam-field-wide"><span>Action required</span><textarea class="input" rows="2" name="actionRequired">${escapeHtml(selected.actionRequired || "")}</textarea></label>
            <label class="sam-field-wide"><span>Operator notes</span><textarea class="input" rows="3" name="operatorNotes">${escapeHtml(selected.operatorNotes || selected.notes || "")}</textarea></label>
            <label class="sam-checkbox"><input type="checkbox" name="promotePolicyHint" checked /> <span>Update generic finance extraction policy from this correction</span></label>
          </div>
          </div>
          <div class="sam-action-row">
            <button class="btn btn-active" type="submit">Save finance review</button>
            <span id="samFinanceReviewAlert" class="muted">${selected.reviewedAt ? `Last saved ${escapeHtml(fmtDateTime(selected.reviewedAt))}` : "No operator writeback yet."}</span>
          </div>
        </form>
      </article>
    ` : samEmptyState({ title: "No finance row selected", detail: "Select a ledger row to review supplier and amount extraction." });

    $("#samFinanceInspectorForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const payload = {
        ledgerKey: form.dataset.ledgerKey,
        sourceMessageId: selected.sourceMessageId || selected.source_message_id || "",
        mailbox: selected.mailbox || "",
        senderEmail: selected.senderEmail || selected.sender_email || "",
        reviewStatus: fd.get("reviewStatus"),
        supplier: fd.get("supplier"),
        paymentMethod: fd.get("paymentMethod"),
        documentType: fd.get("documentType"),
        amount: fd.get("amount"),
        currency: fd.get("currency"),
        frequency: fd.get("frequency"),
        billingPeriod: fd.get("billingPeriod"),
        budgetAmount: fd.get("budgetAmount"),
        budgetUsedPercent: fd.get("budgetUsedPercent"),
        currentStatus: fd.get("currentStatus"),
        taxRelevance: fd.get("taxRelevance"),
        accountReference: fd.get("accountReference"),
        actionRequired: fd.get("actionRequired"),
        operatorNotes: fd.get("operatorNotes"),
        promotePolicyHint: fd.get("promotePolicyHint") === "on",
      };
      const alertNode = $("#samFinanceReviewAlert");
      if (alertNode) alertNode.textContent = "Saving...";
      try {
        markSamFormClean(form);
        await samWrite("upsertFinanceReview", payload);
        if (alertNode) alertNode.textContent = "Saved finance review and Sam learning hint.";
      } catch (err) {
        if (alertNode) alertNode.textContent = err.message || String(err);
      }
    });
  }
}

function samEmailSummaryStatusOptions(current = "unreviewed") {
  const options = [
    ["unreviewed", "Needs review"],
    ["reviewed", "Reviewed"],
    ["actioned", "Actioned"],
    ["ignored", "Ignored"],
  ];
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function samEmailSummaryFieldValue(item, primary, fallback = "") {
  return item?.[primary] ?? fallback;
}

function samEmailStatusChip(status) {
  const value = String(status || "unreviewed").toLowerCase();
  const labelMap = { unreviewed: "Needs review", reviewed: "Reviewed", actioned: "Actioned", ignored: "Ignored" };
  const tone = value === 'actioned' || value === 'reviewed' ? 'chip-ok' : value === 'ignored' ? '' : 'chip-warn';
  return `<span class="chip ${tone}">${escapeHtml(labelMap[value] || value)}</span>`;
}

function bindSamEmailSummaryInteractions(data, items) {
  document.querySelectorAll('[data-sam-email-select]').forEach((node) => {
    node.addEventListener('click', () => {
      window.__samEmailSelectedDecisionId = node.getAttribute('data-sam-email-select') || '';
      renderSamEmailSummaryPage(window.__samData || data);
    });
  });
  const form = document.querySelector('#samEmailReviewForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = {
      decisionId: String(formData.get('decisionId') || ''),
      email: String(formData.get('email') || ''),
      domain: String(formData.get('domain') || ''),
      displayName: String(formData.get('displayName') || ''),
      status: String(formData.get('status') || 'reviewed'),
      correctedCategory: String(formData.get('correctedCategory') || ''),
      correctedFolder: String(formData.get('correctedFolder') || ''),
      correctedClassification: String(formData.get('correctedClassification') || ''),
      operatorNotes: String(formData.get('operatorNotes') || '').trim(),
      nextStep: String(formData.get('nextStep') || '').trim(),
      queueFolderMove: formData.get('queueFolderMove') === 'on',
      promoteToRule: formData.get('promoteToRule') === 'on',
      ruleScope: String(formData.get('ruleScope') || ''),
      ruleDescription: String(formData.get('ruleDescription') || '').trim(),
    };
    const alertNode = document.querySelector('#samEmailReviewAlert');
    if (alertNode) alertNode.textContent = 'Saving…';
    if (submitBtn) submitBtn.disabled = true;
    try {
      markSamFormClean(form);
      const nextData = await samWrite('upsertEmailSummaryFeedback', payload);
      window.__samEmailSelectedDecisionId = payload.decisionId;
      if (nextData) renderSamEmailSummaryPage(window.__samData || nextData);
      if (alertNode) alertNode.textContent = 'Saved to the live operator log and Sam state.';
    } catch (error) {
      if (alertNode) alertNode.textContent = error.message || String(error);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function renderSamEmailSummaryPage(data) {
  const statsNode = $("#samEmailSummaryStats");
  if (!statsNode) return;

  const overview = data?.overview || {};
  const recentDecisions = Array.isArray(data?.recentDecisions) ? data.recentDecisions : [];
  const mailboxEl = $("#samEmailMailboxFilter");
  const statusEl = $("#samEmailStatusFilter");
  const searchEl = $("#samEmailSearch");
  const mailbox = mailboxEl?.value || "all";
  const statusFilter = statusEl?.value || "needs";
  const query = (searchEl?.value || "").trim().toLowerCase();
  const digest = data?.digest || {};
  const folderDistribution = overview.folderDistribution || overview.categoryDistribution || {};
  const operatorStatusCounts = overview.operatorStatusCounts || {};
  const freshness = $("#samEmailDataFreshness");
  if (freshness) freshness.textContent = `Live summary refreshed ${fmtDateTime(data?.generatedAt)}`;

  const cards = [
    ["Tracked emails", overview.totalEmails || 0],
    ["Needs review", overview.needsReviewCount || 0],
    ["Reviewed", operatorStatusCounts.reviewed || 0],
    ["Actioned", operatorStatusCounts.actioned || 0],
    ["Avg confidence", overview.averageConfidence || 0],
  ];
  statsNode.innerHTML = cards.map(([label, value]) => `<article class="stat sam-stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></article>`).join("");
  wireSamSelect("#samEmailMailboxFilter", getSamMailboxOptions(data), () => renderSamEmailSummaryPage(window.__samData || data), "All mailboxes");
  if (statusEl && statusEl.dataset.wired !== "1") {
    statusEl.addEventListener("change", () => renderSamEmailSummaryPage(window.__samData || data));
    statusEl.dataset.wired = "1";
  }
  if (searchEl && searchEl.dataset.wired !== "1") {
    searchEl.addEventListener("input", () => renderSamEmailSummaryPage(window.__samData || data));
    searchEl.dataset.wired = "1";
  }

  const overviewWrap = $("#samEmailSummaryOverview");
  if (overviewWrap) {
    const folderRows = Object.entries(folderDistribution)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .map(([folder, count]) => `<div class="kv"><span>${escapeHtml(prettifyFolder(folder))}</span><strong>${escapeHtml(count)}</strong></div>`)
      .join("");
    const statusRows = Object.entries(operatorStatusCounts)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .map(([status, count]) => `<div class="kv"><span>${escapeHtml(status)}</span><strong>${escapeHtml(count)}</strong></div>`)
      .join("");
    overviewWrap.innerHTML = `
      <div class="sam-callout-grid">
        <article class="project-card sam-card-accent">
          <h3>Inbox posture</h3>
          <div class="kv"><span>Generated</span><strong>${escapeHtml(fmtDateTime(data?.generatedAt))}</strong></div>
          <div class="kv"><span>Digest window</span><strong>${escapeHtml(digest.windowHours || 0)} hours</strong></div>
          <div class="kv"><span>Latest digest</span><strong>${escapeHtml(fmtDateTime(digest.createdAt))}</strong></div>
        </article>
        <article class="project-card sam-card-accent">
          <h3>Folder distribution</h3>
          ${folderRows || '<p class="muted">No folder distribution yet.</p>'}
        </article>
        <article class="project-card sam-card-accent">
          <h3>Operator status</h3>
          ${statusRows || '<p class="muted">No operator feedback captured yet.</p>'}
        </article>
        <article class="project-card sam-card-accent">
          <h3>Digest preview</h3>
          <p class="muted">${escapeHtml((digest.renderedDigest || "No digest text available.").slice(0, 280))}</p>
        </article>
      </div>
    `;
  }

  const reviewWrap = $("#samEmailReviewQueue");
  if (reviewWrap) {
    const sorted = [...recentDecisions]
      .filter((item) => mailbox === "all" || item.mailbox === mailbox)
      .filter((item) => {
        const status = String(item.operatorStatus || item.reviewStatus || "unreviewed").toLowerCase();
        if (statusFilter === "needs") return item.needsReview || status === "unreviewed" || status === "needs-review";
        if (statusFilter !== "all" && status !== statusFilter) return false;
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        const text = `${item.displayName || ""} ${item.email || ""} ${item.classificationLabel || ""} ${item.derivedFolder || ""} ${item.summaryText || ""} ${item.notes || ""} ${item.recommendedAction || ""}`.toLowerCase();
        return text.includes(query);
      })
      .sort((a, b) => new Date(b.feedbackCreatedAt || b.createdAt || 0) - new Date(a.feedbackCreatedAt || a.createdAt || 0));
    const visibleQueue = sorted.slice(0, 100);
    const selectedId = window.__samEmailSelectedDecisionId && visibleQueue.some((item) => item.decisionId === window.__samEmailSelectedDecisionId)
      ? window.__samEmailSelectedDecisionId
      : (visibleQueue[0]?.decisionId || '');
    window.__samEmailSelectedDecisionId = selectedId;
    const selected = visibleQueue.find((item) => item.decisionId === selectedId) || null;
    reviewWrap.innerHTML = sorted.length ? `
      <div class="sam-workbench-wide sam-email-summary-shell">
        <div class="sam-selection-list">
          ${sorted.length > visibleQueue.length ? `<div class="sam-inline-alert">Showing the first ${visibleQueue.length} matching emails. Use search, mailbox, or status filters to narrow the review set.</div>` : ""}
          ${visibleQueue.map((item) => `
            <button class="sam-selection-button" type="button" data-sam-email-select="${escapeHtml(item.decisionId)}">
              ${samSelectionCard({
                title: item.displayName || item.email || "Email review",
                subtitle: `${item.mailbox || "Mailbox"} · ${item.email || "unknown sender"}`,
                active: item.decisionId === selectedId,
                chips: `${samEmailStatusChip(item.operatorStatus || item.reviewStatus)}${item.needsReview ? '<span class="chip chip-warn">Review</span>' : '<span class="chip chip-ok">Clear</span>'}${item.urgent ? '<span class="chip chip-warn">Urgent</span>' : ''}`,
                body: item.summaryText || item.notes || item.recommendedAction || "",
                meta: `
                  <span>${escapeHtml(item.operatorCategory || item.classificationLabel || "Unclassified")}</span>
                  <span>${escapeHtml(prettifyFolder(item.operatorFolder || item.derivedFolder || ""))}</span>
                  <span>${escapeHtml(fmtDateTime(item.feedbackCreatedAt || item.createdAt || item.messageDate))}</span>
                `,
              })}
            </button>
          `).join('')}
        </div>
        ${selected ? `
          <article class="sam-detail-stack sam-email-detail-card">
            <div class="sam-selection-head">
              <div>
                <h3>${escapeHtml(selected.displayName || selected.email || 'Email review')}</h3>
                <p class="muted">${escapeHtml(selected.mailbox || '—')} · ${escapeHtml(selected.email || '—')} · ${escapeHtml(fmtDateTime(selected.messageDate || selected.createdAt))}</p>
              </div>
              <div class="sam-chip-row">
                ${samEmailStatusChip(selected.operatorStatus || selected.reviewStatus)}
                ${selected.promotedToRule ? '<span class="chip chip-ok">Rule promoted</span>' : ''}
                ${selected.mailboxHealingQueued ? '<span class="chip chip-warn">Move queued</span>' : ''}
                ${selected.urgent ? '<span class="chip chip-warn">Urgent</span>' : ''}
              </div>
            </div>
            <div class="sam-review-step-grid">
              <div><span>Sam chose</span><strong>${escapeHtml(selected.classificationLabel || '—')}</strong><em>${escapeHtml(prettifyFolder(selected.derivedFolder || '—'))}</em></div>
              <div><span>Why</span><strong>${escapeHtml(selected.reason || selected.summaryText || selected.notes || '—')}</strong></div>
              <div><span>Action</span><strong>${escapeHtml(selected.recommendedAction || 'No action captured')}</strong></div>
            </div>
            <form id="samEmailReviewForm" class="sam-form-stack">
              <input type="hidden" name="decisionId" value="${escapeHtml(selected.decisionId)}" />
              <input type="hidden" name="email" value="${escapeHtml(selected.email || '')}" />
              <input type="hidden" name="domain" value="${escapeHtml(selected.domain || '')}" />
              <input type="hidden" name="displayName" value="${escapeHtml(selected.displayName || '')}" />
              <div class="sam-form-section">
                <div class="sam-form-section-head">
                  <h4>Assessment</h4>
                  <p class="muted">Mark whether Sam's decision is good enough, then correct only what is wrong.</p>
                </div>
                <div class="sam-form-grid">
                <label>
                  <span>Status</span>
                  <select name="status">${samEmailSummaryStatusOptions(selected.operatorStatus || selected.reviewStatus || 'unreviewed')}</select>
                </label>
                <label>
                  <span>Corrected category</span>
                  <select name="correctedCategory">${samCategoryOptions(data, samEmailSummaryFieldValue(selected, 'operatorCategory', selected.classificationLabel || ''))}</select>
                </label>
                <label>
                  <span>Corrected folder</span>
                  <select name="correctedFolder">${samFolderOptions(data, samEmailSummaryFieldValue(selected, 'operatorFolder', selected.derivedFolder || ''))}</select>
                </label>
                <label>
                  <span>Corrected classification</span>
                  <input name="correctedClassification" value="${escapeHtml(selected.operatorClassification || selected.classificationLabel || '')}" placeholder="e.g. reviewAction, itNews, finance" />
                </label>
                </div>
              </div>
              <div class="sam-form-section">
                <div class="sam-form-section-head">
                  <h4>Healing</h4>
                  <p class="muted">Saves the corrected register state now. Mailbox movement is queued when the backend has enough source identifiers to move safely.</p>
                </div>
                <label class="sam-checkbox">
                  <input type="checkbox" name="queueFolderMove" ${(selected.operatorFolder && selected.operatorFolder !== selected.derivedFolder) ? 'checked' : ''} />
                  <span>Queue mailbox folder correction to the selected folder</span>
                </label>
              </div>
              <div class="sam-form-section">
                <div class="sam-form-section-head">
                  <h4>Learning</h4>
                  <p class="muted">Write a general lesson. Avoid sender-specific wording unless the sender itself is the rule.</p>
                </div>
                <label class="sam-field-wide">
                  <span>Operator notes</span>
                  <textarea name="operatorNotes" rows="4" placeholder="Why Sam got this wrong or what matters here">${escapeHtml(selected.operatorNotes || '')}</textarea>
                </label>
                <label class="sam-field-wide">
                  <span>Next step</span>
                  <textarea name="nextStep" rows="3" placeholder="What Jesse or Sam should do next">${escapeHtml(selected.nextStep || selected.recommendedAction || '')}</textarea>
                </label>
                <label class="sam-checkbox">
                  <input type="checkbox" name="promoteToRule" ${selected.promotedToRule ? 'checked' : ''} />
                  <span>Promote this correction into Sam learning/rules</span>
                </label>
                <label>
                  <span>Rule scope</span>
                  <select name="ruleScope">
                    <option value="sender" ${(selected.ruleScope || 'sender') === 'sender' ? 'selected' : ''}>Sender email</option>
                    <option value="domain" ${(selected.ruleScope || '') === 'domain' ? 'selected' : ''}>Domain</option>
                  </select>
                </label>
                <label>
                  <span>Rule note</span>
                  <input name="ruleDescription" value="${escapeHtml(selected.ruleDescription || selected.operatorNotes || '')}" placeholder="Why this should stick" />
                </label>
              </div>
              </div>
              <div class="sam-action-row">
                <button class="btn btn-primary" type="submit">Save operator review</button>
                <span id="samEmailReviewAlert" class="muted">${selected.feedbackCreatedAt ? `Last operator save ${escapeHtml(fmtDateTime(selected.feedbackCreatedAt))}` : 'No operator writeback yet.'}</span>
              </div>
            </form>
          </article>
        ` : ''}
      </div>
    ` : samEmptyState({ title: 'No live review queue', detail: 'No recent Sam email summaries currently need manual review.' });

    bindSamEmailSummaryInteractions(data, sorted);
  }
}


async function modelUsageFromJson(cfg) {
  const usage = {};
  let runs = 0;
  let tokens = 0;
  let estimatedTokens = 0;
  const ytd = { runs: 0, tokens: 0 };
  const currentWeek = { runs: 0, tokens: 0 };
  const previousWeek = { runs: 0, tokens: 0 };

  for (const src of cfg.jsonSources || []) {
    try {
      const data = await loadJson(src);
      const arr = Array.isArray(data) ? data : [data];
      const isWeekly = String(src).toLowerCase().includes("weekly");
      const isPrevProxy = String(src).toLowerCase().includes("refresh") || String(src).toLowerCase().includes("reliability");

      for (const item of arr) {
        runs += 1;
        ytd.runs += 1;
        const name = normalizeModel(item.case || item.scenario || item.model || item.provider || "unknown-model");
        const ok = Number(item.code ?? item.exit_code ?? 0) === 0;
        const tk = estimateTokens(item);
        tokens += tk.tokens;
        ytd.tokens += tk.tokens;
        if (isWeekly) {
          currentWeek.runs += 1;
          currentWeek.tokens += tk.tokens;
        } else if (isPrevProxy) {
          previousWeek.runs += 1;
          previousWeek.tokens += tk.tokens;
        }
        if (tk.estimated) estimatedTokens += tk.tokens;
        usage[name] = usage[name] || { runs: 0, tokens: 0, success: 0 };
        usage[name].runs += 1;
        usage[name].tokens += tk.tokens;
        usage[name].success += ok ? 1 : 0;
      }
    } catch {}
  }
  return { usage, totals: { runs, tokens, estimatedTokens, ytd, currentWeek, previousWeek } };
}

async function boot() {
  if ($("#serverMonitorStats")) {
    renderServerMonitorPage(await loadServerDetails());
    return;
  }

  const cfg = await loadJson("./data-sources.json");
  const projects = cfg.projects || [];
  const loadedTasks = await loadTasks();
  let tasks = bootstrapTasksIfEmpty(projects, loadedTasks);
  const modelData = await modelUsageFromJson(cfg);
  const modelUsage = modelData.usage;

  let capabilityData = { skills: [], mcpServers: [], scheduledReview: null };
  try {
    capabilityData = await loadJson("./capability-data.json");
  } catch {}

  let projectDailyMetrics = [];
  let projectDailyUpdatedAt = "unknown";
  try {
    const metricsJson = await loadJson("./project-daily-metrics.json");
    projectDailyMetrics = Array.isArray(metricsJson?.records) ? metricsJson.records : [];
    projectDailyUpdatedAt = metricsJson?.updatedAt || "unknown";
  } catch {}

  let modelDailyMetrics = [];
  let modelDailyUpdatedAt = "unknown";
  try {
    const modelMetricsJson = await loadJson("./model-daily-metrics.json");
    modelDailyMetrics = Array.isArray(modelMetricsJson?.records) ? modelMetricsJson.records : [];
    modelDailyUpdatedAt = modelMetricsJson?.updatedAt || "unknown";
  } catch {}

  let projectModelDaily = [];
  try {
    const pmJson = await loadJson("./project-model-daily-metrics.json");
    projectModelDaily = Array.isArray(pmJson?.records) ? pmJson.records : [];
  } catch {}
  window.__projectModelDaily = projectModelDaily;
  window.__projectDailyUpdatedAt = projectDailyUpdatedAt;
  window.__modelDailyUpdatedAt = modelDailyUpdatedAt;

  let statusMetrics = {};
  try {
    statusMetrics = await loadJson("./status-metrics.json");
  } catch {}

  let gatewayTokenMetrics = {};
  try {
    gatewayTokenMetrics = await loadJson("./gateway-token-metrics.json");
  } catch {}

  let memoryData = {};
  try {
    memoryData = await loadJson("./memory-dashboard.json");
  } catch {}

  let memoryFiles = {};
  try {
    memoryFiles = await loadJson("./memory-file-snapshots.json");
  } catch {}

  let secretRegistry = {};
  try {
    secretRegistry = await loadJson("./secret-registry-view.json");
  } catch {}

  let cronPlannerData = {};
  try {
    cronPlannerData = await loadJson("./cron-planner-data.json");
  } catch {}

  let samData = {};
  try {
    samData = await loadJson("./sam-data.json");
  } catch {}
  const samBackend = await detectSamBackend();
  samData.__backend = samBackend;
  window.__samData = samData;
  window.__samBackend = samBackend;

  setupTokenFilters({ gatewayTokenMetrics, projectDailyMetrics });

  if ($("#originalStats") && $("#kanbanStats")) renderHome({ projects, tasks, modelUsage, modelTotals: modelData.totals, capabilityData, projectDailyMetrics });
  if ($("#kanbanBoard")) renderKanban(projects, tasks);
  if ($("#allProjectsGrid")) renderProjectsPage(projects, tasks);
  if ($("#capabilityStats")) renderCapabilitiesPage(capabilityData);
  if ($("#tokenUsageStats")) renderTokenUsagePage({ modelUsage, modelTotals: modelData.totals, projectDailyMetrics, modelDailyMetrics, statusMetrics, gatewayTokenMetrics });
  if ($("#statusMetricsWrap")) renderSystemPage(statusMetrics);
  if ($("#memoryStats")) renderMemoryPage(memoryData, memoryFiles);
  if ($("#secretsStats")) renderSecretsPage(secretRegistry);
  if ($("#cronTableBody")) renderCronPlannerPage(cronPlannerData);
  if (hasActiveSamDraft()) return;
  rerenderSamPages(samData);
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  if (!shouldAutoRefreshPage()) return;
  refreshTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    boot().catch(() => {});
  }, 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      boot().catch(() => {});
    }
  });
}

boot()
  .then(() => {
    scheduleAutoRefresh();
  })
  .catch((err) => {
    const target = $("#serverMonitorStats") || $("#originalStats") || $("#kanbanStats") || $("#kanbanBoard") || $("#allProjectsGrid") || $("#samOverviewStats") || $("#samDecisionStats") || $("#samPolicyStats") || $("#samRuleStats") || $("#samDirectoryStats") || $("#samLearningStats") || $("#samAutomationStats") || $("#samEmailSummaryStats");
    if (target) target.innerHTML = `<article class="stat"><div class="label warn">App failed</div><div>${err.message}</div></article>`;
  });
