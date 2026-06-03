const API_BASE = "https://token-gen-api.owenonthenet.com";

const $ = (selector) => document.querySelector(selector);
const els = {
  status: $("#chatStatus"),
  model: $("#chatModel"),
  system: $("#chatSystem"),
  temperature: $("#chatTemperature"),
  maxTokens: $("#chatMaxTokens"),
  reasoning: $("#chatReasoning"),
  documents: $("#chatDocuments"),
  docBudget: $("#chatDocBudget"),
  docStatus: $("#chatDocStatus"),
  docMeter: $("#chatDocMeter"),
  docList: $("#chatDocList"),
  docClear: $("#chatDocClear"),
  webSearch: $("#chatWebSearch"),
  webFetchMode: $("#chatWebFetchMode"),
  webResults: $("#chatWebResults"),
  webBudget: $("#chatWebBudget"),
  webStatus: $("#chatWebStatus"),
  clear: $("#chatClear"),
  thread: $("#chatThread"),
  form: $("#chatForm"),
  input: $("#chatInput"),
  send: $("#chatSend"),
};

let messages = [
  {
    role: "assistant",
    content: "Token Gen chat is ready. Ask a short test question or paste a prompt you want to run locally.",
  },
];
let webSearchSupported = false;
let availableModels = [];
let uploadedDocuments = [];
let mammothLoader = null;

const DEFAULT_CONTEXT_WINDOW = 131072;
const TOKEN_CHARS = 4;
const SUPPORTED_TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "jsonl", "html", "htm", "xml", "yaml", "yml", "log",
  "js", "ts", "tsx", "jsx", "py", "ps1", "sh", "sql", "css", "rtf",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function modelLabel(id) {
  return String(id || "").split("/").filter(Boolean).pop() || id || "model";
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / TOKEN_CHARS);
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function getSelectedModel() {
  return availableModels.find((model) => model.id === els.model.value) || availableModels[0] || {};
}

function getModelContextWindow(model = getSelectedModel()) {
  const candidates = [
    model.max_model_len,
    model.maxModelLen,
    model.max_context_length,
    model.max_context_tokens,
    model.context_length,
    model.context_window,
    model.max_sequence_length,
  ];
  const nested = model.metadata || model.config || model.extra || {};
  candidates.push(
    nested.max_model_len,
    nested.max_context_length,
    nested.context_length,
    nested.context_window,
  );
  const detected = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return Number(detected || els.maxTokens.max || DEFAULT_CONTEXT_WINDOW);
}

function getDocumentBudgetPercent() {
  return clampNumber(els.docBudget.value, 30, 30, 75);
}

function getDocumentBudgetTokens() {
  return Math.floor(getModelContextWindow() * (getDocumentBudgetPercent() / 100));
}

function setStatus(text, state = "neutral") {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-AU");
}

function fileExtension(name) {
  return String(name || "").split(".").pop()?.toLowerCase() || "";
}

function stripHtml(text) {
  const doc = new DOMParser().parseFromString(String(text || ""), "text/html");
  doc.querySelectorAll("script,style,noscript,template").forEach((node) => node.remove());
  return doc.body?.textContent?.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim() || "";
}

function stripRtf(text) {
  return String(text || "")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+\d* ?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDocumentText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function readTextFile(file) {
  const text = await file.text();
  const extension = fileExtension(file.name);
  if (extension === "html" || extension === "htm" || file.type === "text/html") return stripHtml(text);
  if (extension === "rtf" || file.type === "application/rtf") return stripRtf(text);
  return text;
}

async function loadPdfJs() {
  const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  return pdfjs;
}

async function readPdfFile(file) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (mammothLoader) return mammothLoader;
  mammothLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
    script.async = true;
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error("DOCX parser did not load."));
    script.onerror = () => reject(new Error("Could not load DOCX parser."));
    document.head.appendChild(script);
  });
  return mammothLoader;
}

async function readDocxFile(file) {
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value || "";
}

async function extractDocument(file) {
  const extension = fileExtension(file.name);
  let text = "";
  if (extension === "pdf" || file.type === "application/pdf") {
    text = await readPdfFile(file);
  } else if (extension === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    text = await readDocxFile(file);
  } else if (SUPPORTED_TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
    text = await readTextFile(file);
  } else {
    throw new Error("Unsupported file type. Use PDF, DOCX, TXT, Markdown, CSV, JSON, HTML, XML, YAML, code, log, or RTF files.");
  }
  const normalized = normalizeDocumentText(text);
  if (!normalized) throw new Error("No readable text was found in this file.");
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || extension.toUpperCase(),
    chars: normalized.length,
    tokens: estimateTokens(normalized),
    text: normalized,
  };
}

function documentTokenTotal(docs = uploadedDocuments) {
  return docs.reduce((total, doc) => total + doc.tokens, 0);
}

function documentBadge(name) {
  const extension = fileExtension(name);
  if (!extension) return "DOC";
  if (extension === "markdown") return "MD";
  if (extension === "yaml") return "YML";
  return extension.slice(0, 4).toUpperCase();
}

function renderDocuments() {
  const total = documentTokenTotal();
  const budget = getDocumentBudgetTokens();
  const percentUsed = budget ? Math.min(100, (total / budget) * 100) : 0;
  const overBudget = total > budget;
  els.docBudget.value = String(getDocumentBudgetPercent());
  els.docMeter.style.width = `${percentUsed}%`;
  els.docMeter.dataset.state = overBudget ? "bad" : total ? "good" : "neutral";
  els.docStatus.textContent = uploadedDocuments.length
    ? `${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? "" : "s"} using ${formatNumber(total)} of ${formatNumber(budget)} tokens.`
    : `No documents attached. Budget is ${formatNumber(budget)} tokens.`;
  els.docStatus.dataset.state = overBudget ? "bad" : total ? "good" : "neutral";
  els.docList.innerHTML = uploadedDocuments.map((doc) => `
    <div class="chat-doc-item">
      <div class="chat-doc-badge">${escapeHtml(documentBadge(doc.name))}</div>
      <div>
        <strong title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
        <span>${formatNumber(doc.tokens)} tokens</span>
      </div>
      <button class="chat-doc-remove" type="button" data-doc-id="${escapeHtml(doc.id)}" aria-label="Remove ${escapeHtml(doc.name)}">x</button>
    </div>
  `).join("");
  els.send.disabled = overBudget;
}

function buildDocumentContextMessage() {
  if (!uploadedDocuments.length) return null;
  const sections = uploadedDocuments.map((doc, index) => [
    `Document ${index + 1}: ${doc.name}`,
    `Estimated tokens: ${doc.tokens}`,
    doc.text,
  ].join("\n"));
  return {
    role: "system",
    content: [
      "The user uploaded the following document context. Use it when relevant, cite document names when answering from it, and ignore it when it is not relevant.",
      ...sections.map((section) => `<document>\n${section}\n</document>`),
    ].join("\n\n"),
  };
}

function renderMessages(pending = false) {
  els.thread.innerHTML = messages.map((message) => `
    <article class="chat-message chat-message-${message.role}">
      <div class="chat-avatar">${message.role === "user" ? "You" : "TG"}</div>
      <div class="chat-bubble">
        <div class="chat-role">${message.role === "user" ? "You" : "Token Gen"}</div>
        ${renderWebContext(message.webContext)}
        <div class="chat-content">${escapeHtml(message.content).replace(/\n/g, "<br>")}</div>
      </div>
    </article>
  `).join("") + (pending ? `
    <article class="chat-message chat-message-assistant">
      <div class="chat-avatar">TG</div>
      <div class="chat-bubble">
        <div class="chat-role">Token Gen</div>
        <div class="chat-content"><span class="chat-typing">Thinking</span></div>
      </div>
    </article>
  ` : "");
  els.thread.scrollTop = els.thread.scrollHeight;
}

function renderWebContext(context) {
  if (!context) return "";
  const sources = Array.isArray(context.sources) ? context.sources.slice(0, 6) : [];
  return `
    <section class="chat-web-context">
      <div class="chat-web-context-head">
        <span>Web context</span>
        <span class="chat-web-mode">${escapeHtml(context.fetch_mode || context.fetchMode || "web")}</span>
      </div>
      ${context.query ? `<p class="chat-web-query">Query: ${escapeHtml(context.query)}</p>` : ""}
      ${sources.length ? `
        <div class="chat-web-sources">
          ${sources.map((source) => `
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
              <strong>[${escapeHtml(source.index)}] ${escapeHtml(source.title || "Untitled")}</strong>
              <span>${escapeHtml(source.fetched ? source.extraction_method || "fetched" : "snippet only")}</span>
            </a>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function appendAssistantMessage(content = "") {
  messages.push({ role: "assistant", content });
  renderMessages(false);
  return messages.length - 1;
}

function updateAssistantMessage(index, content) {
  messages[index].content = content;
  renderMessages(false);
}

function attachWebContext(index, context) {
  messages[index].webContext = context;
  renderMessages(false);
}

function buildPayload() {
  const system = els.system.value.trim();
  const documentContext = buildDocumentContextMessage();
  const history = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(1)
    .map((message) => ({ role: message.role, content: message.content }));

  return {
    model: els.model.value,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...(documentContext ? [documentContext] : []),
      ...history,
    ],
    temperature: Number(els.temperature.value || 0.3),
    max_tokens: Number(els.maxTokens.value || 20000),
    enable_thinking: els.reasoning.checked,
    web_search: {
      enabled: Boolean(els.webSearch.checked),
      fetch_mode: els.webFetchMode.value,
      max_results: Number(els.webResults.value || 5),
      context_token_budget: Number(els.webBudget.value || 10000),
    },
  };
}

function extractAssistantMessage(data) {
  const message = data?.choices?.[0]?.message || {};
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  if (typeof message.reasoning === "string" && message.reasoning.trim()) return message.reasoning.trim();
  return JSON.stringify(data, null, 2);
}

async function loadModels() {
  const res = await fetch(`${API_BASE}/api/chat/models`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "Could not load models");
  const models = Array.isArray(json.data?.data) ? json.data.data : [];
  availableModels = models;
  els.model.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(modelLabel(model.id))}</option>`).join("");
  if (!models.length) throw new Error("No VLLM models returned");
  const contextWindow = getModelContextWindow(models[0]);
  els.maxTokens.max = String(contextWindow);
  setStatus(`Connected to ${modelLabel(models[0].id)}`, "good");
  renderDocuments();
}

async function loadWebSearchCapability() {
  try {
    const res = await fetch(`${API_BASE}/api/web-search/health`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    const health = json.data || json;
    webSearchSupported = Boolean(res.ok && json.ok !== false && health.tavily_configured);
    if (webSearchSupported) {
      els.webStatus.textContent = "Tavily context is available. Tavily receives the query; destination pages use the selected fetch mode.";
      els.webStatus.dataset.state = "good";
      els.webSearch.disabled = false;
      return;
    }
    if (res.ok && health.tavily_configured === false) {
      els.webStatus.textContent = "Web context service is online, but TAVILY_API_KEY is not configured yet.";
      els.webStatus.dataset.state = "bad";
      els.webSearch.checked = false;
      els.webSearch.disabled = true;
      return;
    }
    throw new Error(json.error || "Web-search API is not available yet.");
  } catch (error) {
    webSearchSupported = false;
    els.webSearch.checked = false;
    els.webSearch.disabled = true;
    els.webStatus.textContent = "Web context needs a Token Gen API update before it can run.";
    els.webStatus.dataset.state = "bad";
  }
}

async function sendMessage(content) {
  if (documentTokenTotal() > getDocumentBudgetTokens()) {
    setStatus("Document context is over budget", "bad");
    return;
  }
  messages.push({ role: "user", content });
  renderMessages(true);
  els.send.disabled = true;
  els.input.disabled = true;
  setStatus(els.webSearch.checked ? "Gathering web context..." : "Generating response...", "busy");

  try {
    if (els.webSearch.checked && !webSearchSupported) {
      throw new Error("Web context is enabled, but Tavily web context is not available yet.");
    }

    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(text || "Chat stream request failed");
    }

    const assistantIndex = appendAssistantMessage("");
    let assistantText = "";
    let buffer = "";
    const decoder = new TextDecoder();
    const reader = res.body.getReader();

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
        if (chunk.error) throw new Error(chunk.error);
        const webContext = chunk.web_context || chunk.webContext || (chunk.type === "web_context" ? chunk.data : null);
        if (webContext) {
          attachWebContext(assistantIndex, webContext);
          setStatus("Web context attached; generating response...", "busy");
          continue;
        }
        const delta = chunk.choices?.[0]?.delta || {};
        const token = delta.content || delta.reasoning_content || delta.reasoning || "";
        if (token) {
          assistantText += token;
          updateAssistantMessage(assistantIndex, assistantText);
        }
      }
    }

    if (!assistantText.trim()) {
      updateAssistantMessage(assistantIndex, "The model returned an empty response.");
    }
    setStatus(`Response complete at ${new Date().toLocaleTimeString("en-AU")}`, "good");
  } catch (error) {
    messages.push({ role: "assistant", content: `Request failed: ${error.message}` });
    setStatus("Chat request failed", "bad");
  } finally {
    els.send.disabled = false;
    els.input.disabled = false;
    els.input.focus();
    renderMessages(false);
  }
}

function autosizeInput() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(180, els.input.scrollHeight)}px`;
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = els.input.value.trim();
  if (!content || els.send.disabled) return;
  els.input.value = "";
  autosizeInput();
  sendMessage(content);
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});

els.input.addEventListener("input", autosizeInput);

els.model.addEventListener("change", () => {
  els.maxTokens.max = String(getModelContextWindow());
  renderDocuments();
});

els.docBudget.addEventListener("input", renderDocuments);

els.documents.addEventListener("change", async () => {
  const files = Array.from(els.documents.files || []);
  if (!files.length) return;
  els.documents.disabled = true;
  setStatus(`Reading ${files.length} document${files.length === 1 ? "" : "s"}...`, "busy");
  try {
    const nextDocuments = [...uploadedDocuments];
    for (const file of files) {
      const doc = await extractDocument(file);
      const totalIfAdded = documentTokenTotal(nextDocuments) + doc.tokens;
      if (totalIfAdded > getDocumentBudgetTokens()) {
        throw new Error(`${file.name} would exceed the document context budget.`);
      }
      nextDocuments.push(doc);
    }
    uploadedDocuments = nextDocuments;
    renderDocuments();
    setStatus(`Attached ${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? "" : "s"}`, "good");
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    els.documents.value = "";
    els.documents.disabled = false;
    renderDocuments();
  }
});

els.docList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-doc-id]");
  if (!button) return;
  uploadedDocuments = uploadedDocuments.filter((doc) => doc.id !== button.dataset.docId);
  renderDocuments();
});

els.docClear.addEventListener("click", () => {
  uploadedDocuments = [];
  renderDocuments();
});

els.clear.addEventListener("click", () => {
  messages = [{ role: "assistant", content: "New chat started." }];
  renderMessages(false);
  els.input.focus();
});

renderMessages(false);
renderDocuments();
loadModels().catch((error) => {
  setStatus(error.message, "bad");
});
loadWebSearchCapability();
