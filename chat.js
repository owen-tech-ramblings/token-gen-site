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
  imageSourceMode: $("#chatImageSourceMode"),
  imageSize: $("#chatImageSize"),
  imageQuality: $("#chatImageQuality"),
  imageSamples: $("#chatImageSamples"),
  imageStyle: $("#chatImageStyle"),
  imageOrientation: $("#chatImageOrientation"),
  imageContentFilter: $("#chatImageContentFilter"),
  imageUpload: $("#chatImageUpload"),
  imageSourcePreview: $("#chatImageSourcePreview"),
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
let activeImageSource = null;
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
const IMAGE_STYLE_PROMPTS = {
  none: "",
  photorealistic: "Render in a photorealistic style with natural lighting, realistic materials, and believable detail.",
  pencil: "Render as a pencil drawing with visible graphite linework, sketch texture, and tonal shading.",
  "van-gogh": "Render in a Van Gogh-inspired post-impressionist style with expressive brushwork, swirling movement, and rich color.",
  comic: "Render as comic art with bold inking, crisp shapes, dynamic contrast, and graphic color.",
  manga: "Render as manga art with clean linework, expressive composition, and polished screen-tone style shading.",
  futuristic: "Render with a futuristic science-fiction aesthetic, advanced materials, sleek lighting, and high-tech visual language.",
};
const IMAGE_STYLE_LABELS = {
  none: "No style",
  photorealistic: "Photorealistic",
  pencil: "Pencil drawing",
  "van-gogh": "Van Gogh",
  comic: "Comic",
  manga: "Manga",
  futuristic: "Futuristic",
};
const IMAGE_CONTENT_FILTER_PROMPTS = {
  kid: "Content filter: kid friendly, safe for children, no adult themes, no graphic violence.",
  normal: "Content filter: normal general-audience output, avoid explicit or graphic content.",
  adult: "Content filter: adult 18+ themes are acceptable when requested, while avoiding illegal, abusive, or non-consensual sexual content.",
};
const IMAGE_CONTENT_FILTER_LABELS = {
  kid: "Kid friendly",
  normal: "Normal",
  adult: "Adult 18+ ok",
};
const IMAGE_ORIENTATION_LABELS = {
  square: "Square",
  portrait: "Portrait",
  landscape: "Landscape",
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

function absoluteImageUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}

function outputImageReference(output) {
  const filename = output?.filename || output?.image?.filename;
  if (!filename) return null;
  return {
    filename,
    subfolder: output?.subfolder || output?.image?.subfolder || "",
    type: output?.type || output?.image?.type || "output",
  };
}

function imageDimensions() {
  const size = clampNumber(els.imageSize.value, 1024, 512, 1024);
  const shortSide = Math.max(384, Math.round(size * 0.75));
  if (els.imageOrientation.value === "portrait") return { width: shortSide, height: size };
  if (els.imageOrientation.value === "landscape") return { width: size, height: shortSide };
  return { width: size, height: size };
}

function buildStyledImagePrompt(prompt, sourceMode = els.imageSourceMode.value) {
  const style = IMAGE_STYLE_PROMPTS[els.imageStyle.value] || "";
  const orientation = IMAGE_ORIENTATION_LABELS[els.imageOrientation.value] || "Square";
  const contentFilter = IMAGE_CONTENT_FILTER_PROMPTS[els.imageContentFilter.value] || IMAGE_CONTENT_FILTER_PROMPTS.normal;
  const modeInstruction = sourceMode === "edit"
    ? "Use the provided source image as the base image and apply the requested changes while preserving unrelated details."
    : sourceMode === "style"
      ? "Use the provided source image as a style reference only. Create a new image matching its visual style, palette, texture, lighting, and mood without copying the exact composition."
      : "Create a new image from the request.";
  return [
    prompt,
    "",
    modeInstruction,
    `Orientation: ${orientation}.`,
    style,
    contentFilter,
  ].filter(Boolean).join("\n");
}

function setActiveImageSource(source) {
  activeImageSource = source;
  renderImageSourcePreview();
}

function clearActiveImageSource() {
  activeImageSource = null;
  renderImageSourcePreview();
}

function renderImageSourcePreview() {
  if (!els.imageSourcePreview) return;
  if (!activeImageSource) {
    els.imageSourcePreview.innerHTML = `<p class="chat-web-note">No source image selected.</p>`;
    return;
  }
  const src = activeImageSource.previewUrl || activeImageSource.url || "";
  els.imageSourcePreview.innerHTML = `
    <div class="chat-image-source-card">
      ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(activeImageSource.name || "Selected source image")}" />` : ""}
      <div>
        <strong>${escapeHtml(activeImageSource.name || "Source image")}</strong>
        <span>${escapeHtml(activeImageSource.kind === "url" ? "Generated image" : "Uploaded image")}</span>
      </div>
      <button class="chat-doc-remove" type="button" data-image-source-clear aria-label="Clear source image">x</button>
    </div>
  `;
}

function readUploadedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/png", "image/jpeg"].includes(file.type)) {
      reject(new Error("Upload a PNG or JPG image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      if (!base64) {
        reject(new Error("Could not read the uploaded image."));
        return;
      }
      resolve({
        kind: "base64",
        name: file.name,
        mimeType: file.type,
        image_base64: base64,
        previewUrl: dataUrl,
      });
    };
    reader.onerror = () => reject(new Error("Could not read the uploaded image."));
    reader.readAsDataURL(file);
  });
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
                <button
                  class="btn"
                  type="button"
                  data-image-iterate="${escapeHtml(output.prompt || message.imagePrompt || "")}"
                  data-image-url="${escapeHtml(output.url || "")}"
                  data-image-filename="${escapeHtml(output.filename || `Sample ${index + 1}`)}"
                  data-image-subfolder="${escapeHtml(output.subfolder || "")}"
                  data-image-type="${escapeHtml(output.type || "output")}"
                >Iterate</button>
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
  const dimensions = imageDimensions();
  const samples = Math.round(clampNumber(els.imageSamples.value, 1, 1, 4));
  const quality = IMAGE_QUALITY_SETTINGS[els.imageQuality.value] || IMAGE_QUALITY_SETTINGS.standard;
  return {
    ...dimensions,
    samples,
    qualityKey: els.imageQuality.value,
    qualityLabel: quality.label,
    styleLabel: IMAGE_STYLE_LABELS[els.imageStyle.value] || "No style",
    orientationLabel: IMAGE_ORIENTATION_LABELS[els.imageOrientation.value] || "Square",
    contentFilterLabel: IMAGE_CONTENT_FILTER_LABELS[els.imageContentFilter.value] || "Normal",
    steps: quality.steps,
    cfg: quality.cfg,
  };
}

function imageSummary(settings) {
  return `${settings.width} x ${settings.height} / ${settings.qualityLabel} / ${settings.orientationLabel}`;
}

function buildImagePayload(prompt, settings, sampleIndex) {
  return {
    prompt: buildStyledImagePrompt(prompt, "new"),
    negative_prompt: "text, watermark, signature, blurry, distorted hands, low quality",
    width: settings.width,
    height: settings.height,
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

function buildImageEditPayload(prompt, settings, sampleIndex, source, sourceMode) {
  if (!source) throw new Error("Select or upload a source image first.");
  const payload = {
    prompt: buildStyledImagePrompt(prompt, sourceMode),
    negative_prompt: "text, watermark, signature, blurry, distorted hands, low quality",
    strength: sourceMode === "style" ? 0.72 : 0.45,
    denoise: sourceMode === "style" ? 0.72 : 0.45,
    steps: settings.steps,
    cfg: settings.cfg,
    seed: Date.now() + sampleIndex,
    filename_prefix: "token_gen_chat_edit",
  };
  if (source.kind === "url") {
    if (source.image) payload.image = source.image;
    else payload.image_url = source.url;
  } else {
    payload.image_base64 = source.image_base64;
    payload.image = {
      filename: source.name,
      mime_type: source.mimeType,
    };
  }
  return payload;
}

async function submitImageEdit(prompt, settings, sampleIndex, source, sourceMode) {
  const res = await fetch(`${API_BASE}/api/image/edits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildImageEditPayload(prompt, settings, sampleIndex, source, sourceMode)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false || !json.prompt_id) {
    throw new Error(json.error || json.message || `Image edit failed: HTTP ${res.status}`);
  }
  return json.prompt_id;
}

function historyExecutionError(json) {
  const records = json?.data && typeof json.data === "object" ? Object.values(json.data) : [];
  for (const record of records) {
    const status = record?.status || {};
    const statusString = status.status_str || record?.status_str || "";
    const messages = Array.isArray(status.messages) ? status.messages : [];
    const executionError = messages
      .map((entry) => Array.isArray(entry) ? entry[1] : null)
      .find((entry) => entry?.exception_message || entry?.exception_type);
    if (statusString === "error" || executionError) {
      const type = executionError?.exception_type ? `${executionError.exception_type}: ` : "";
      return `${type}${executionError?.exception_message || "Image generation failed in ComfyUI."}`.trim();
    }
  }
  return "";
}

async function pollImageGeneration(promptId) {
  for (let attempt = 0; attempt < IMAGE_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, IMAGE_POLL_INTERVAL_MS));
    const res = await fetch(`${API_BASE}/api/image/history/${encodeURIComponent(promptId)}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || json.message || `Image history failed: HTTP ${res.status}`);
    }
    const nestedError = historyExecutionError(json);
    if (nestedError) throw new Error(nestedError);
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
      const imageRef = outputImageReference(output);
      outputs.push({
        ...output,
        ...(imageRef || {}),
        prompt,
        quality: settings.qualityLabel,
        size: imageSummary(settings),
        alt: prompt,
        url: absoluteImageUrl(output.url),
      });
    }
    updateAssistantImageMessage(assistantIndex, {
      imageOutputs: [...outputs],
      imageProgress: index + 1 < settings.samples ? `Completed ${label}. Starting next sample...` : "",
      content: index + 1 < settings.samples ? "Choose any completed sample, or wait for the rest." : "Image generation complete.",
    });
  }
}

async function generateImageEditSamplesSequentially(prompt, assistantIndex, sourceMode) {
  const settings = imageSettings();
  const source = activeImageSource;
  const outputs = [];
  for (let index = 0; index < settings.samples; index += 1) {
    const label = `sample ${index + 1} of ${settings.samples}`;
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `${sourceMode === "style" ? "Using source style for" : "Editing"} ${label}...`,
      content: outputs.length ? "Still generating the remaining samples." : "",
    });
    setStatus(`${sourceMode === "style" ? "Generating style reference image" : "Editing image"} ${index + 1} of ${settings.samples}...`, "busy");
    const promptId = await submitImageEdit(prompt, settings, index, source, sourceMode);
    updateAssistantImageMessage(assistantIndex, { imageProgress: `Rendering ${label}...` });
    const sampleOutputs = await pollImageGeneration(promptId);
    for (const output of sampleOutputs) {
      const imageRef = outputImageReference(output);
      outputs.push({
        ...output,
        ...(imageRef || {}),
        prompt,
        quality: settings.qualityLabel,
        size: imageSummary(settings),
        alt: prompt,
        url: absoluteImageUrl(output.url),
      });
    }
    updateAssistantImageMessage(assistantIndex, {
      imageOutputs: [...outputs],
      imageProgress: index + 1 < settings.samples ? `Completed ${label}. Starting next sample...` : "",
      content: index + 1 < settings.samples ? "Choose any completed sample, or wait for the rest." : "Image edit complete.",
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
    const sourceMode = els.imageSourceMode.value;
    if (sourceMode === "edit" || sourceMode === "style") {
      if (!activeImageSource) {
        throw new Error(sourceMode === "style"
          ? "Upload an image to use as the style reference."
          : "Upload an image or choose Iterate on a generated image first.");
      }
      await generateImageEditSamplesSequentially(content, assistantIndex, sourceMode);
    } else {
      await generateImageSamplesSequentially(content, assistantIndex);
    }
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

els.imageSourceMode.addEventListener("change", () => {
  if (els.imageSourceMode.value !== "new" && !activeImageSource) {
    setStatus(els.imageSourceMode.value === "style" ? "Upload a style reference image" : "Upload an image or choose Iterate on a generated image", "busy");
  }
  renderImageSourcePreview();
});

els.imageSamples.addEventListener("input", () => {
  els.imageSamples.value = String(Math.round(clampNumber(els.imageSamples.value, 1, 1, 4)));
});

els.imageUpload.addEventListener("change", async () => {
  const file = els.imageUpload.files?.[0];
  if (!file) return;
  els.imageUpload.disabled = true;
  setStatus(`Reading ${file.name}...`, "busy");
  try {
    const source = await readUploadedImage(file);
    setActiveImageSource(source);
    els.mode.value = "image";
    if (els.imageSourceMode.value === "new") els.imageSourceMode.value = "edit";
    setStatus(`${file.name} ready for image edits`, "good");
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    els.imageUpload.value = "";
    els.imageUpload.disabled = false;
    updateSendState();
  }
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
  const url = button.dataset.imageUrl || "";
  const image = button.dataset.imageFilename ? {
    filename: button.dataset.imageFilename,
    subfolder: button.dataset.imageSubfolder || "",
    type: button.dataset.imageType || "output",
  } : null;
  setActiveImageSource({
    kind: "url",
    name: image?.filename || "Generated image",
    prompt,
    previewUrl: url,
    url,
    image,
  });
  els.mode.value = "image";
  els.imageSourceMode.value = "edit";
  els.input.value = `Create a variation of this image: ${prompt}`;
  autosizeInput();
  updateSendState();
  els.input.focus();
});

els.imageSourcePreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-image-source-clear]");
  if (!button) return;
  clearActiveImageSource();
  if (els.imageSourceMode.value !== "new") els.imageSourceMode.value = "new";
  updateSendState();
});

els.clear.addEventListener("click", () => {
  messages = [{ role: "assistant", content: "New chat started." }];
  renderMessages(false);
  els.input.focus();
});

renderMessages(false);
renderDocuments();
renderImageSourcePreview();
loadModels().catch((error) => {
  setStatus(error.message, "bad");
});
loadWebSearchCapability();
loadImageCapability();
