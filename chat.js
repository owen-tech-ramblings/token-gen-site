const API_BASE = "https://token-gen-api.owenonthenet.com";

const $ = (selector) => document.querySelector(selector);
const els = {
  status: $("#chatStatus"),
  mode: $("#chatMode"),
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
  imageSize: $("#chatImageSize"),
  imageQuality: $("#chatImageQuality"),
  imageSamples: $("#chatImageSamples"),
  imageStatus: $("#chatImageStatus"),
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
let imageGenerationSupported = false;
let availableModels = [];
let uploadedDocuments = [];
let mammothLoader = null;
let chatReady = false;
let chatUserIdPromise = null;

const DEFAULT_CONTEXT_WINDOW = 131072;
const TOKEN_CHARS = 4;
const IMAGE_POLL_INTERVAL_MS = 2200;
const IMAGE_POLL_ATTEMPTS = 80;
const IMAGE_QUALITY_SETTINGS = {
  draft: { label: "Draft", steps: 4, cfg: 1.0 },
  standard: { label: "Standard", steps: 9, cfg: 1.0 },
  high: { label: "High", steps: 14, cfg: 1.0 },
};
const IMAGE_INTENT_PATTERN = /\b(create|generate|make|draw|render|paint|illustrate|design)\b[^.?!\n]{0,80}\b(image|picture|photo|illustration|art|poster|logo|scene|wallpaper|avatar)\b|\b(image|picture|photo|illustration|art|poster|logo|scene|wallpaper|avatar)\b[^.?!\n]{0,80}\b(create|generate|make|draw|render|paint|illustrate|design)\b/i;
const DIRECT_IMAGE_COMMAND_PATTERN = /^\s*(draw|paint|illustrate|render)\b/i;
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

function getMode() {
  return els.mode?.value || "chat";
}

function isImageModeForPrompt(prompt) {
  const mode = getMode();
  if (mode === "image") return true;
  if (mode === "chat") return false;
  return IMAGE_INTENT_PATTERN.test(prompt) || DIRECT_IMAGE_COMMAND_PATTERN.test(prompt);
}

function canSendCurrentMode() {
  const mode = getMode();
  if (mode === "image") return imageGenerationSupported;
  if (mode === "auto") return chatReady || imageGenerationSupported;
  return chatReady;
}

function updateSendState() {
  els.send.disabled = !canSendCurrentMode() || documentTokenTotal() > getDocumentBudgetTokens();
}

function setStatus(text, state = "neutral") {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-AU");
}

async function resolveChatUserId() {
  try {
    const res = await fetch("/cdn-cgi/access/get-identity", { cache: "no-store", credentials: "include" });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const email = data.email || data.user_email || data.identity?.email;
      if (email) return String(email).trim();
    }
    throw new Error("Cloudflare Access identity is unavailable for this session.");
  } catch {
    throw new Error("Cloudflare Access identity is unavailable for this session.");
  }
}

function getChatUserId() {
  if (!chatUserIdPromise) chatUserIdPromise = resolveChatUserId();
  return chatUserIdPromise;
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
  updateSendState();
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
        ${renderImageOutputs(message)}
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

function renderImageOutputs(message) {
  const outputs = Array.isArray(message.imageOutputs) ? message.imageOutputs : [];
  if (!outputs.length && !message.imageProgress) return "";
  return `
    <section class="chat-image-results">
      ${message.imagePrompt ? `<p class="chat-image-prompt">${escapeHtml(message.imagePrompt)}</p>` : ""}
      ${outputs.length ? `
        <div class="chat-image-grid">
          ${outputs.map((output, index) => `
            <figure class="chat-image-card">
              <img src="${escapeHtml(output.url)}" alt="${escapeHtml(output.alt || `Generated image sample ${index + 1}`)}" loading="lazy" />
              <figcaption>
                <span>Sample ${index + 1}</span>
                <span>${escapeHtml(output.size || "")}${output.quality ? ` / ${escapeHtml(output.quality)}` : ""}</span>
              </figcaption>
              <div class="chat-image-actions">
                <a class="btn" href="${escapeHtml(output.url)}" download="${escapeHtml(output.filename || `token-gen-image-${index + 1}.png`)}">Download</a>
                <button class="btn" type="button" data-image-iterate="${escapeHtml(output.prompt || message.imagePrompt || "")}">Iterate</button>
              </div>
            </figure>
          `).join("")}
        </div>
      ` : ""}
      ${message.imageProgress ? `<p class="chat-image-progress">${escapeHtml(message.imageProgress)}</p>` : ""}
    </section>
  `;
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

function updateAssistantImageMessage(index, updates) {
  messages[index] = { ...messages[index], ...updates };
  renderMessages(false);
}

function attachWebContext(index, context) {
  messages[index].webContext = context;
  renderMessages(false);
}

function buildPayload(userId) {
  const system = els.system.value.trim();
  const documentContext = buildDocumentContextMessage();
  const systemParts = [
    ...(system ? [system] : []),
    ...(documentContext?.content ? [documentContext.content] : []),
  ];
  const history = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(1)
    .map((message) => ({ role: message.role, content: message.content }));

  return {
    model: els.model.value,
    messages: [
      ...(systemParts.length ? [{ role: "system", content: systemParts.join("\n\n") }] : []),
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
    metadata: {
      source: "token_gen_chat",
      user_id: userId,
    },
  };
}

function extractAssistantMessage(data) {
  const message = data?.choices?.[0]?.message || {};
  if (typeof message.content === "string" && message.content.trim()) return message.content.trim();
  if (typeof message.reasoning === "string" && message.reasoning.trim()) return message.reasoning.trim();
  return JSON.stringify(data, null, 2);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } finally {
    clearTimeout(timeout);
  }
}

function disableChat(reason = "Token Gen API model discovery failed") {
  chatReady = false;
  availableModels = [];
  els.model.innerHTML = `<option value="">API unavailable</option>`;
  els.maxTokens.max = String(DEFAULT_CONTEXT_WINDOW);
  els.input.disabled = true;
  els.send.disabled = true;
  setStatus(reason, "bad");
  renderDocuments();
}

async function loadModels() {
  let res;
  let json;
  try {
    ({ res, json } = await fetchJsonWithTimeout(`${API_BASE}/api/chat/models`, { cache: "no-store" }));
  } catch (error) {
    disableChat(error.name === "AbortError" ? "Token Gen API model discovery timed out" : `Token Gen API model discovery failed: ${error.message}`);
    return;
  }
  if (!res.ok || !json.ok) {
    disableChat(json.error || `Token Gen API model discovery failed: HTTP ${res.status}`);
    return;
  }
  const models = Array.isArray(json.data?.data) ? json.data.data : [];
  if (!models.length) {
    disableChat("Token Gen API model discovery returned no models");
    return;
  }
  availableModels = models;
  els.model.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(modelLabel(model.id))}</option>`).join("");
  const contextWindow = getModelContextWindow(models[0]);
  els.maxTokens.max = String(contextWindow);
  els.input.disabled = false;
  chatReady = true;
  setStatus(`Connected to ${modelLabel(models[0].id)}`, "good");
  renderDocuments();
}

async function loadImageCapability() {
  try {
    const res = await fetch(`${API_BASE}/api/image/health`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    imageGenerationSupported = Boolean(res.ok && json.ok !== false && json.available !== false);
    if (imageGenerationSupported) {
      els.imageStatus.textContent = "Image generation is available.";
      els.imageStatus.dataset.state = "good";
      updateSendState();
      return;
    }
    throw new Error(json.error || "Image service is not available.");
  } catch {
    imageGenerationSupported = false;
    els.imageStatus.textContent = "Image generation is unavailable.";
    els.imageStatus.dataset.state = "bad";
    if (getMode() === "image") setStatus("Image generation is unavailable", "bad");
    updateSendState();
  }
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
    els.webStatus.textContent = "Web context service is not configured or unavailable.";
    els.webStatus.dataset.state = "bad";
  }
}

async function sendMessage(content) {
  if (!chatReady) {
    setStatus("Token Gen API model discovery is unavailable", "bad");
    return;
  }
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
    const chatUserId = await getChatUserId();
    if (els.webSearch.checked && !webSearchSupported) {
      throw new Error("Web context is enabled, but Tavily web context is not available yet.");
    }

    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-token-gen-user": chatUserId,
        "x-token-gen-user-source": "cloudflare-access",
      },
      body: JSON.stringify(buildPayload(chatUserId)),
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
    updateSendState();
    els.input.disabled = !chatReady;
    els.input.focus();
    renderMessages(false);
  }
}

function imageSettings() {
  const size = clampNumber(els.imageSize.value, 1024, 512, 1024);
  const samples = Math.round(clampNumber(els.imageSamples.value, 1, 1, 4));
  const quality = IMAGE_QUALITY_SETTINGS[els.imageQuality.value] || IMAGE_QUALITY_SETTINGS.standard;
  return {
    size,
    samples,
    qualityKey: els.imageQuality.value,
    qualityLabel: quality.label,
    steps: quality.steps,
    cfg: quality.cfg,
  };
}

function buildImagePayload(prompt, settings, sampleIndex) {
  return {
    prompt,
    negative_prompt: "text, watermark, signature, blurry, distorted hands, low quality",
    width: settings.size,
    height: settings.size,
    steps: settings.steps,
    cfg: settings.cfg,
    seed: Date.now() + sampleIndex,
    n: 1,
    filename_prefix: "token_gen_chat",
  };
}

async function submitImageGeneration(prompt, settings, sampleIndex) {
  const res = await fetch(`${API_BASE}/api/image/generations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildImagePayload(prompt, settings, sampleIndex)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false || !json.prompt_id) {
    throw new Error(json.error || json.message || `Image generation failed: HTTP ${res.status}`);
  }
  return json.prompt_id;
}

async function pollImageGeneration(promptId) {
  for (let attempt = 0; attempt < IMAGE_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, IMAGE_POLL_INTERVAL_MS));
    const res = await fetch(`${API_BASE}/api/image/history/${encodeURIComponent(promptId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || json.message || `Image history failed: HTTP ${res.status}`);
    }
    if (Array.isArray(json.outputs) && json.outputs.length) return json.outputs;
    if (json.status === "failed" || json.status === "error") {
      throw new Error("Image generation failed.");
    }
  }
  throw new Error("Image generation timed out.");
}

async function generateImageSamplesSequentially(prompt, assistantIndex) {
  const settings = imageSettings();
  const outputs = [];
  for (let index = 0; index < settings.samples; index += 1) {
    const label = `sample ${index + 1} of ${settings.samples}`;
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Generating ${label}...`,
      content: outputs.length ? "Still generating the remaining samples." : "",
    });
    setStatus(`Generating image ${index + 1} of ${settings.samples}...`, "busy");
    const promptId = await submitImageGeneration(prompt, settings, index);
    updateAssistantImageMessage(assistantIndex, { imageProgress: `Rendering ${label}...` });
    const sampleOutputs = await pollImageGeneration(promptId);
    for (const output of sampleOutputs) {
      outputs.push({
        ...output,
        prompt,
        quality: settings.qualityLabel,
        size: `${settings.size} x ${settings.size}`,
        alt: prompt,
        url: output.url?.startsWith("http") ? output.url : `${API_BASE}${output.url || ""}`,
      });
    }
    updateAssistantImageMessage(assistantIndex, {
      imageOutputs: [...outputs],
      imageProgress: index + 1 < settings.samples ? `Completed ${label}. Starting next sample...` : "",
      content: index + 1 < settings.samples ? "Choose any completed sample, or wait for the rest." : "Image generation complete.",
    });
  }
}

async function sendImageMessage(content) {
  if (!imageGenerationSupported) {
    setStatus("Image generation is unavailable", "bad");
    return;
  }
  messages.push({ role: "user", content });
  const assistantIndex = appendAssistantMessage("");
  updateAssistantImageMessage(assistantIndex, {
    imagePrompt: content,
    imageOutputs: [],
    imageProgress: "Preparing image generation...",
  });
  els.send.disabled = true;
  els.input.disabled = true;

  try {
    await generateImageSamplesSequentially(content, assistantIndex);
    setStatus(`Image generation complete at ${new Date().toLocaleTimeString("en-AU")}`, "good");
  } catch (error) {
    updateAssistantImageMessage(assistantIndex, {
      content: `Image request failed: ${error.message}`,
      imageProgress: "",
    });
    setStatus("Image request failed", "bad");
  } finally {
    updateSendState();
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
  if (isImageModeForPrompt(content)) {
    sendImageMessage(content);
  } else {
    sendMessage(content);
  }
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

els.mode.addEventListener("change", () => {
  updateSendState();
  if (getMode() === "image" && !imageGenerationSupported) {
    setStatus("Image generation is unavailable", "bad");
  } else if (getMode() === "chat" && chatReady) {
    setStatus(`Connected to ${modelLabel(getSelectedModel().id)}`, "good");
  }
});

els.imageSamples.addEventListener("input", () => {
  els.imageSamples.value = String(Math.round(clampNumber(els.imageSamples.value, 1, 1, 4)));
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

els.thread.addEventListener("click", (event) => {
  const button = event.target.closest("[data-image-iterate]");
  if (!button) return;
  const prompt = button.dataset.imageIterate || "";
  els.mode.value = "image";
  els.input.value = `Create a variation of this image: ${prompt}`;
  autosizeInput();
  updateSendState();
  els.input.focus();
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
loadImageCapability();
