const API_BASE = "https://token-gen-api.owenonthenet.com";

const $ = (selector) => document.querySelector(selector);
const els = {
  status: $("#chatStatus"),
  model: $("#chatModel"),
  system: $("#chatSystem"),
  temperature: $("#chatTemperature"),
  maxTokens: $("#chatMaxTokens"),
  reasoning: $("#chatReasoning"),
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

function setStatus(text, state = "neutral") {
  els.status.textContent = text;
  els.status.dataset.state = state;
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
  const history = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(1)
    .map((message) => ({ role: message.role, content: message.content }));

  return {
    model: els.model.value,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...history,
    ],
    temperature: Number(els.temperature.value || 0.3),
    max_tokens: Number(els.maxTokens.value || 768),
    enable_thinking: els.reasoning.checked,
    web_search: {
      enabled: Boolean(els.webSearch.checked),
      fetch_mode: els.webFetchMode.value,
      max_results: Number(els.webResults.value || 5),
      context_token_budget: Number(els.webBudget.value || 2500),
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
  els.model.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(modelLabel(model.id))}</option>`).join("");
  if (!models.length) throw new Error("No VLLM models returned");
  setStatus(`Connected to ${modelLabel(models[0].id)}`, "good");
}

async function loadWebSearchCapability() {
  try {
    const res = await fetch(`${API_BASE}/api/web-search/health`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    webSearchSupported = Boolean(res.ok && json.ok !== false);
    if (webSearchSupported) {
      els.webStatus.textContent = "Brave context is available. Brave receives the query; destination pages use the selected fetch mode.";
      els.webStatus.dataset.state = "good";
      els.webSearch.disabled = false;
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
  messages.push({ role: "user", content });
  renderMessages(true);
  els.send.disabled = true;
  els.input.disabled = true;
  setStatus(els.webSearch.checked ? "Gathering web context..." : "Generating response...", "busy");

  try {
    if (els.webSearch.checked && !webSearchSupported) {
      throw new Error("Web context is enabled, but the Token Gen API does not expose /api/web-search/health yet.");
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

els.clear.addEventListener("click", () => {
  messages = [{ role: "assistant", content: "New chat started." }];
  renderMessages(false);
  els.input.focus();
});

renderMessages(false);
loadModels().catch((error) => {
  setStatus(error.message, "bad");
});
loadWebSearchCapability();
