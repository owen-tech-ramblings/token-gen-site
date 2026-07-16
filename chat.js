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
  visionImages: $("#chatVisionImages"),
  visionPreview: $("#chatVisionPreview"),
  visionStatus: $("#chatVisionStatus"),
  docBudget: $("#chatDocBudget"),
  docStatus: $("#chatDocStatus"),
  docMeter: $("#chatDocMeter"),
  docList: $("#chatDocList"),
  docClear: $("#chatDocClear"),
  webSearch: $("#chatWebSearch"),
  webApiKey: $("#chatWebApiKey"),
  webFetchMode: $("#chatWebFetchMode"),
  webResults: $("#chatWebResults"),
  webBudget: $("#chatWebBudget"),
  webStatus: $("#chatWebStatus"),
  imageSourceMode: $("#chatImageSourceMode"),
  imageSize: $("#chatImageSize"),
  imageQuality: $("#chatImageQuality"),
  imageSamples: $("#chatImageSamples"),
  imageStyle: $("#chatImageStyle"),
  imageCreativity: $("#chatImageCreativity"),
  imageOrientation: $("#chatImageOrientation"),
  imageContentFilter: $("#chatImageContentFilter"),
  imageEditPreservation: $("#chatImageEditPreservation"),
  imageEditStrength: $("#chatImageEditStrength"),
  imageEditStrengthValue: $("#chatImageEditStrengthValue"),
  imageSampler: $("#chatImageSampler"),
  imageScheduler: $("#chatImageScheduler"),
  imageUpscaleScale: $("#chatImageUpscaleScale"),
  imageUpscaleMethod: $("#chatImageUpscaleMethod"),
  documentsButton: $("#chatDocumentsButton"),
  imageUploadButton: $("#chatImageUploadButton"),
  imageMaskUploadButton: $("#chatImageMaskUploadButton"),
  imageUpload: $("#chatImageUpload"),
  imageMaskUpload: $("#chatImageMaskUpload"),
  imageSourcePreview: $("#chatImageSourcePreview"),
  imageMaskPreview: $("#chatImageMaskPreview"),
  imageStatus: $("#chatImageStatus"),
  clear: $("#chatClear"),
  thread: $("#chatThread"),
  form: $("#chatForm"),
  input: $("#chatInput"),
  send: $("#chatSend"),
  activeModel: $("#chatActiveModel"),
  runtimeDot: $("#chatRuntimeDot"),
  modeButtons: Array.from(document.querySelectorAll("[data-chat-mode]")),
  modeHint: $("#chatModeHint"),
  settingsOpen: $("#chatSettingsOpen"),
  settingsClose: $("#chatSettingsClose"),
  settingsDrawer: $("#chatSettingsDrawer"),
  settingsBackdrop: $("#chatSettingsBackdrop"),
  rail: $("#chatRail"),
  railOpen: $("#chatRailOpen"),
  railClose: $("#chatRailClose"),
  attachMenu: $("#chatAttachMenu"),
  attachDocument: $("#chatAttachDocument"),
  attachImage: $("#chatAttachImage"),
  attachMask: $("#chatAttachMask"),
  webQuickToggle: $("#chatWebQuickToggle"),
  docBudgetValue: $("#chatDocBudgetValue"),
  historyList: $("#chatHistoryList"),
  historyCount: $("#chatHistoryCount"),
  historyStatus: $("#chatHistoryStatus"),
  historyRetention: $("#chatHistoryRetention"),
  privacyStatus: $("#chatPrivacyStatus"),
  historyExport: $("#chatHistoryExport"),
  historyDelete: $("#chatHistoryDelete"),
  projectSelect: $("#chatProjectSelect"),
  projectRailStatus: $("#chatProjectRailStatus"),
  projectManage: $("#chatProjectManage"),
  projectSettings: $("#chatProjectSettings"),
  projectSettingsSelect: $("#chatProjectSettingsSelect"),
  projectCreateName: $("#chatProjectCreateName"),
  projectCreate: $("#chatProjectCreate"),
  projectEditor: $("#chatProjectEditor"),
  projectName: $("#chatProjectName"),
  projectInstructions: $("#chatProjectInstructions"),
  projectSave: $("#chatProjectSave"),
  projectDelete: $("#chatProjectDelete"),
  projectUpload: $("#chatProjectUpload"),
  projectDocuments: $("#chatProjectDocuments"),
  projectDocumentList: $("#chatProjectDocumentList"),
  projectDocumentCount: $("#chatProjectDocumentCount"),
  projectStatus: $("#chatProjectStatus"),
  attachProjectDocument: $("#chatAttachProjectDocument"),
  attachProjectHint: $("#chatAttachProjectHint"),
  jobsOpen: $("#chatJobsOpen"),
  jobsClose: $("#chatJobsClose"),
  jobsRefresh: $("#chatJobsRefresh"),
  jobsDrawer: $("#chatJobsDrawer"),
  jobsBackdrop: $("#chatJobsBackdrop"),
  jobsBadge: $("#chatJobsBadge"),
  jobsStatus: $("#chatJobsStatus"),
  jobsList: $("#chatJobsList"),
};

function welcomeMessage() {
  return { role: "assistant", content: "", isWelcome: true };
}

function createMessage(role, content, extra = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

let messages = [welcomeMessage()];
let webSearchSupported = false;
let imageGenerationSupported = false;
let visionSupported = false;
let visionCapabilities = {};
let availableModels = [];
let uploadedDocuments = [];
let attachedVisionImages = [];
let activeImageSource = null;
let activeImageMask = null;
let activeImageAbortController = null;
let mammothLoader = null;
let chatReady = false;
let chatUserIdPromise = null;
let historyState = {
  available: false,
  loading: true,
  conversations: [],
  currentId: null,
  currentVersion: null,
  defaultRetention: "30_days",
  currentRetention: "30_days",
  saveTimer: null,
  saving: false,
  saveQueued: false,
};
let projectState = {
  available: false,
  loading: true,
  projects: [],
  activeId: null,
  active: null,
  documents: [],
  etag: null,
  busy: false,
};
let jobState = {
  available: false,
  loading: true,
  loadingRequest: false,
  refreshing: false,
  jobs: [],
  refreshTimer: null,
};

const DEFAULT_CONTEXT_WINDOW = 131072;
const TOKEN_CHARS = 4;
const IMAGE_POLL_INTERVAL_MS = 2200;
const HISTORY_API_PATH = `${API_BASE}/api/conversations`;
const PROJECTS_API_PATH = `${API_BASE}/api/projects`;
const JOBS_API_PATH = `${API_BASE}/api/jobs`;
const HISTORY_SAVE_DELAY_MS = 450;
const JOB_REFRESH_INTERVAL_MS = 2800;
const PROJECT_MAX_FILE_BYTES = 30 * 1024 * 1024;
const DEFAULT_VISION_MAX_IMAGES = 4;
const DEFAULT_VISION_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_VISION_MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const DEFAULT_VISION_MAX_PIXELS = 1280 * 28 * 28;
const IMAGE_QUALITY_SETTINGS = {
  draft: { label: "Draft", steps: 8, cfg: 5.0, prompt: "quick clean preview" },
  standard: { label: "Standard", steps: 20, cfg: 5.0, prompt: "balanced detail and prompt fidelity" },
  high: { label: "High", steps: 35, cfg: 5.0, prompt: "high detail, clean texture, polished rendering" },
  max: { label: "Max", steps: 50, cfg: 5.0, prompt: "maximum detail, refined texture, polished final image" },
};
const IMAGE_STYLE_PROMPTS = {
  none: "",
  photorealistic: "photorealistic, natural lighting, realistic materials, believable detail",
  pencil: "pencil drawing, graphite linework, sketch texture, tonal shading",
  "van-gogh": "Van Gogh inspired post-impressionist painting, expressive brushwork, swirling movement, rich color",
  comic: "comic art, bold inking, crisp shapes, dynamic contrast, graphic color",
  manga: "manga art, clean linework, expressive composition, polished screentone shading",
  futuristic: "futuristic science-fiction aesthetic, advanced materials, sleek lighting, high-tech visual language",
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
  kid: "child-safe content, no adult themes, no graphic violence",
  teen: "teen-appropriate content, no explicit or graphic content",
  standard: "general audience content, no explicit or graphic content",
  adult_ok: "adult themes only if clearly requested, no illegal abusive or non-consensual sexual content",
};
const IMAGE_CONTENT_FILTER_LABELS = {
  kid: "Kid friendly",
  teen: "Teen",
  standard: "Standard",
  adult_ok: "Adult 18+ ok",
};
const IMAGE_CREATIVITY_SETTINGS = {
  "0.25": {
    label: "Conservative",
    value: 0.25,
    prompt: "literal interpretation, no unrequested subjects, outfits, props, scenery, or composition changes",
  },
  "0.50": {
    label: "Balanced",
    value: 0.5,
    prompt: "faithful interpretation with natural visual polish",
  },
  "0.80": {
    label: "Exploratory",
    value: 0.8,
    prompt: "more imaginative interpretation while respecting requested subjects and constraints",
  },
};
const IMAGE_EDIT_PRESERVATION_SETTINGS = {
  strict: {
    label: "Strict",
    value: "strict",
    strength: 0.2,
    prompt: "smallest localized change, source identity clothing pose hands face camera crop lighting and background preserved",
  },
  balanced: {
    label: "Balanced",
    value: "balanced",
    strength: 0.38,
    prompt: "moderate requested edit, no unrelated redesign of people clothing poses relationships objects or composition",
  },
  flexible: {
    label: "Flexible",
    value: "flexible",
    strength: 0.58,
    prompt: "broader requested variation, recognizable source image, no contradiction of the user request",
  },
};
const IMAGE_ORIENTATION_LABELS = {
  square: "Square",
  portrait: "Portrait",
  landscape: "Landscape",
};
const IMAGE_INTENT_PATTERN = /\b(create|generate|make|draw|render|paint|illustrate|design)\b[^.?!\n]{0,80}\b(image|picture|photo|illustration|art|poster|logo|scene|wallpaper|avatar)\b|\b(image|picture|photo|illustration|art|poster|logo|scene|wallpaper|avatar)\b[^.?!\n]{0,80}\b(create|generate|make|draw|render|paint|illustrate|design)\b/i;
const DIRECT_IMAGE_COMMAND_PATTERN = /^\s*(draw|paint|illustrate|render)\b/i;
const IMAGE_EDIT_INTENT_PATTERN = /\b(edit|change|modify|remove|replace|add|restyle|transform|enhance|upscale|improve|retouch|recolour|recolor|make this|turn this)\b/i;
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

function getVisionCapabilities(model = getSelectedModel()) {
  return model.capabilities?.vision || visionCapabilities || {};
}

function getVisionLimits() {
  const capability = getVisionCapabilities();
  return {
    maxImages: Math.max(1, Math.min(4, Number(capability.max_images || DEFAULT_VISION_MAX_IMAGES))),
    maxImageBytes: Number(capability.max_image_bytes || DEFAULT_VISION_MAX_IMAGE_BYTES),
    maxTotalBytes: Number(capability.max_total_bytes || DEFAULT_VISION_MAX_TOTAL_BYTES),
    maxPixels: Number(capability.max_pixels || DEFAULT_VISION_MAX_PIXELS),
  };
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
  if (attachedVisionImages.length && IMAGE_EDIT_INTENT_PATTERN.test(prompt)) return true;
  return IMAGE_INTENT_PATTERN.test(prompt) || DIRECT_IMAGE_COMMAND_PATTERN.test(prompt);
}

function canSendCurrentMode() {
  const mode = getMode();
  if (mode === "image") return imageGenerationSupported;
  if (mode === "auto") return chatReady || imageGenerationSupported;
  return chatReady;
}

function isImageGenerationRunning() {
  return Boolean(activeImageAbortController);
}

function syncModeUI() {
  const mode = getMode();
  els.modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.chatMode === mode));
  });
  document.body.classList.toggle("chat-image-active", mode === "image" || Boolean(activeImageSource));
  if (els.modeHint) {
    els.modeHint.textContent = mode === "auto"
      ? "Auto chooses chat or image from your request"
      : mode === "image"
        ? "Create, edit, restyle, or enhance an image"
        : "Answer with the active local language model";
  }
}

function syncWebUI() {
  if (!els.webQuickToggle) return;
  const enabled = Boolean(els.webSearch.checked);
  els.webQuickToggle.setAttribute("aria-pressed", String(enabled));
  els.webQuickToggle.disabled = els.webSearch.disabled;
  els.webQuickToggle.title = enabled ? "Web context is on" : "Use current web information";
}

function syncVisionCapability() {
  const capability = getVisionCapabilities();
  visionSupported = Boolean(capability.available);
  if (els.visionStatus) {
    els.visionStatus.textContent = visionSupported
      ? `Image understanding runs locally with up to ${getVisionLimits().maxImages} images per message.`
      : capability.model_supports_vision
        ? "This model supports images, but the current vLLM launch has vision disabled."
        : "The active language model does not advertise image understanding.";
    els.visionStatus.dataset.state = visionSupported ? "good" : "neutral";
  }
  renderVisionPreview();
}

function setAttachMenu(open) {
  if (!els.attachMenu) return;
  els.attachMenu.hidden = !open;
  els.documentsButton.setAttribute("aria-expanded", String(open));
}

function setSettingsOpen(open) {
  if (open) setJobsOpen(false);
  els.settingsDrawer?.classList.toggle("is-open", open);
  els.settingsDrawer?.setAttribute("aria-hidden", String(!open));
  if (els.settingsBackdrop) els.settingsBackdrop.hidden = !open;
  document.body.classList.toggle("chat-settings-open", open);
}

function setJobsOpen(open) {
  if (open && els.settingsDrawer?.classList.contains("is-open")) setSettingsOpen(false);
  els.jobsDrawer?.classList.toggle("is-open", open);
  els.jobsDrawer?.setAttribute("aria-hidden", String(!open));
  if (els.jobsBackdrop) els.jobsBackdrop.hidden = !open;
  document.body.classList.toggle("chat-jobs-open", open);
  if (open && jobState.available) refreshActiveJobs({ immediate: true });
}

function setRailOpen(open) {
  els.rail?.classList.toggle("is-open", open);
  document.body.classList.toggle("chat-rail-opened", open);
}

function syncSendButtonState() {
  if (isImageGenerationRunning()) {
    els.send.title = "Stop image generation";
    els.send.setAttribute("aria-label", "Stop image generation");
    els.send.classList.add("chat-stop-button");
    return;
  }
  els.send.title = "Send message";
  els.send.setAttribute("aria-label", "Send message");
  els.send.classList.remove("chat-stop-button");
}

function updateSendState() {
  syncSendButtonState();
  if (isImageGenerationRunning()) {
    els.send.disabled = false;
    return;
  }
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

function imageModeInstruction(sourceMode, settings) {
  if (sourceMode === "edit") {
    return [
      "source image edit",
      `${settings.preservationLabel.toLowerCase()} preservation, ${settings.editStrength.toFixed(2)} change strength`,
      settings.preservationPrompt,
      "unmentioned people identity clothing pose hands expression objects camera crop lighting composition and background preserved",
      "existing relationships and physical interactions preserved unless explicitly changed by the user",
    ].join(", ");
  }
  if (sourceMode === "restyle") {
    return [
      "source image restyle",
      "source composition preserved, visual medium transformed",
      `${settings.editStrength.toFixed(2)} style change strength`,
      settings.preservationPrompt,
      "recognizable subject identity pose hands relationships object layout camera crop and composition preserved",
      "visual medium linework brushwork color texture and rendering technique changed to the selected style",
      "no unrelated objects, clothing replacement, identity change, character change, or scene redesign",
    ].join(", ");
  }
  if (sourceMode === "style") {
    return [
      "source image style reference",
      "borrow palette texture medium lighting and mood only",
      `${settings.editStrength.toFixed(2)} style reference strength`,
      "new composition matching the requested subject, no copied identity or exact composition unless requested",
    ].join(", ");
  }
  if (sourceMode === "upscale") {
    return [
      "source image enhancement",
      "exact source content preserved",
      "no creative redraw redesign restyle clothing replacement identity change hand change pose change relationship change or background change",
      "composition preserved, technical clarity improved",
    ].join(", ");
  }
  return "original generated scene";
}

function buildStyledImagePrompt(prompt, sourceMode = els.imageSourceMode.value, settings = imageSettings()) {
  const style = IMAGE_STYLE_PROMPTS[settings.styleKey] || "";
  const contentFilter = IMAGE_CONTENT_FILTER_PROMPTS[settings.contentFilterKey] || IMAGE_CONTENT_FILTER_PROMPTS.standard;
  return [
    prompt,
    imageModeInstruction(sourceMode, settings),
    `${settings.width} by ${settings.height} ${settings.orientationLabel.toLowerCase()} image`,
    sourceMode === "edit" && activeImageMask
      ? "edit mask provided, white or light masked regions regenerated, black or dark unmasked regions preserved"
      : "",
    settings.qualityPrompt,
    "consistent subject and composition, natural rendering variation only",
    style,
    settings.creativityPrompt,
    contentFilter,
  ].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
}

function releaseImagePreviewUrl(source) {
  if (source?.previewObjectUrl) URL.revokeObjectURL(source.previewObjectUrl);
}

function setActiveImageSource(source) {
  releaseImagePreviewUrl(activeImageSource);
  activeImageSource = source;
  renderImageSourcePreview();
  syncModeUI();
}

function clearActiveImageSource() {
  releaseImagePreviewUrl(activeImageSource);
  activeImageSource = null;
  renderImageSourcePreview();
  syncModeUI();
}

function setActiveImageMask(mask) {
  releaseImagePreviewUrl(activeImageMask);
  activeImageMask = mask;
  renderImageMaskPreview();
}

function clearActiveImageMask() {
  releaseImagePreviewUrl(activeImageMask);
  activeImageMask = null;
  renderImageMaskPreview();
}

function renderImageSourcePreview() {
  if (!els.imageSourcePreview) return;
  if (!activeImageSource) {
    els.imageSourcePreview.innerHTML = "";
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

function renderImageMaskPreview() {
  if (!els.imageMaskPreview) return;
  if (!activeImageMask) {
    els.imageMaskPreview.innerHTML = "";
    return;
  }
  const src = activeImageMask.previewUrl || activeImageMask.url || "";
  els.imageMaskPreview.innerHTML = `
    <div class="chat-image-source-card">
      ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(activeImageMask.name || "Selected edit mask")}" />` : ""}
      <div>
        <strong>${escapeHtml(activeImageMask.name || "Edit mask")}</strong>
        <span>Mask: light changes, dark preserves</span>
      </div>
      <button class="chat-doc-remove" type="button" data-image-mask-clear aria-label="Clear edit mask">x</button>
    </div>
  `;
}

function readUploadedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/png", "image/jpeg"].includes(file.type)) {
      reject(new Error("Upload a PNG or JPG image."));
      return;
    }
    const previewObjectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      if (!base64) {
        URL.revokeObjectURL(previewObjectUrl);
        reject(new Error("Could not read the uploaded image."));
        return;
      }
      resolve({
        kind: "base64",
        name: file.name,
        mimeType: file.type,
        image_base64: dataUrl,
        previewUrl: previewObjectUrl,
        previewObjectUrl,
      });
    };
    reader.onerror = () => {
      URL.revokeObjectURL(previewObjectUrl);
      reject(new Error("Could not read the uploaded image."));
    };
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the source image."));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the source image."));
    image.src = src;
  });
}

function dataUrlByteLength(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.max(0, Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0));
}

async function readVisionImage(file) {
  const limits = getVisionLimits();
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Upload a PNG, JPG, or WebP image.");
  }
  if (file.size > limits.maxImageBytes) {
    throw new Error(`${file.name} is larger than ${Math.floor(limits.maxImageBytes / 1024 / 1024)} MB.`);
  }
  const previewObjectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(previewObjectUrl);
    const sourcePixels = image.naturalWidth * image.naturalHeight;
    const pixelScale = sourcePixels > limits.maxPixels ? Math.sqrt(limits.maxPixels / sourcePixels) : 1;
    const scale = Math.min(pixelScale, 1, 2048 / image.naturalWidth, 2048 / image.naturalHeight);
    let dataUrl;
    let mimeType = file.type;
    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (scale < 0.999) {
      width = Math.max(1, Math.floor(image.naturalWidth * scale));
      height = Math.max(1, Math.floor(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image preparation is unavailable in this browser.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      mimeType = "image/jpeg";
      for (const quality of [0.84, 0.74, 0.64]) {
        if (dataUrlByteLength(dataUrl) <= limits.maxImageBytes) break;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
    } else {
      dataUrl = await readBlobAsDataUrl(file);
    }
    const sizeBytes = dataUrlByteLength(dataUrl);
    if (sizeBytes > limits.maxImageBytes) {
      throw new Error(`${file.name} could not be prepared within the local vision size limit.`);
    }
    return {
      id: globalThis.crypto?.randomUUID?.() || `vision-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: "upload",
      name: file.name,
      mimeType,
      sizeBytes,
      width,
      height,
      dataUrl,
      previewUrl: previewObjectUrl,
      previewObjectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(previewObjectUrl);
    throw error;
  }
}

function renderVisionPreview() {
  if (!els.visionPreview) return;
  els.visionPreview.innerHTML = attachedVisionImages.map((image) => `
    <div class="chat-vision-chip">
      <img src="${escapeHtml(image.previewUrl || image.url || image.dataUrl || "")}" alt="" />
      <div>
        <strong>${escapeHtml(image.name || "Image")}</strong>
        <span>${visionSupported ? "Ready for local image understanding" : "Ready for image tools"}</span>
      </div>
      <button type="button" data-vision-remove="${escapeHtml(image.id)}" title="Remove image" aria-label="Remove ${escapeHtml(image.name || "image")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  `).join("");
}

function clearAttachedVisionImages({ release = true } = {}) {
  if (release) attachedVisionImages.forEach(releaseImagePreviewUrl);
  attachedVisionImages = [];
  renderVisionPreview();
}

function releaseConversationVisionPreviews(conversationMessages = messages) {
  conversationMessages.forEach((message) => {
    if (!Array.isArray(message.visionImages)) return;
    message.visionImages.forEach(releaseImagePreviewUrl);
  });
}

async function uploadVisionAsset(image) {
  if (image.url || !image.dataUrl || !historyState.available || historyState.currentRetention === "none") return image;
  const blob = await (await fetch(image.dataUrl)).blob();
  const form = new FormData();
  form.append("file", blob, image.name || "image");
  const { json } = await historyRequest("/assets", { method: "POST", body: form });
  if (!json.ok || !json.asset?.url) throw new Error("Private image storage returned an invalid response.");
  return {
    ...image,
    assetId: json.asset.asset_id,
    url: absoluteImageUrl(json.asset.url),
    mimeType: json.asset.mime_type || image.mimeType,
    sizeBytes: json.asset.size_bytes || image.sizeBytes,
  };
}

async function prepareVisionImagesForSend(images) {
  const prepared = [];
  let storageFailed = false;
  for (const image of images) {
    try {
      prepared.push(await uploadVisionAsset(image));
    } catch {
      storageFailed = true;
      prepared.push(image);
    }
  }
  if (storageFailed) {
    setHistoryStatus("Image not saved", "bad", "The image is available to this local turn, but private image storage could not be reached.");
  }
  return prepared;
}

async function visionImageDataUrl(image) {
  if (image.dataUrl) return image.dataUrl;
  const url = absoluteImageUrl(image.url || image.previewUrl);
  if (!url) throw new Error("An attached image is no longer available.");
  const response = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error(`Attached image could not be loaded: HTTP ${response.status}`);
  return readBlobAsDataUrl(await response.blob());
}

async function sourceImageDataUrl(source) {
  if (source?.image_base64) return source.image_base64;
  const url = absoluteImageUrl(source?.previewUrl || source?.url);
  if (!url) throw new Error("Source image URL is unavailable.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Source image fetch failed: HTTP ${response.status}`);
  return readBlobAsDataUrl(await response.blob());
}

async function resizeImageSourceForEdit(source, settings) {
  const dataUrl = await sourceImageDataUrl(source);
  const image = await loadImageElement(dataUrl);
  if (image.naturalWidth === settings.width && image.naturalHeight === settings.height) {
    return {
      ...source,
      kind: "base64",
      image_base64: dataUrl,
      previewUrl: dataUrl,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image resizing is unavailable in this browser.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(settings.width / image.naturalWidth, settings.height / image.naturalHeight);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const left = Math.round((settings.width - width) / 2);
  const top = Math.round((settings.height - height) / 2);
  ctx.drawImage(image, left, top, width, height);

  const resizedDataUrl = canvas.toDataURL("image/png");
  return {
    ...source,
    kind: "base64",
    image_base64: resizedDataUrl,
    previewUrl: resizedDataUrl,
    resizedFor: `${settings.width}x${settings.height}`,
  };
}

function setStatus(text, state = "neutral") {
  els.status.textContent = text;
  els.status.dataset.state = state;
  if (els.runtimeDot) els.runtimeDot.dataset.state = state;
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-AU");
}

function isLoopbackHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function resolveChatUserId() {
  if (isLoopbackHost()) return "local-browser";
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

function setHistoryStatus(text, state = "neutral", privacyText = text) {
  if (els.historyStatus) {
    els.historyStatus.textContent = text;
    els.historyStatus.dataset.state = state;
  }
  if (els.privacyStatus) {
    els.privacyStatus.textContent = privacyText;
    els.privacyStatus.dataset.state = state;
  }
}

function historyTimeLabel(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "Saved chat";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function renderConversationHistory() {
  if (!els.historyList) return;
  const items = historyState.conversations;
  els.historyCount.textContent = items.length ? String(items.length) : "";
  if (historyState.loading) {
    els.historyList.innerHTML = '<p class="chat-history-empty">Loading chats...</p>';
    return;
  }
  if (!historyState.available) {
    els.historyList.innerHTML = '<p class="chat-history-empty">History is unavailable. Chat still works in this tab.</p>';
    return;
  }
  if (!items.length) {
    els.historyList.innerHTML = '<p class="chat-history-empty">Your saved chats will appear here.</p>';
    return;
  }
  els.historyList.innerHTML = items.map((conversation) => `
    <div class="chat-history-item${conversation.id === historyState.currentId ? " is-current" : ""}">
      <button class="chat-history-open" type="button" data-history-open="${escapeHtml(conversation.id)}">
        <strong>${escapeHtml(conversation.title || "Untitled chat")}</strong>
        <small>${conversation.project_name ? `${escapeHtml(conversation.project_name)} / ` : ""}${escapeHtml(historyTimeLabel(conversation.updated_at))}</small>
      </button>
      <button class="chat-history-remove" type="button" data-history-delete="${escapeHtml(conversation.id)}" title="Delete saved chat" aria-label="Delete ${escapeHtml(conversation.title || "saved chat")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
      </button>
    </div>
  `).join("");
}

async function historyRequest(path = "", options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let response;
  try {
    response = await fetch(`${HISTORY_API_PATH}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch (cause) {
    const error = new Error("Private history could not be reached.");
    error.cause = cause;
    error.status = 0;
    throw error;
  }
  const raw = response.status === 204 ? "" : await response.text();
  let json = {};
  if (raw) {
    try { json = JSON.parse(raw); } catch { json = {}; }
  }
  if (!response.ok) {
    const error = new Error(json.error?.message || "Private history request failed.");
    error.status = response.status;
    error.code = json.error?.code;
    throw error;
  }
  return { response, json, etag: response.headers.get("etag") };
}

function jobStatusLabel(status) {
  if (status === "completed") return "Complete";
  if (status === "failed") return "Failed";
  if (status === "submitting") return "Submitting";
  return "Running";
}

function renderBackgroundJobs() {
  if (!els.jobsList) return;
  const jobs = jobState.jobs;
  const activeCount = jobs.filter((job) => ["submitting", "queued_or_running"].includes(job.status)).length;
  if (els.jobsBadge) {
    els.jobsBadge.textContent = String(activeCount);
    els.jobsBadge.hidden = activeCount === 0;
  }
  if (els.jobsOpen) els.jobsOpen.classList.toggle("has-active-jobs", activeCount > 0);
  if (els.jobsStatus) {
    els.jobsStatus.textContent = jobState.loading
      ? "Refreshing jobs..."
      : !jobState.available
        ? "Background jobs are unavailable. Image tools still work in this tab."
        : activeCount
          ? `${activeCount} image job${activeCount === 1 ? "" : "s"} running`
          : jobs.length ? "All image jobs are complete" : "No background jobs yet";
    els.jobsStatus.dataset.state = !jobState.available && !jobState.loading ? "bad" : activeCount ? "busy" : "good";
  }
  if (jobState.loading) {
    els.jobsList.innerHTML = '<p class="chat-jobs-empty">Loading jobs...</p>';
    return;
  }
  if (!jobState.available || !jobs.length) {
    els.jobsList.innerHTML = `<p class="chat-jobs-empty">${jobState.available ? "Long-running image work will appear here." : "The current image routes remain available."}</p>`;
    return;
  }
  els.jobsList.innerHTML = jobs.map((job) => {
    const output = Array.isArray(job.outputs) ? job.outputs[0] : null;
    const outputUrl = output?.url ? absoluteImageUrl(output.url) : "";
    const isActive = ["submitting", "queued_or_running"].includes(job.status);
    const isComplete = job.status === "completed" && outputUrl;
    const title = job.title || job.prompt || "Image job";
    const sample = Number(job.sample_total || 1) > 1 ? ` / sample ${job.sample_index} of ${job.sample_total}` : "";
    return `
      <article class="chat-job-item" data-job-id="${escapeHtml(job.id)}">
        ${isComplete ? `<img class="chat-job-thumbnail" src="${escapeHtml(outputUrl)}" alt="" loading="lazy" />` : `<div class="chat-job-placeholder${isActive ? " is-running" : ""}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4Z" /><path d="m4 16 5-5 4 4 3-3 4 4" /></svg></div>`}
        <div class="chat-job-copy">
          <div class="chat-job-heading">
            <strong>${escapeHtml(title)}</strong>
            <span data-state="${escapeHtml(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
          </div>
          <small>${escapeHtml(job.kind || "image")}${escapeHtml(sample)} / ${escapeHtml(historyTimeLabel(job.updated_at))}</small>
          ${job.error ? `<p>${escapeHtml(job.error)}</p>` : ""}
          <div class="chat-job-actions">
            ${isComplete ? `
              <button class="chat-secondary-button" type="button" data-job-add="${escapeHtml(job.id)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Add to chat
              </button>
              <button class="chat-icon-button" type="button" data-job-download="${escapeHtml(job.id)}" title="Download result" aria-label="Download result">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
              </button>
              <a class="chat-icon-button" href="${escapeHtml(outputUrl)}" target="_blank" rel="noopener noreferrer" title="Open result in new tab" aria-label="Open result in new tab">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>
              </a>` : ""}
            ${!isActive ? `<button class="chat-icon-button chat-job-dismiss" type="button" data-job-dismiss="${escapeHtml(job.id)}" title="Dismiss job" aria-label="Dismiss ${escapeHtml(title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>` : ""}
          </div>
        </div>
      </article>`;
  }).join("");
}

async function jobRequest(path = "", options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response;
  try {
    response = await fetch(`${JOBS_API_PATH}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    const error = new Error("The private job queue could not be reached.");
    error.cause = cause;
    error.status = 0;
    throw error;
  }
  const raw = response.status === 204 ? "" : await response.text();
  let json = {};
  if (raw) {
    try { json = JSON.parse(raw); } catch { json = {}; }
  }
  if (!response.ok) {
    const error = new Error(json.error?.message || `Background job request failed: HTTP ${response.status}`);
    error.status = response.status;
    error.code = json.error?.code;
    error.job = json.job;
    throw error;
  }
  return { response, json };
}

function upsertBackgroundJob(job) {
  if (!job?.id) return;
  jobState.jobs = [job, ...jobState.jobs.filter((item) => item.id !== job.id)]
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  renderBackgroundJobs();
}

function scheduleActiveJobRefresh() {
  if (jobState.refreshTimer) clearTimeout(jobState.refreshTimer);
  jobState.refreshTimer = null;
  if (!jobState.available || !jobState.jobs.some((job) => ["submitting", "queued_or_running"].includes(job.status))) return;
  jobState.refreshTimer = setTimeout(() => refreshActiveJobs(), JOB_REFRESH_INTERVAL_MS);
}

async function refreshActiveJobs({ immediate = false } = {}) {
  if (!jobState.available || jobState.refreshing) return;
  if (jobState.refreshTimer) clearTimeout(jobState.refreshTimer);
  jobState.refreshTimer = null;
  if (!immediate) await new Promise((resolve) => setTimeout(resolve, 0));
  const active = jobState.jobs.filter((job) => ["submitting", "queued_or_running"].includes(job.status)).slice(0, 4);
  if (!active.length) {
    renderBackgroundJobs();
    return;
  }
  jobState.refreshing = true;
  try {
    const results = await Promise.allSettled(active.map((job) => jobRequest(`/${encodeURIComponent(job.id)}`)));
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.json?.job) upsertBackgroundJob(result.value.json.job);
    });
  } finally {
    jobState.refreshing = false;
    scheduleActiveJobRefresh();
  }
}

async function loadBackgroundJobs() {
  if (jobState.loadingRequest) return;
  jobState.loadingRequest = true;
  jobState.loading = true;
  renderBackgroundJobs();
  try {
    const { json } = await jobRequest();
    if (!json.ok || !Array.isArray(json.jobs)) throw new Error("The private job queue returned an invalid response.");
    jobState.available = true;
    jobState.jobs = json.jobs;
  } catch {
    jobState.available = false;
    jobState.jobs = [];
  } finally {
    jobState.loadingRequest = false;
    jobState.loading = false;
    renderBackgroundJobs();
    scheduleActiveJobRefresh();
  }
}

async function createBackgroundJob(kind, request, title, sampleIndex, sampleTotal, signal) {
  if (!jobState.available) return null;
  try {
    const { json } = await jobRequest("", {
      method: "POST",
      body: JSON.stringify({
        kind,
        request,
        title,
        sample_index: sampleIndex + 1,
        sample_total: sampleTotal,
      }),
      signal,
    });
    if (!json.job?.id) throw new Error("The background job queue returned an invalid response.");
    upsertBackgroundJob(json.job);
    scheduleActiveJobRefresh();
    return json.job;
  } catch (error) {
    if (error.job) upsertBackgroundJob(error.job);
    throw error;
  }
}

async function projectRequest(path = "", options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let response;
  try {
    response = await fetch(`${PROJECTS_API_PATH}${path}`, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch (cause) {
    const error = new Error("The private project library could not be reached.");
    error.cause = cause;
    error.status = 0;
    throw error;
  }
  const raw = response.status === 204 ? "" : await response.text();
  let json = {};
  if (raw) {
    try { json = JSON.parse(raw); } catch { json = {}; }
  }
  if (!response.ok) {
    const error = new Error(json.error?.message || `Project request failed: HTTP ${response.status}`);
    error.status = response.status;
    error.code = json.error?.code;
    throw error;
  }
  return { response, json, etag: response.headers.get("etag") };
}

function setProjectStatus(text, state = "neutral") {
  [els.projectRailStatus, els.projectStatus].forEach((element) => {
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
  });
}

function projectOptionsMarkup() {
  return [
    '<option value="">No project</option>',
    ...projectState.projects.map((project) => (
      `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`
    )),
  ].join("");
}

function formatProjectBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function renderProjectDocuments() {
  if (!els.projectDocumentList) return;
  const documents = projectState.documents;
  els.projectDocumentCount.textContent = String(documents.length);
  if (!documents.length) {
    els.projectDocumentList.innerHTML = '<p class="chat-project-empty">No reusable documents yet.</p>';
    return;
  }
  els.projectDocumentList.innerHTML = documents.map((document) => `
    <div class="chat-project-document">
      <div class="chat-project-document-icon" aria-hidden="true">${escapeHtml((document.extension || "file").slice(0, 4).toUpperCase())}</div>
      <div class="chat-project-document-copy">
        <strong title="${escapeHtml(document.name)}">${escapeHtml(document.name)}</strong>
        <small>${formatProjectBytes(document.original_bytes)} / ${formatNumber(document.estimated_token_count || 0)} tokens / ${formatNumber(document.chunk_count || 0)} passages</small>
      </div>
      <div class="chat-project-document-actions">
        <button type="button" data-project-document-download="${escapeHtml(document.id)}" title="Download document" aria-label="Download ${escapeHtml(document.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        </button>
        <button type="button" data-project-document-delete="${escapeHtml(document.id)}" title="Delete document" aria-label="Delete ${escapeHtml(document.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></svg>
        </button>
      </div>
    </div>
  `).join("");
}

function renderProjectState() {
  const options = projectOptionsMarkup();
  [els.projectSelect, els.projectSettingsSelect].forEach((select) => {
    if (!select) return;
    select.innerHTML = options;
    select.value = projectState.activeId || "";
    select.disabled = !projectState.available || projectState.loading || projectState.busy;
  });
  const active = projectState.active;
  els.projectEditor.hidden = !active;
  els.projectName.value = active?.name || "";
  els.projectInstructions.value = active?.instructions || "";
  els.projectSave.disabled = !active || !projectState.available || projectState.busy;
  els.projectDelete.disabled = !active || !projectState.available || projectState.busy;
  els.projectUpload.disabled = !active || !projectState.available || projectState.busy;
  els.projectCreate.disabled = !projectState.available || projectState.busy;
  els.attachProjectDocument.hidden = !active || !projectState.available;
  if (active) els.attachProjectHint.textContent = `Save for reuse in ${active.name}`;
  renderProjectDocuments();
}

async function setActiveProject(id, { quiet = false } = {}) {
  const nextId = String(id || "");
  if (!nextId) {
    projectState.activeId = null;
    projectState.active = null;
    projectState.documents = [];
    projectState.etag = null;
    renderProjectState();
    setProjectStatus(projectState.available ? "No project selected" : "Project library unavailable", projectState.available ? "neutral" : "bad");
    if (!quiet) scheduleConversationSave(0);
    return;
  }
  projectState.busy = true;
  projectState.activeId = nextId;
  renderProjectState();
  setProjectStatus("Opening project...", "neutral");
  try {
    const [projectResult, documentsResult] = await Promise.all([
      projectRequest(`/${encodeURIComponent(nextId)}`),
      projectRequest(`/${encodeURIComponent(nextId)}/documents`),
    ]);
    const project = projectResult.json.project;
    if (!project?.id || !Array.isArray(documentsResult.json.documents)) throw new Error("Project library returned an invalid response.");
    projectState.active = project;
    projectState.documents = documentsResult.json.documents;
    projectState.etag = projectResult.etag || project.version;
    projectState.projects = [
      { ...projectState.projects.find((item) => item.id === project.id), ...project },
      ...projectState.projects.filter((item) => item.id !== project.id),
    ].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    setProjectStatus(`${project.name} / ${projectState.documents.length} document${projectState.documents.length === 1 ? "" : "s"}`, "good");
    if (!quiet) scheduleConversationSave(0);
  } catch (error) {
    projectState.activeId = null;
    projectState.active = null;
    projectState.documents = [];
    projectState.etag = null;
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.busy = false;
    renderProjectState();
  }
}

async function loadProjects() {
  projectState.loading = true;
  renderProjectState();
  try {
    const { json } = await projectRequest();
    if (!json.ok || !Array.isArray(json.projects)) throw new Error("Project library returned an invalid response.");
    projectState.available = true;
    projectState.projects = json.projects;
    if (projectState.activeId && !projectState.projects.some((project) => project.id === projectState.activeId)) {
      projectState.activeId = null;
      projectState.active = null;
      projectState.documents = [];
      projectState.etag = null;
    }
    setProjectStatus(projectState.projects.length ? "Choose a project or continue without one" : "Create a project for reusable documents", "good");
  } catch (error) {
    projectState.available = false;
    projectState.projects = [];
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.loading = false;
    renderProjectState();
  }
}

async function createProject() {
  const name = els.projectCreateName.value.trim();
  if (!name) {
    setProjectStatus("Enter a project name first", "bad");
    els.projectCreateName.focus();
    return;
  }
  projectState.busy = true;
  renderProjectState();
  setProjectStatus("Creating project...", "neutral");
  try {
    const { json } = await projectRequest("", { method: "POST", body: JSON.stringify({ name }) });
    const project = json.project;
    if (!project?.id) throw new Error("Project library returned an invalid response.");
    projectState.projects = [project, ...projectState.projects];
    els.projectCreateName.value = "";
    projectState.busy = false;
    await setActiveProject(project.id);
  } catch (error) {
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.busy = false;
    renderProjectState();
  }
}

async function saveProjectDetails() {
  if (!projectState.active) return;
  const body = { name: els.projectName.value.trim(), instructions: els.projectInstructions.value.trim() };
  if (!body.name) {
    setProjectStatus("Project name cannot be empty", "bad");
    return;
  }
  projectState.busy = true;
  renderProjectState();
  setProjectStatus("Saving project...", "neutral");
  try {
    const result = await projectRequest(`/${encodeURIComponent(projectState.active.id)}`, {
      method: "PUT",
      headers: { "if-match": projectState.etag || projectState.active.version },
      body: JSON.stringify(body),
    });
    projectState.active = result.json.project;
    projectState.etag = result.etag || projectState.active.version;
    projectState.projects = projectState.projects.map((project) => (
      project.id === projectState.active.id ? { ...project, ...projectState.active } : project
    ));
    setProjectStatus("Project details saved", "good");
    scheduleConversationSave(0);
  } catch (error) {
    setProjectStatus(error.status === 412 ? "Project changed elsewhere. Reopen it and try again." : error.message, "bad");
  } finally {
    projectState.busy = false;
    renderProjectState();
  }
}

async function deleteActiveProject() {
  const project = projectState.active;
  if (!project || !window.confirm(`Delete "${project.name}" and all its stored documents? This cannot be undone.`)) return;
  projectState.busy = true;
  renderProjectState();
  setProjectStatus("Deleting project...", "neutral");
  try {
    await projectRequest(`/${encodeURIComponent(project.id)}`, { method: "DELETE" });
    projectState.projects = projectState.projects.filter((item) => item.id !== project.id);
    projectState.activeId = null;
    projectState.active = null;
    projectState.documents = [];
    projectState.etag = null;
    setProjectStatus("Project deleted", "good");
    scheduleConversationSave(0);
  } catch (error) {
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.busy = false;
    renderProjectState();
  }
}

async function uploadProjectDocuments(files) {
  if (!projectState.active || !files.length) return;
  projectState.busy = true;
  renderProjectState();
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (file.size > PROJECT_MAX_FILE_BYTES) throw new Error(`${file.name} is larger than the 30 MB project limit.`);
      setProjectStatus(`Indexing ${file.name} (${index + 1} of ${files.length})...`, "neutral");
      const form = new FormData();
      form.append("file", file, file.name);
      await projectRequest(`/${encodeURIComponent(projectState.active.id)}/documents`, { method: "POST", body: form });
    }
    projectState.busy = false;
    await setActiveProject(projectState.active.id, { quiet: true });
    setProjectStatus(`${files.length} document${files.length === 1 ? "" : "s"} added to ${projectState.active.name}`, "good");
  } catch (error) {
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.busy = false;
    els.projectDocuments.value = "";
    renderProjectState();
  }
}

async function downloadProjectDocument(documentId) {
  const storedDocument = projectState.documents.find((item) => item.id === documentId);
  if (!storedDocument || !projectState.active) return;
  setProjectStatus(`Preparing ${storedDocument.name}...`, "neutral");
  try {
    const response = await fetch(`${PROJECTS_API_PATH}/${encodeURIComponent(projectState.active.id)}/documents/${encodeURIComponent(storedDocument.id)}/download`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = storedDocument.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setProjectStatus(`${storedDocument.name} download started`, "good");
  } catch (error) {
    setProjectStatus(error.message, "bad");
  }
}

async function deleteProjectDocument(documentId) {
  const document = projectState.documents.find((item) => item.id === documentId);
  if (!document || !projectState.active || !window.confirm(`Delete "${document.name}" from this project?`)) return;
  projectState.busy = true;
  renderProjectState();
  setProjectStatus(`Deleting ${document.name}...`, "neutral");
  try {
    await projectRequest(`/${encodeURIComponent(projectState.active.id)}/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
    projectState.busy = false;
    await setActiveProject(projectState.active.id, { quiet: true });
    setProjectStatus(`${document.name} deleted`, "good");
  } catch (error) {
    setProjectStatus(error.message, "bad");
  } finally {
    projectState.busy = false;
    renderProjectState();
  }
}

function currentMessages() {
  return messages.filter((message) => !message.isWelcome && (message.role === "user" || message.role === "assistant"));
}

function historyImageMetadata(output) {
  return {
    url: output.url,
    filename: output.filename,
    subfolder: output.subfolder || "",
    type: output.type || "output",
    prompt: output.prompt,
    model: output.model,
    quality: output.quality,
    size: output.size,
  };
}

function storedHistoryMessages() {
  return currentMessages().map((message) => {
    if (!message.id) message.id = createMessage(message.role, "").id;
    if (!message.createdAt) message.createdAt = new Date().toISOString();
    const item = {
      id: message.id,
      role: message.role,
      content: String(message.content || ""),
      created_at: message.createdAt,
    };
    const images = Array.isArray(message.imageOutputs)
      ? message.imageOutputs.slice(0, 4).map(historyImageMetadata)
      : [];
    if (images.length) {
      item.image = images[0];
      item.images = images;
    }
    const visionImages = Array.isArray(message.visionImages)
      ? message.visionImages.slice(0, getVisionLimits().maxImages).filter((image) => image.url).map((image) => ({
          asset_id: image.assetId,
          name: image.name,
          mime_type: image.mimeType || "image/png",
          url: image.url,
          width: image.width,
          height: image.height,
          size_bytes: image.sizeBytes,
        }))
      : [];
    if (visionImages.length) item.vision_images = visionImages;
    if (message.webContext) {
      item.web_context = {
        query: message.webContext.query,
        provider: message.webContext.provider || message.webContext.search_route?.provider,
        fetch_mode: message.webContext.fetch_mode || message.webContext.fetchMode,
        sources: Array.isArray(message.webContext.sources)
          ? message.webContext.sources.slice(0, 10).map((source) => ({
              index: source.index,
              title: source.title,
              url: source.url,
              fetched: source.fetched,
              extraction_method: source.extraction_method,
            }))
          : [],
      };
    }
    if (message.projectContext) {
      item.project_context = {
        project_id: message.projectContext.project_id,
        project_name: message.projectContext.project_name,
        passages: Array.isArray(message.projectContext.passages)
          ? message.projectContext.passages.slice(0, 12).map((passage) => ({
              citation: passage.citation,
              document_id: passage.document_id,
              document_name: passage.document_name,
              page: passage.page,
              section: passage.section,
              lines: passage.lines,
            }))
          : [],
      };
    }
    return item;
  });
}

function restoredHistoryMessage(message) {
  const images = Array.isArray(message.images) && message.images.length
    ? message.images
    : message.image ? [message.image] : [];
  return createMessage(message.role, message.content || "", {
    id: message.id,
    createdAt: message.created_at,
    webContext: message.web_context,
    projectContext: message.project_context,
    imageOutputs: images.map((image) => ({ ...image, url: absoluteImageUrl(image.url) })),
    imagePrompt: images[0]?.prompt || "",
    visionImages: (Array.isArray(message.vision_images) ? message.vision_images : []).map((image) => ({
      id: image.asset_id || globalThis.crypto?.randomUUID?.() || `vision-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      assetId: image.asset_id,
      name: image.name || "Image",
      mimeType: image.mime_type || "image/png",
      url: absoluteImageUrl(image.url),
      previewUrl: absoluteImageUrl(image.url),
      width: image.width,
      height: image.height,
      sizeBytes: image.size_bytes,
    })),
  });
}

function currentConversationTitle() {
  const firstUserMessage = currentMessages().find((message) => message.role === "user")?.content || "";
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  if (cleaned.length <= 72) return cleaned;
  const shortened = cleaned.slice(0, 69).replace(/\s+\S*$/, "").trim();
  return `${shortened || cleaned.slice(0, 69).trim()}...`;
}

function historySummary(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    retention: conversation.retention,
    message_count: conversation.message_count,
    version: conversation.version,
    project_id: conversation.project_id,
    project_name: conversation.project_name,
  };
}

function upsertHistorySummary(conversation) {
  historyState.conversations = [
    historySummary(conversation),
    ...historyState.conversations.filter((item) => item.id !== conversation.id),
  ].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  renderConversationHistory();
}

function updateHistoryControls() {
  const hasMessages = currentMessages().length > 0;
  if (els.historyExport) els.historyExport.disabled = !hasMessages;
  if (els.historyDelete) els.historyDelete.disabled = !historyState.currentId;
}

async function loadConversationHistory() {
  historyState.loading = true;
  renderConversationHistory();
  try {
    const { json } = await historyRequest();
    if (!json.ok || !Array.isArray(json.conversations)) throw new Error("Private history returned an invalid response.");
    historyState.available = true;
    historyState.conversations = json.conversations;
    historyState.defaultRetention = json.preferences?.retention || "30_days";
    if (!historyState.currentId && currentMessages().length === 0) {
      historyState.currentRetention = historyState.defaultRetention;
      els.historyRetention.value = historyState.currentRetention;
    }
    setHistoryStatus(
      historyState.currentRetention === "none" ? "Not saved" : "Private history ready",
      "good",
      historyState.currentRetention === "none"
        ? "This chat stays only in this browser tab."
        : "Saved chats are encrypted and private to your signed-in account.",
    );
  } catch {
    historyState.available = false;
    historyState.conversations = [];
    setHistoryStatus("History unavailable", "bad", "History is unavailable in this browser session. Chat still works normally.");
  } finally {
    historyState.loading = false;
    renderConversationHistory();
    updateHistoryControls();
  }
}

function historyMessagesArePrefix(remoteMessages, localMessages) {
  if (!Array.isArray(remoteMessages) || remoteMessages.length > localMessages.length) return false;
  return remoteMessages.every((message, index) => (
    message.role === localMessages[index]?.role && message.content === localMessages[index]?.content
  ));
}

async function saveConversation() {
  if (!historyState.available || historyState.currentRetention === "none") return;
  const storedMessages = storedHistoryMessages();
  if (!storedMessages.some((message) => message.role === "user")) return;
  if (historyState.saving) {
    historyState.saveQueued = true;
    return;
  }
  historyState.saving = true;
  setHistoryStatus("Saving...", "neutral", "Saving this chat privately...");
  const body = {
    title: currentConversationTitle(),
    retention: historyState.currentRetention,
    messages: storedMessages,
    project_id: projectState.active?.id || null,
    project_name: projectState.active?.name || null,
  };
  try {
    let result;
    if (historyState.currentId) {
      try {
        result = await historyRequest(`/${encodeURIComponent(historyState.currentId)}`, {
          method: "PUT",
          headers: { "if-match": historyState.currentVersion },
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (error.status !== 409) throw error;
        const latest = await historyRequest(`/${encodeURIComponent(historyState.currentId)}`);
        const remoteConversation = latest.json.conversation;
        if (historyMessagesArePrefix(remoteConversation?.messages, storedMessages)) {
          result = await historyRequest(`/${encodeURIComponent(historyState.currentId)}`, {
            method: "PUT",
            headers: { "if-match": latest.etag || remoteConversation.version },
            body: JSON.stringify(body),
          });
        } else {
          historyState.currentId = null;
          historyState.currentVersion = null;
          body.title = `${body.title.slice(0, 106)} (continued)`;
          result = await historyRequest("", { method: "POST", body: JSON.stringify(body) });
        }
      }
    } else {
      result = await historyRequest("", { method: "POST", body: JSON.stringify(body) });
    }
    const conversation = result.json.conversation;
    if (!conversation?.id) throw new Error("Private history returned an invalid response.");
    historyState.currentId = conversation.id;
    historyState.currentVersion = result.etag || conversation.version;
    upsertHistorySummary(conversation);
    setHistoryStatus("Saved", "good", historyState.currentRetention === "forever"
      ? "This chat is encrypted and kept until you delete it."
      : "This chat is encrypted and kept for 30 days after its latest update.");
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 0) historyState.available = false;
    const rejected = error.status === 400 || error.status === 413;
    setHistoryStatus(
      rejected ? "Not saved" : "Save unavailable",
      "bad",
      rejected ? error.message : "This chat is still available in this tab, but could not be saved right now.",
    );
    renderConversationHistory();
  } finally {
    historyState.saving = false;
    updateHistoryControls();
    if (historyState.saveQueued) {
      historyState.saveQueued = false;
      scheduleConversationSave(0);
    }
  }
}

function scheduleConversationSave(delay = HISTORY_SAVE_DELAY_MS) {
  if (!historyState.available || historyState.currentRetention === "none") return;
  if (historyState.saveTimer) clearTimeout(historyState.saveTimer);
  historyState.saveTimer = setTimeout(() => {
    historyState.saveTimer = null;
    saveConversation();
  }, delay);
}

async function saveHistoryPreference(retention) {
  if (!historyState.available) return false;
  try {
    await historyRequest("/preferences", {
      method: "PUT",
      body: JSON.stringify({ retention }),
    });
    return true;
  } catch {
    setHistoryStatus("Preference not saved", "bad", "Your history preference could not be saved right now.");
    return false;
  }
}

async function waitForConversationSave() {
  while (historyState.saving) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function flushConversationSave() {
  if (historyState.saveTimer) {
    clearTimeout(historyState.saveTimer);
    historyState.saveTimer = null;
  }
  await waitForConversationSave();
  await saveConversation();
  await waitForConversationSave();
}

async function openStoredConversation(id) {
  if (!historyState.available || id === historyState.currentId) {
    setRailOpen(false);
    return;
  }
  if (historyState.saveTimer) {
    clearTimeout(historyState.saveTimer);
    historyState.saveTimer = null;
    await saveConversation();
  }
  setHistoryStatus("Opening...", "neutral", "Opening your saved chat...");
  try {
    const { json, etag } = await historyRequest(`/${encodeURIComponent(id)}`);
    const conversation = json.conversation;
    releaseConversationVisionPreviews();
    messages = conversation.messages?.length
      ? conversation.messages.map(restoredHistoryMessage)
      : [welcomeMessage()];
    historyState.currentId = conversation.id;
    historyState.currentVersion = etag || conversation.version;
    historyState.currentRetention = conversation.retention;
    els.historyRetention.value = historyState.currentRetention;
    await setActiveProject(conversation.project_id || "", { quiet: true });
    uploadedDocuments = [];
    renderDocuments();
    clearAttachedVisionImages();
    clearActiveImageSource();
    clearActiveImageMask();
    renderMessages(false);
    renderConversationHistory();
    updateHistoryControls();
    setRailOpen(false);
    setHistoryStatus("Saved", "good", "This saved chat is private to your signed-in account.");
    setStatus(`Opened ${conversation.title || "saved chat"}`, "good");
    els.input.focus();
  } catch (error) {
    setHistoryStatus("Could not open chat", "bad", error.message);
  }
}

async function deleteStoredConversation(id, ask = true) {
  const conversation = historyState.conversations.find((item) => item.id === id);
  if (ask && !window.confirm(`Delete "${conversation?.title || "this saved chat"}"? This cannot be undone.`)) return false;
  try {
    await historyRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    historyState.conversations = historyState.conversations.filter((item) => item.id !== id);
    if (historyState.currentId === id) {
      historyState.currentId = null;
      historyState.currentVersion = null;
      historyState.currentRetention = "none";
      els.historyRetention.value = "none";
    }
    renderConversationHistory();
    updateHistoryControls();
    setHistoryStatus("Deleted", "good", historyState.currentId
      ? "The saved chat was deleted."
      : "This chat remains in this tab but is no longer saved.");
    return true;
  } catch (error) {
    setHistoryStatus("Delete failed", "bad", error.message);
    return false;
  }
}

function exportCurrentConversation() {
  const visibleMessages = currentMessages();
  if (!visibleMessages.length) return;
  const lines = [`# ${currentConversationTitle()}`, "", `Exported ${new Date().toLocaleString("en-AU")}`, ""];
  visibleMessages.forEach((message) => {
    lines.push(`## ${message.role === "user" ? "You" : "Token Gen"}`, "", message.content || "", "");
    (message.imageOutputs || []).forEach((image, index) => {
      lines.push(`- [Image ${index + 1}](${image.url})${image.size ? ` - ${image.size}` : ""}`);
    });
    const sources = message.webContext?.sources || [];
    if (sources.length) {
      lines.push("", "Sources:");
      sources.forEach((source) => lines.push(`- [${source.title || source.url}](${source.url})`));
    }
    const projectPassages = message.projectContext?.passages || [];
    if (projectPassages.length) {
      lines.push("", `Project: ${message.projectContext.project_name || "Project"}`);
      projectPassages.forEach((passage) => {
        const location = passage.page ? `, page ${passage.page}` : passage.section ? `, ${passage.section}` : "";
        lines.push(`- ${passage.citation || "[Project]"} ${passage.document_name || "Document"}${location}`);
      });
    }
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentConversationTitle().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "token-gen-chat"}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setHistoryStatus("Exported", "good", "A Markdown copy of this chat was downloaded.");
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
  if (els.docBudgetValue) els.docBudgetValue.textContent = `${getDocumentBudgetPercent()}%`;
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

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function renderProseMarkdown(value) {
  const lines = String(value || "").split("\n");
  const output = [];
  let listType = "";
  let paragraph = [];

  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = "";
  };
  const closeParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeParagraph();
      closeList();
      return;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length + 1;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
      return;
    }
    if (trimmed.startsWith("> ")) {
      closeParagraph();
      closeList();
      output.push(`<blockquote>${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`);
      return;
    }
    closeList();
    paragraph.push(trimmed);
  });

  closeParagraph();
  closeList();
  return output.join("");
}

function renderMarkdown(value) {
  const text = String(value || "");
  const output = [];
  const fence = /```([^\n]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;
  while ((match = fence.exec(text))) {
    output.push(renderProseMarkdown(text.slice(cursor, match.index)));
    const language = match[1].trim() || "code";
    output.push(`
      <div class="chat-code-block">
        <div class="chat-code-head">
          <span>${escapeHtml(language)}</span>
          <button class="chat-code-copy" type="button" data-code-copy>Copy</button>
        </div>
        <pre><code>${escapeHtml(match[2].replace(/\n$/, ""))}</code></pre>
      </div>
    `);
    cursor = fence.lastIndex;
  }
  output.push(renderProseMarkdown(text.slice(cursor)));
  return output.join("");
}

function renderWelcome() {
  return `
    <section class="chat-welcome">
      <div class="chat-welcome-visual">
        <img src="./assets/token-gen-server.png" alt="" />
        <div class="chat-welcome-copy">
          <span class="chat-welcome-kicker">Private local intelligence</span>
          <h1>What can Token Gen help with?</h1>
          <p>Ask a question, work with a document, search current information, or create and refine images.</p>
        </div>
      </div>
      <div class="chat-suggestions">
        <button class="chat-suggestion" type="button" data-chat-suggestion="Help me think through a complex decision. Start by asking for the context that matters.">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 18h5M10 22h4M8.7 15.5A7 7 0 1 1 15.3 15.5C14.5 16.1 14 17 14 18h-4c0-1-.5-1.9-1.3-2.5Z" /></svg>
          <span><strong>Think something through</strong><small>Reason, compare, and plan</small></span>
        </button>
        <button class="chat-suggestion" type="button" data-chat-action="attach-document">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>
          <span><strong>Work with a document</strong><small>PDF, Word, text, or code</small></span>
        </button>
        <button class="chat-suggestion" type="button" data-chat-suggestion="Create an image of " data-suggestion-mode="image">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          <span><strong>Create an image</strong><small>Generate, edit, or restyle</small></span>
        </button>
        <button class="chat-suggestion" type="button" data-chat-suggestion="Research the latest information about " data-suggestion-web="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
          <span><strong>Research the web</strong><small>Use private routed web context</small></span>
        </button>
      </div>
    </section>
  `;
}

function renderVisionMessage(message) {
  const images = Array.isArray(message.visionImages) ? message.visionImages.slice(0, getVisionLimits().maxImages) : [];
  if (!images.length) return "";
  return `
    <div class="chat-vision-message${images.length > 1 ? " is-multiple" : ""}">
      ${images.map((image, index) => `
        <figure>
          <img src="${escapeHtml(image.url || image.previewUrl || image.dataUrl || "")}" alt="${escapeHtml(image.name || `Attached image ${index + 1}`)}" loading="lazy" />
          <figcaption>${escapeHtml(image.name || `Image ${index + 1}`)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
}

function renderMessages(pending = false) {
  const visibleMessages = messages.filter((message) => !message.isWelcome);
  if (!visibleMessages.length && !pending) {
    els.thread.innerHTML = renderWelcome();
    els.thread.scrollTop = 0;
    updateHistoryControls();
    return;
  }

  els.thread.innerHTML = visibleMessages.map((message) => {
    const originalIndex = messages.indexOf(message);
    const content = message.role === "assistant"
      ? renderMarkdown(message.content)
      : `<p>${escapeHtml(message.content).replace(/\n/g, "<br>")}</p>`;
    return `
      <article class="chat-message chat-message-${message.role}">
        <div class="chat-avatar">${message.role === "user" ? "You" : "TG"}</div>
        <div class="chat-bubble">
          <div class="chat-role">${message.role === "user" ? "You" : "Token Gen"}</div>
          ${renderVisionMessage(message)}
          ${renderProjectContext(message.projectContext)}
          ${renderWebContext(message.webContext)}
          ${renderImageOutputs(message)}
          <div class="chat-content">${content}</div>
          ${message.role === "assistant" && message.content ? `
            <div class="chat-message-actions">
              <button class="chat-message-copy" type="button" data-message-copy="${originalIndex}" title="Copy response" aria-label="Copy response">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
              </button>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }).join("") + (pending ? `
    <article class="chat-message chat-message-assistant">
      <div class="chat-avatar">TG</div>
      <div class="chat-bubble">
        <div class="chat-role">Token Gen</div>
        <div class="chat-content"><span class="chat-typing">Thinking</span></div>
      </div>
    </article>
  ` : "");
  els.thread.scrollTop = els.thread.scrollHeight;
  updateHistoryControls();
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
                <button
                  class="btn"
                  type="button"
                  data-image-download="${escapeHtml(output.url)}"
                  data-image-download-name="${escapeHtml(output.filename || `token-gen-image-${index + 1}.png`)}"
                >Download</button>
                <a
                  class="btn btn-icon"
                  href="${escapeHtml(output.url)}"
                  target="_blank"
                  rel="noreferrer"
                  title="Open image in a new tab"
                  aria-label="Open image in a new tab"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 4h6v6h-2V7.41l-8.29 8.3-1.42-1.42 8.3-8.29H14V4Z"></path>
                    <path d="M5 5h6v2H7v10h10v-4h2v6H5V5Z"></path>
                  </svg>
                </a>
                <button
                  class="btn"
                  type="button"
                  data-image-analyze="${escapeHtml(output.url || "")}"
                  data-image-analyze-name="${escapeHtml(output.filename || `Sample ${index + 1}`)}"
                >Ask about</button>
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
    <details class="chat-web-context">
      <summary>
        <span>Web context</span>
        <span class="chat-web-mode">${escapeHtml(context.provider || context.search_route?.provider || "web")} / ${escapeHtml(context.fetch_mode || context.fetchMode || "direct")} / ${sources.length} source${sources.length === 1 ? "" : "s"}</span>
      </summary>
      <div class="chat-web-context-body">
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
      </div>
    </details>
  `;
}

function appendAssistantMessage(content = "") {
  messages.push(createMessage("assistant", content));
  renderMessages(false);
  return messages.length - 1;
}

function renderProjectContext(context) {
  if (!context) return "";
  const passages = Array.isArray(context.passages) ? context.passages.slice(0, 12) : [];
  return `
    <details class="chat-web-context chat-project-context">
      <summary>
        <span>${escapeHtml(context.project_name || "Project context")}</span>
        <span class="chat-web-mode">${passages.length} passage${passages.length === 1 ? "" : "s"}</span>
      </summary>
      ${passages.length ? `
        <div class="chat-web-context-body">
          <div class="chat-project-sources">
            ${passages.map((passage) => {
              const location = passage.page
                ? `Page ${passage.page}`
                : passage.section
                  ? passage.section
                  : Array.isArray(passage.lines)
                    ? `Lines ${passage.lines.join("-")}`
                    : "Relevant passage";
              return `
                <div>
                  <strong>${escapeHtml(passage.citation || "[Project]")} ${escapeHtml(passage.document_name || "Document")}</strong>
                  <span>${escapeHtml(location)}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}
    </details>
  `;
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

function boundedChatPayload(systemParts) {
  const fullHistory = messages
    .filter((message) => !message.isWelcome && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: String(message.content || ""),
      visionImages: Array.isArray(message.visionImages) ? message.visionImages.slice(0, getVisionLimits().maxImages) : [],
    }));
  const contextWindow = getModelContextWindow();
  const systemTokens = estimateTokens(systemParts.join("\n\n"));
  const safetyTokens = Math.max(1024, Math.ceil(contextWindow * 0.01));
  const messageTokens = (message) => estimateTokens(message?.content || "") + 8 + (message?.visionImages?.length || 0) * 1400;
  const latestTokens = messageTokens(fullHistory.at(-1));
  const availableAfterSystem = Math.max(512, contextWindow - systemTokens - safetyTokens);
  const requestedWebTokens = els.webSearch.checked ? Number(els.webBudget.value || 10000) : 0;
  const webTokens = Math.max(0, Math.min(requestedWebTokens, availableAfterSystem - Math.min(latestTokens, Math.floor(availableAfterSystem * 0.5)) - 256));
  const requestedOutput = Number(els.maxTokens.value || 20000);
  const maximumOutput = Math.max(256, availableAfterSystem - webTokens - Math.min(latestTokens, Math.floor(availableAfterSystem * 0.5)));
  const outputTokens = Math.max(256, Math.min(requestedOutput, maximumOutput));
  let remaining = Math.max(256, availableAfterSystem - webTokens - outputTokens);
  const selected = [];

  for (let index = fullHistory.length - 1; index >= 0; index -= 1) {
    const message = fullHistory[index];
    const tokens = messageTokens(message);
    if (tokens <= remaining) {
      selected.unshift(message);
      remaining -= tokens;
      continue;
    }
    if (!selected.length && remaining > 32) {
      selected.unshift({ ...message, content: message.content.slice(0, Math.max(1, remaining * TOKEN_CHARS)) });
    }
    break;
  }

  return { history: selected, maxTokens: outputTokens, webTokens };
}

async function chatPayloadMessage(message) {
  const images = Array.isArray(message.visionImages) ? message.visionImages : [];
  if (!images.length || message.role !== "user") {
    return { role: message.role, content: message.content };
  }
  const content = [{ type: "text", text: message.content }];
  for (const image of images) {
    content.push({ type: "image_url", image_url: { url: await visionImageDataUrl(image) } });
  }
  return { role: message.role, content };
}

function attachProjectContext(index, context) {
  messages[index].projectContext = context;
  renderMessages(false);
}

async function retrieveActiveProjectContext(query) {
  const project = projectState.active;
  if (!project) return null;
  let retrieval = { project, passages: [], context: "" };
  if (projectState.documents.length) {
    const tokenBudget = Math.min(16000, Math.max(1000, Math.floor(getModelContextWindow() * 0.1)));
    const { json } = await projectRequest(`/${encodeURIComponent(project.id)}/retrieve`, {
      method: "POST",
      body: JSON.stringify({ query, top_k: 8, token_budget: tokenBudget }),
    });
    if (!json.ok || !json.project || !Array.isArray(json.passages)) {
      throw new Error("Project retrieval returned an invalid response.");
    }
    retrieval = json;
  }
  const system = [
    `Active project: ${retrieval.project.name}`,
    retrieval.project.instructions
      ? `<project_instructions>\n${retrieval.project.instructions}\n</project_instructions>`
      : "",
    retrieval.context
      ? `<project_evidence>\n${retrieval.context}\n</project_evidence>`
      : "",
  ].filter(Boolean).join("\n\n");
  return {
    system,
    metadata: {
      project_id: retrieval.project.id,
      project_name: retrieval.project.name,
      passages: retrieval.passages.map((passage) => ({
        citation: passage.citation,
        document_id: passage.document_id,
        document_name: passage.document_name,
        page: passage.page,
        section: passage.section,
        lines: passage.lines,
      })),
    },
  };
}

async function buildPayload(userId, projectContext = null) {
  const system = els.system.value.trim();
  const documentContext = buildDocumentContextMessage();
  const systemParts = [
    ...(system ? [system] : []),
    ...(documentContext?.content ? [documentContext.content] : []),
    ...(projectContext?.system ? [projectContext.system] : []),
  ];
  const bounded = boundedChatPayload(systemParts);
  const history = await Promise.all(bounded.history.map(chatPayloadMessage));

  return {
    model: els.model.value,
    messages: [
      ...(systemParts.length ? [{ role: "system", content: systemParts.join("\n\n") }] : []),
      ...history,
    ],
    temperature: Number(els.temperature.value || 0.3),
    max_tokens: bounded.maxTokens,
    enable_thinking: els.reasoning.checked,
    web_search: {
      enabled: Boolean(els.webSearch.checked),
      tavily_api_key: els.webApiKey.value.trim() || undefined,
      fetch_mode: els.webFetchMode.value,
      max_results: Number(els.webResults.value || 5),
      context_token_budget: bounded.webTokens,
    },
    metadata: {
      source: "token_gen_chat",
      user_id: userId,
      project_id: projectState.active?.id || undefined,
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
  if (els.activeModel) els.activeModel.textContent = "API unavailable";
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
  visionCapabilities = json.capabilities?.vision || models[0]?.capabilities?.vision || {};
  els.model.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(modelLabel(model.id))}</option>`).join("");
  if (els.activeModel) els.activeModel.textContent = modelLabel(models[0].id);
  const contextWindow = getModelContextWindow(models[0]);
  els.maxTokens.max = String(contextWindow);
  els.input.disabled = false;
  chatReady = true;
  syncVisionCapability();
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
    webSearchSupported = Boolean(
      res.ok
      && json.ok !== false
      && health.available !== false
      && (health.tavily_configured || health.searxng_available),
    );
    if (webSearchSupported) {
      els.webStatus.textContent = "Web context is available: Tavily first, then balanced SearXNG if Tavily credits are exhausted.";
      els.webStatus.dataset.state = "good";
      els.webSearch.disabled = false;
      syncWebUI();
      return;
    }
    if (res.ok && health.tavily_configured === false && health.searxng_available === false) {
      els.webStatus.textContent = "Web context service is online, but neither Tavily nor SearXNG is configured.";
      els.webStatus.dataset.state = "bad";
      els.webSearch.checked = false;
      els.webSearch.disabled = true;
      syncWebUI();
      return;
    }
    throw new Error(json.error || "Web-search API is not available yet.");
  } catch (error) {
    webSearchSupported = false;
    els.webSearch.checked = false;
    els.webSearch.disabled = true;
    els.webStatus.textContent = "Web context service is not configured or unavailable.";
    els.webStatus.dataset.state = "bad";
    syncWebUI();
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
  if (attachedVisionImages.length && !visionSupported) {
    setStatus("The active local model is not running with image understanding", "bad");
    return;
  }
  let visionImages = [];
  if (attachedVisionImages.length) {
    setStatus("Preparing images locally...", "busy");
    visionImages = await prepareVisionImagesForSend(attachedVisionImages);
  }
  messages.push(createMessage("user", content, { visionImages }));
  clearAttachedVisionImages({ release: false });
  renderMessages(true);
  scheduleConversationSave(0);
  els.send.disabled = true;
  els.input.disabled = true;
  setStatus(els.webSearch.checked ? "Gathering web context..." : "Generating response...", "busy");

  try {
    const chatUserId = await getChatUserId();
    if (els.webSearch.checked && !webSearchSupported) {
      throw new Error("Web context is enabled, but Tavily web context is not available yet.");
    }
    const projectContext = projectState.active
      ? await (async () => {
          setStatus(`Searching ${projectState.active.name}...`, "busy");
          return retrieveActiveProjectContext(content);
        })()
      : null;

    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-token-gen-user": chatUserId,
        "x-token-gen-user-source": isLoopbackHost() ? "local-development" : "cloudflare-access",
      },
      body: JSON.stringify(await buildPayload(chatUserId, projectContext)),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(text || "Chat stream request failed");
    }

    const assistantIndex = appendAssistantMessage("");
    if (projectContext?.metadata) attachProjectContext(assistantIndex, projectContext.metadata);
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
    messages.push(createMessage("assistant", `Request failed: ${error.message}`));
    setStatus("Chat request failed", "bad");
  } finally {
    updateSendState();
    els.input.disabled = !chatReady;
    els.input.focus();
    renderMessages(false);
    scheduleConversationSave(0);
  }
}

function imageSettings() {
  const dimensions = imageDimensions();
  const samples = Math.round(clampNumber(els.imageSamples.value, 1, 1, 4));
  const quality = IMAGE_QUALITY_SETTINGS[els.imageQuality.value] || IMAGE_QUALITY_SETTINGS.standard;
  const creativity = IMAGE_CREATIVITY_SETTINGS[els.imageCreativity.value] || IMAGE_CREATIVITY_SETTINGS["0.50"];
  const preservation = IMAGE_EDIT_PRESERVATION_SETTINGS[els.imageEditPreservation.value] || IMAGE_EDIT_PRESERVATION_SETTINGS.strict;
  const editStrength = clampNumber(els.imageEditStrength.value, preservation.strength, 0.05, 0.8);
  const upscaleScale = Math.round(clampNumber(els.imageUpscaleScale.value, 2, 1, 4));
  return {
    ...dimensions,
    samples,
    qualityKey: els.imageQuality.value,
    qualityLabel: quality.label,
    qualityPrompt: quality.prompt,
    styleKey: els.imageStyle.value,
    styleLabel: IMAGE_STYLE_LABELS[els.imageStyle.value] || "No style",
    creativityKey: els.imageCreativity.value,
    creativity: creativity.value,
    creativityLabel: creativity.label,
    creativityPrompt: creativity.prompt,
    orientationLabel: IMAGE_ORIENTATION_LABELS[els.imageOrientation.value] || "Square",
    contentFilterKey: els.imageContentFilter.value,
    contentRating: els.imageContentFilter.value || "standard",
    contentFilterLabel: IMAGE_CONTENT_FILTER_LABELS[els.imageContentFilter.value] || "Standard",
    preservationKey: els.imageEditPreservation.value,
    preservation: preservation.value,
    preservationLabel: preservation.label,
    preservationPrompt: preservation.prompt,
    editStrength,
    upscaleScale,
    upscaleMethod: els.imageUpscaleMethod.value || "lanczos",
    samplerName: els.imageSampler.value || "res_multistep",
    scheduler: els.imageScheduler.value || "simple",
    steps: quality.steps,
    cfg: quality.cfg,
  };
}

function imageSummary(settings) {
  return `${settings.width} x ${settings.height} / ${settings.qualityLabel} / ${settings.orientationLabel} / ${settings.creativityLabel}`;
}

function imageNegativePrompt(extra = []) {
  return [
    "text",
    "letters",
    "words",
    "numbers",
    "typography",
    "prompt text",
    "instruction text",
    "requirement text",
    "requirements",
    "rendered prompt",
    "visible writing",
    "annotations",
    "watermark",
    "signature",
    "caption",
    "subtitles",
    "signage",
    "browser chrome",
    "web page",
    "screenshot",
    "user interface",
    "settings panel",
    "control panel",
    "labels",
    "blank white rectangle",
    "white box",
    "border",
    "frame",
    "matte",
    "blurry",
    "distorted hands",
    "low quality",
    ...extra,
  ].join(", ");
}

function buildImagePayload(prompt, settings, sampleIndex) {
  return {
    prompt: buildStyledImagePrompt(prompt, "new", settings),
    negative_prompt: imageNegativePrompt(),
    width: settings.width,
    height: settings.height,
    steps: settings.steps,
    cfg: settings.cfg,
    quality: settings.qualityKey,
    creativity: settings.creativity,
    content_rating: settings.contentRating,
    sampler_name: settings.samplerName,
    scheduler: settings.scheduler,
    seed: Date.now() + sampleIndex,
    n: 1,
    filename_prefix: "token_gen_chat",
  };
}

async function submitImageGeneration(prompt, settings, sampleIndex, signal) {
  throwIfImageStopped(signal);
  const payload = buildImagePayload(prompt, settings, sampleIndex);
  const job = await createBackgroundJob("generation", payload, prompt, sampleIndex, settings.samples, signal);
  if (job) return { jobId: job.id, promptId: job.prompt_id, managed: true };
  const res = await fetch(`${API_BASE}/api/image/generations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false || !json.prompt_id) {
    throw new Error(json.error || json.message || `Image generation failed: HTTP ${res.status}`);
  }
  return { promptId: json.prompt_id, managed: false };
}

async function buildImageEditPayload(prompt, settings, sampleIndex, source, sourceMode) {
  if (!source) throw new Error("Select or upload a source image first.");
  const preparedSource = await resizeImageSourceForEdit(source, settings);
  const payload = {
    prompt: buildStyledImagePrompt(prompt, sourceMode, settings),
    negative_prompt: imageNegativePrompt([
      "unrequested clothing changes",
      "unrequested pose changes",
      "changed identity",
      "changed facial features",
      "changed hand positions",
      "changed relationship between people",
      "unrequested background redesign",
    ]),
    strength: settings.editStrength,
    denoise: settings.editStrength,
    steps: settings.steps,
    cfg: settings.cfg,
    quality: settings.qualityKey,
    creativity: settings.creativity,
    content_rating: settings.contentRating,
    preservation: settings.preservation,
    sampler_name: settings.samplerName,
    scheduler: settings.scheduler,
    seed: Date.now() + sampleIndex,
    filename_prefix: "token_gen_chat_edit",
  };
  payload.image_base64 = preparedSource.image_base64;
  payload.source_filename_prefix = preparedSource.name || "token-gen-source";
  if (sourceMode === "edit" && activeImageMask) {
    const preparedMask = await resizeImageSourceForEdit(activeImageMask, settings);
    payload.mask_base64 = preparedMask.image_base64;
  }
  return payload;
}

async function buildImageUpscalePayload(settings, sampleIndex, source) {
  if (!source) throw new Error("Upload an image or choose Iterate on a generated image first.");
  const dataUrl = await sourceImageDataUrl(source);
  const payload = {
    image_base64: dataUrl,
    scale: settings.upscaleScale,
    width: settings.width,
    height: settings.height,
    method: settings.upscaleMethod,
    filename_prefix: `token_gen_chat_upscale_${sampleIndex + 1}`,
  };
  return payload;
}

async function downloadImage(url, filename) {
  const absoluteUrl = absoluteImageUrl(url);
  const safeName = filename || "token-gen-image.png";
  if (!absoluteUrl) throw new Error("Image URL is unavailable.");
  const response = await fetch(absoluteUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = safeName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}

function imageStoppedError() {
  const error = new Error("Image generation stopped.");
  error.name = "AbortError";
  return error;
}

function throwIfImageStopped(signal) {
  if (signal?.aborted) throw imageStoppedError();
}

function waitForImagePoll(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(imageStoppedError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(imageStoppedError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, IMAGE_POLL_INTERVAL_MS);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function submitImageEdit(prompt, settings, sampleIndex, source, sourceMode, signal) {
  const payload = await buildImageEditPayload(prompt, settings, sampleIndex, source, sourceMode);
  throwIfImageStopped(signal);
  const job = await createBackgroundJob("edit", payload, prompt, sampleIndex, settings.samples, signal);
  if (job) return { jobId: job.id, promptId: job.prompt_id, managed: true };
  const res = await fetch(`${API_BASE}/api/image/edits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false || !json.prompt_id) {
    throw new Error(json.error || json.message || `Image edit failed: HTTP ${res.status}`);
  }
  return { promptId: json.prompt_id, managed: false };
}

async function submitImageUpscale(prompt, settings, sampleIndex, source, signal) {
  const payload = await buildImageUpscalePayload(settings, sampleIndex, source);
  throwIfImageStopped(signal);
  const job = await createBackgroundJob("upscale", payload, prompt, sampleIndex, settings.samples, signal);
  if (job) return { jobId: job.id, promptId: job.prompt_id, managed: true };
  const res = await fetch(`${API_BASE}/api/image/upscale`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false || !json.prompt_id) {
    throw new Error(json.error || json.message || `Image upscale failed: HTTP ${res.status}`);
  }
  return { promptId: json.prompt_id, managed: false };
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

async function pollImageGeneration(handle, signal) {
  const jobId = typeof handle === "object" ? handle.jobId : null;
  const promptId = typeof handle === "object" ? handle.promptId : handle;
  while (true) {
    await waitForImagePoll(signal);
    throwIfImageStopped(signal);
    if (jobId) {
      const { json } = await jobRequest(`/${encodeURIComponent(jobId)}`, { signal });
      const job = json.job;
      if (!job?.id) throw new Error("The background job queue returned an invalid response.");
      upsertBackgroundJob(job);
      if (job.status === "completed" && Array.isArray(job.outputs) && job.outputs.length) return job.outputs;
      if (job.status === "failed") throw new Error(job.error || "Image generation failed.");
      continue;
    }
    const res = await fetch(`${API_BASE}/api/image/history/${encodeURIComponent(promptId)}`, {
      cache: "no-store",
      signal,
    });
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
}

async function generateImageSamplesSequentially(prompt, assistantIndex, signal) {
  const settings = imageSettings();
  const outputs = [];
  const handles = [];
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Queueing sample ${index + 1} of ${settings.samples}...`,
      content: "",
    });
    handles.push(await submitImageGeneration(prompt, settings, index, signal));
  }
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    const label = `sample ${index + 1} of ${settings.samples}`;
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Generating ${label}...`,
      content: outputs.length ? "Still generating the remaining samples." : "",
    });
    setStatus(`Generating image ${index + 1} of ${settings.samples}...`, "busy");
    updateAssistantImageMessage(assistantIndex, { imageProgress: `Rendering ${label}...` });
    const sampleOutputs = await pollImageGeneration(handles[index], signal);
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

async function generateImageEditSamplesSequentially(prompt, assistantIndex, sourceMode, signal) {
  const settings = imageSettings();
  const source = activeImageSource;
  const outputs = [];
  const handles = [];
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Queueing sample ${index + 1} of ${settings.samples}...`,
      content: "",
    });
    handles.push(await submitImageEdit(prompt, settings, index, source, sourceMode, signal));
  }
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    const label = `sample ${index + 1} of ${settings.samples}`;
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `${sourceMode === "style" ? "Using source style for" : sourceMode === "restyle" ? "Restyling" : "Editing"} ${label}...`,
      content: outputs.length ? "Still generating the remaining samples." : "",
    });
    setStatus(`${sourceMode === "style" ? "Generating style reference image" : sourceMode === "restyle" ? "Restyling image" : "Editing image"} ${index + 1} of ${settings.samples}...`, "busy");
    updateAssistantImageMessage(assistantIndex, { imageProgress: `Rendering ${label}...` });
    const sampleOutputs = await pollImageGeneration(handles[index], signal);
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

async function generateImageUpscaleSamplesSequentially(prompt, assistantIndex, signal) {
  const settings = imageSettings();
  const source = activeImageSource;
  const outputs = [];
  const handles = [];
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Queueing sample ${index + 1} of ${settings.samples}...`,
      content: "",
    });
    handles.push(await submitImageUpscale(prompt, settings, index, source, signal));
  }
  for (let index = 0; index < settings.samples; index += 1) {
    throwIfImageStopped(signal);
    const label = `sample ${index + 1} of ${settings.samples}`;
    updateAssistantImageMessage(assistantIndex, {
      imageProgress: `Enhancing ${label}...`,
      content: outputs.length ? "Still enhancing the remaining samples." : "",
    });
    setStatus(`Enhancing image ${index + 1} of ${settings.samples}...`, "busy");
    updateAssistantImageMessage(assistantIndex, { imageProgress: `Rendering enhanced ${label}...` });
    const sampleOutputs = await pollImageGeneration(handles[index], signal);
    for (const output of sampleOutputs) {
      const imageRef = outputImageReference(output);
      outputs.push({
        ...output,
        ...(imageRef || {}),
        prompt,
        quality: "Deterministic enhance",
        size: `${settings.width} x ${settings.height} / ${settings.upscaleScale}x / ${settings.upscaleMethod}`,
        alt: prompt,
        url: absoluteImageUrl(output.url),
      });
    }
    updateAssistantImageMessage(assistantIndex, {
      imageOutputs: [...outputs],
      imageProgress: index + 1 < settings.samples ? `Completed ${label}. Starting next sample...` : "",
      content: index + 1 < settings.samples ? "Choose any completed sample, or wait for the rest." : "Image enhance complete.",
    });
  }
}

async function sendImageMessage(content, sourceVisionImages = []) {
  if (!imageGenerationSupported) {
    setStatus("Image generation is unavailable", "bad");
    return;
  }
  if (activeImageAbortController) return;
  activeImageAbortController = new AbortController();
  const signal = activeImageAbortController.signal;
  const visionImages = sourceVisionImages.length ? await prepareVisionImagesForSend(sourceVisionImages) : [];
  messages.push(createMessage("user", content, { visionImages }));
  const assistantIndex = appendAssistantMessage("");
  updateAssistantImageMessage(assistantIndex, {
    imagePrompt: content,
    imageOutputs: [],
    imageProgress: "Preparing image generation...",
  });
  updateSendState();
  els.input.disabled = true;
  scheduleConversationSave(0);

  try {
    const sourceMode = els.imageSourceMode.value;
      if (sourceMode === "edit" || sourceMode === "restyle" || sourceMode === "style" || sourceMode === "upscale") {
      if (!activeImageSource) {
        throw new Error(sourceMode === "style"
          ? "Upload an image to use as the style reference."
          : "Upload an image or choose Iterate on a generated image first.");
      }
      if (sourceMode === "upscale") {
        await generateImageUpscaleSamplesSequentially(content, assistantIndex, signal);
      } else {
        await generateImageEditSamplesSequentially(content, assistantIndex, sourceMode, signal);
      }
    } else {
      await generateImageSamplesSequentially(content, assistantIndex, signal);
    }
    setStatus(`Image generation complete at ${new Date().toLocaleTimeString("en-AU")}`, "good");
  } catch (error) {
    const stopped = error.name === "AbortError" || signal.aborted;
    updateAssistantImageMessage(assistantIndex, {
      content: stopped
        ? jobState.available
          ? "Stopped watching. Submitted images continue in Background jobs."
          : "Image generation stopped."
        : `Image request failed: ${error.message}`,
      imageProgress: "",
    });
    setStatus(stopped ? "Image generation stopped" : "Image request failed", stopped ? "good" : "bad");
  } finally {
    activeImageAbortController = null;
    updateSendState();
    els.input.disabled = false;
    els.input.focus();
    renderMessages(false);
    scheduleConversationSave(0);
  }
}

function autosizeInput() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(180, els.input.scrollHeight)}px`;
}

function syncImageEditStrengthValue() {
  if (!els.imageEditStrengthValue) return;
  const value = clampNumber(els.imageEditStrength.value, 0.25, 0.05, 0.8).toFixed(2);
  els.imageEditStrengthValue.value = value;
  els.imageEditStrengthValue.textContent = value;
}

function applyRestyleDefaults() {
  els.imageEditPreservation.value = "flexible";
  els.imageEditStrength.value = "0.65";
  if (els.imageCreativity.value === "0.25") els.imageCreativity.value = "0.50";
  syncImageEditStrengthValue();
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeImageAbortController) {
    activeImageAbortController.abort();
    els.send.disabled = true;
    setStatus("Stopping image generation...", "busy");
    return;
  }
  const content = els.input.value.trim();
  if (!content || els.send.disabled) return;
  els.input.value = "";
  autosizeInput();
  if (isImageModeForPrompt(content)) {
    const sourceVisionImages = [...attachedVisionImages];
    if (sourceVisionImages.length) {
      const source = sourceVisionImages[0];
      setActiveImageSource({
        kind: source.dataUrl ? "base64" : "url",
        name: source.name,
        mimeType: source.mimeType,
        image_base64: source.dataUrl,
        previewUrl: source.dataUrl || source.url || source.previewUrl,
        url: source.url,
      });
      if (els.imageSourceMode.value === "new") {
        els.imageSourceMode.value = IMAGE_EDIT_INTENT_PATTERN.test(content) ? "edit" : "style";
      }
      clearAttachedVisionImages({ release: false });
    }
    sendImageMessage(content, sourceVisionImages);
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
  if (els.activeModel) els.activeModel.textContent = modelLabel(getSelectedModel().id);
  if (chatReady) setStatus(`Connected to ${modelLabel(getSelectedModel().id)}`, "good");
  syncVisionCapability();
  renderDocuments();
});

els.mode.addEventListener("change", () => {
  syncModeUI();
  updateSendState();
  if (getMode() === "image" && !imageGenerationSupported) {
    setStatus("Image generation is unavailable", "bad");
  } else if (getMode() === "chat" && chatReady) {
    setStatus(`Connected to ${modelLabel(getSelectedModel().id)}`, "good");
  }
});

els.imageSourceMode.addEventListener("change", () => {
  if (els.imageSourceMode.value !== "new" && !activeImageSource) {
    setStatus(els.imageSourceMode.value === "style"
      ? "Upload a style reference image"
      : "Upload an image or choose Iterate on a generated image", "busy");
  }
  if (els.imageSourceMode.value === "restyle") {
    applyRestyleDefaults();
    if (els.imageStyle.value === "none") {
      setStatus("Choose a style preset or describe the style change in your prompt", "busy");
    }
  }
  renderImageSourcePreview();
});

els.imageSamples.addEventListener("input", () => {
  els.imageSamples.value = String(Math.round(clampNumber(els.imageSamples.value, 1, 1, 4)));
});

els.imageEditPreservation.addEventListener("change", () => {
  const preset = IMAGE_EDIT_PRESERVATION_SETTINGS[els.imageEditPreservation.value] || IMAGE_EDIT_PRESERVATION_SETTINGS.strict;
  els.imageEditStrength.value = preset.strength.toFixed(2);
  syncImageEditStrengthValue();
});

els.imageEditStrength.addEventListener("input", () => {
  syncImageEditStrengthValue();
});

els.imageEditStrength.addEventListener("change", () => {
  els.imageEditStrength.value = clampNumber(els.imageEditStrength.value, 0.25, 0.05, 0.8).toFixed(2);
  syncImageEditStrengthValue();
});

els.imageStyle.addEventListener("change", () => {
  if (activeImageSource && els.imageStyle.value !== "none" && els.imageSourceMode.value === "edit") {
    els.imageSourceMode.value = "restyle";
    applyRestyleDefaults();
    setStatus("Restyle mode selected for the uploaded source image", "good");
  }
});

els.imageUploadButton.addEventListener("click", () => {
  els.imageUpload.click();
});

els.imageMaskUploadButton.addEventListener("click", () => {
  els.imageMaskUpload.click();
});

els.documentsButton.addEventListener("click", () => {
  setAttachMenu(els.attachMenu.hidden);
});

els.attachDocument.addEventListener("click", () => {
  setAttachMenu(false);
  els.documents.click();
});

els.attachProjectDocument.addEventListener("click", () => {
  setAttachMenu(false);
  if (projectState.active) els.projectDocuments.click();
});

els.attachImage.addEventListener("click", () => {
  setAttachMenu(false);
  els.visionImages.click();
});

els.attachMask.addEventListener("click", () => {
  setAttachMenu(false);
  els.imageMaskUpload.click();
});

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.mode.value = button.dataset.chatMode;
    els.mode.dispatchEvent(new Event("change"));
    els.input.focus();
  });
});

els.settingsOpen.addEventListener("click", () => setSettingsOpen(true));
els.settingsClose.addEventListener("click", () => setSettingsOpen(false));
els.settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
els.jobsOpen.addEventListener("click", () => setJobsOpen(true));
els.jobsClose.addEventListener("click", () => setJobsOpen(false));
els.jobsBackdrop.addEventListener("click", () => setJobsOpen(false));
els.jobsRefresh.addEventListener("click", () => loadBackgroundJobs());
els.railOpen.addEventListener("click", () => setRailOpen(true));
els.railClose.addEventListener("click", () => setRailOpen(false));

els.projectManage.addEventListener("click", () => {
  setRailOpen(false);
  setSettingsOpen(true);
  requestAnimationFrame(() => els.projectSettings.scrollIntoView({ block: "start", behavior: "smooth" }));
});

[els.projectSelect, els.projectSettingsSelect].forEach((select) => {
  select.addEventListener("change", () => setActiveProject(select.value));
});

els.projectCreate.addEventListener("click", createProject);
els.projectCreateName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    createProject();
  }
});
els.projectSave.addEventListener("click", saveProjectDetails);
els.projectDelete.addEventListener("click", deleteActiveProject);
els.projectUpload.addEventListener("click", () => {
  if (projectState.active) els.projectDocuments.click();
});
els.projectDocuments.addEventListener("change", () => {
  uploadProjectDocuments(Array.from(els.projectDocuments.files || []));
});
els.projectDocumentList.addEventListener("click", (event) => {
  const download = event.target.closest("[data-project-document-download]");
  if (download) {
    downloadProjectDocument(download.dataset.projectDocumentDownload);
    return;
  }
  const remove = event.target.closest("[data-project-document-delete]");
  if (remove) deleteProjectDocument(remove.dataset.projectDocumentDelete);
});

els.webQuickToggle.addEventListener("click", () => {
  if (els.webSearch.disabled) return;
  els.webSearch.checked = !els.webSearch.checked;
  syncWebUI();
  setStatus(els.webSearch.checked ? "Web context enabled for the next message" : "Web context disabled", "good");
  els.input.focus();
});

els.webSearch.addEventListener("change", syncWebUI);

els.historyList.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-history-open]");
  if (openButton) {
    openStoredConversation(openButton.dataset.historyOpen);
    return;
  }
  const deleteButton = event.target.closest("[data-history-delete]");
  if (deleteButton) deleteStoredConversation(deleteButton.dataset.historyDelete);
});

els.historyRetention.addEventListener("change", async () => {
  const retention = els.historyRetention.value;
  historyState.defaultRetention = retention;
  historyState.currentRetention = retention;
  const preferenceSaved = await saveHistoryPreference(retention);
  if (retention === "none") {
    if (historyState.saveTimer) {
      clearTimeout(historyState.saveTimer);
      historyState.saveTimer = null;
    }
    await waitForConversationSave();
    const existingCopyDeleted = historyState.currentId
      ? await deleteStoredConversation(historyState.currentId, false)
      : true;
    if (existingCopyDeleted && preferenceSaved) {
      setHistoryStatus("Not saved", "good", "This chat stays only in this browser tab.");
    } else if (existingCopyDeleted) {
      setHistoryStatus("Not saved", "bad", "This chat stays in this tab, but the default preference could not be updated.");
    } else {
      setHistoryStatus("Delete failed", "bad", "New messages will not be saved, but the previous saved copy could not be deleted.");
    }
  } else {
    setHistoryStatus("Saving...", "neutral", retention === "forever"
      ? "This chat will be encrypted and kept until you delete it."
      : "This chat will be encrypted and kept for 30 days after its latest update.");
    scheduleConversationSave(0);
  }
  updateHistoryControls();
});

els.historyExport.addEventListener("click", exportCurrentConversation);
els.historyDelete.addEventListener("click", () => {
  if (historyState.currentId) deleteStoredConversation(historyState.currentId);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".chat-attach-wrap")) setAttachMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setAttachMenu(false);
  setSettingsOpen(false);
  setRailOpen(false);
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
    syncModeUI();
    if (els.imageSourceMode.value === "new") {
      els.imageSourceMode.value = els.imageStyle.value !== "none" ? "restyle" : "edit";
      if (els.imageSourceMode.value === "restyle") applyRestyleDefaults();
    }
    setStatus(`${file.name} ready for image edits`, "good");
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    els.imageUpload.value = "";
    els.imageUpload.disabled = false;
    updateSendState();
  }
});

els.visionImages.addEventListener("change", async () => {
  const files = Array.from(els.visionImages.files || []);
  if (!files.length) return;
  const limits = getVisionLimits();
  els.visionImages.disabled = true;
  setStatus(`Preparing ${files.length === 1 ? files[0].name : `${files.length} images`} locally...`, "busy");
  try {
    if (attachedVisionImages.length + files.length > limits.maxImages) {
      throw new Error(`Attach up to ${limits.maxImages} images per message.`);
    }
    const next = [...attachedVisionImages];
    for (const file of files) {
      const image = await readVisionImage(file);
      const totalBytes = next.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0) + image.sizeBytes;
      if (totalBytes > limits.maxTotalBytes) {
        releaseImagePreviewUrl(image);
        throw new Error(`Attached images may total up to ${Math.floor(limits.maxTotalBytes / 1024 / 1024)} MB.`);
      }
      next.push(image);
    }
    attachedVisionImages = next;
    renderVisionPreview();
    setStatus(visionSupported
      ? `${attachedVisionImages.length} image${attachedVisionImages.length === 1 ? "" : "s"} ready for local understanding or editing`
      : `${attachedVisionImages.length} image${attachedVisionImages.length === 1 ? "" : "s"} ready for image tools`, "good");
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    els.visionImages.value = "";
    els.visionImages.disabled = false;
    updateSendState();
  }
});

els.visionPreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-vision-remove]");
  if (!button) return;
  const image = attachedVisionImages.find((item) => item.id === button.dataset.visionRemove);
  if (image) releaseImagePreviewUrl(image);
  attachedVisionImages = attachedVisionImages.filter((item) => item.id !== button.dataset.visionRemove);
  renderVisionPreview();
  updateSendState();
});

els.imageMaskUpload.addEventListener("change", async () => {
  const file = els.imageMaskUpload.files?.[0];
  if (!file) return;
  els.imageMaskUpload.disabled = true;
  setStatus(`Reading mask ${file.name}...`, "busy");
  try {
    const mask = await readUploadedImage(file);
    setActiveImageMask(mask);
    els.mode.value = "image";
    syncModeUI();
    if (els.imageSourceMode.value === "new") els.imageSourceMode.value = "edit";
    setStatus(`${file.name} ready as an edit mask`, "good");
  } catch (error) {
    setStatus(error.message, "bad");
  } finally {
    els.imageMaskUpload.value = "";
    els.imageMaskUpload.disabled = false;
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

els.jobsList.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-job-add], [data-job-download], [data-job-dismiss]");
  if (!action) return;
  const jobId = action.dataset.jobAdd || action.dataset.jobDownload || action.dataset.jobDismiss;
  const job = jobState.jobs.find((item) => item.id === jobId);
  if (!job) return;
  const outputs = Array.isArray(job.outputs) ? job.outputs : [];
  try {
    if (action.dataset.jobAdd) {
      if (!outputs.length) throw new Error("This job does not have an image result.");
      const title = job.title || job.prompt || "Generated image";
      messages.push(createMessage("assistant", "Background image complete.", {
        imagePrompt: title,
        imageOutputs: outputs.map((output) => ({
          ...output,
          ...(outputImageReference(output) || {}),
          prompt: title,
          alt: title,
          quality: job.controls?.quality || "Background job",
          size: job.controls?.width && job.controls?.height ? `${job.controls.width} x ${job.controls.height}` : "",
          url: absoluteImageUrl(output.url),
        })),
      }));
      renderMessages();
      scheduleConversationSave(0);
      setJobsOpen(false);
      setStatus("Image added to this chat", "good");
      return;
    }
    if (action.dataset.jobDownload) {
      const output = outputs[0];
      if (!output?.url) throw new Error("This job does not have an image result.");
      action.disabled = true;
      await downloadImage(output.url, output.filename || "token-gen-image.png");
      setStatus("Image download started", "good");
      action.disabled = false;
      return;
    }
    if (action.dataset.jobDismiss) {
      const confirmed = window.confirm("Dismiss this completed job from the list? The generated image file is not deleted.");
      if (!confirmed) return;
      await jobRequest(`/${encodeURIComponent(job.id)}`, { method: "DELETE" });
      jobState.jobs = jobState.jobs.filter((item) => item.id !== job.id);
      renderBackgroundJobs();
    }
  } catch (error) {
    action.disabled = false;
    setStatus(error.message, "bad");
  }
});

els.thread.addEventListener("click", (event) => {
  const attachAction = event.target.closest('[data-chat-action="attach-document"]');
  if (attachAction) {
    els.documents.click();
    return;
  }

  const suggestion = event.target.closest("[data-chat-suggestion]");
  if (suggestion) {
    els.input.value = suggestion.dataset.chatSuggestion || "";
    if (suggestion.dataset.suggestionMode) {
      els.mode.value = suggestion.dataset.suggestionMode;
      els.mode.dispatchEvent(new Event("change"));
    }
    if (suggestion.dataset.suggestionWeb === "true" && !els.webSearch.disabled) {
      els.webSearch.checked = true;
      syncWebUI();
    }
    autosizeInput();
    els.input.focus();
    return;
  }

  const codeCopy = event.target.closest("[data-code-copy]");
  if (codeCopy) {
    const code = codeCopy.closest(".chat-code-block")?.querySelector("code")?.textContent || "";
    navigator.clipboard.writeText(code).then(() => {
      codeCopy.textContent = "Copied";
      setTimeout(() => { codeCopy.textContent = "Copy"; }, 1500);
    }).catch(() => setStatus("Could not copy code", "bad"));
    return;
  }

  const messageCopy = event.target.closest("[data-message-copy]");
  if (messageCopy) {
    const message = messages[Number(messageCopy.dataset.messageCopy)];
    navigator.clipboard.writeText(message?.content || "")
      .then(() => setStatus("Response copied", "good"))
      .catch(() => setStatus("Could not copy response", "bad"));
    return;
  }

  const downloadButton = event.target.closest("[data-image-download]");
  if (downloadButton) {
    event.preventDefault();
    const url = downloadButton.dataset.imageDownload || "";
    const filename = downloadButton.dataset.imageDownloadName || "token-gen-image.png";
    downloadButton.disabled = true;
    setStatus("Preparing image download...", "busy");
    downloadImage(url, filename)
      .then(() => setStatus("Image download started", "good"))
      .catch((error) => {
        setStatus(`Download failed: ${error.message}`, "bad");
        window.open(absoluteImageUrl(url), "_blank", "noopener,noreferrer");
      })
      .finally(() => {
        downloadButton.disabled = false;
      });
    return;
  }
  const analyzeButton = event.target.closest("[data-image-analyze]");
  if (analyzeButton) {
    const limits = getVisionLimits();
    if (!visionSupported) {
      setStatus("The active local model is not running with image understanding", "bad");
      return;
    }
    if (attachedVisionImages.length >= limits.maxImages) {
      setStatus(`Attach up to ${limits.maxImages} images per message`, "bad");
      return;
    }
    const url = analyzeButton.dataset.imageAnalyze || "";
    attachedVisionImages.push({
      id: globalThis.crypto?.randomUUID?.() || `vision-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: "generated",
      name: analyzeButton.dataset.imageAnalyzeName || "Generated image",
      mimeType: "image/png",
      url,
      previewUrl: url,
    });
    els.mode.value = "auto";
    syncModeUI();
    renderVisionPreview();
    setStatus("Image attached. Ask a question about it.", "good");
    els.input.focus();
    return;
  }
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
  syncModeUI();
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

els.imageMaskPreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-image-mask-clear]");
  if (!button) return;
  clearActiveImageMask();
  updateSendState();
});

els.clear.addEventListener("click", async () => {
  if (historyState.available && historyState.currentRetention !== "none") {
    await flushConversationSave();
  }
  releaseConversationVisionPreviews();
  messages = [welcomeMessage()];
  historyState.currentId = null;
  historyState.currentVersion = null;
  historyState.currentRetention = historyState.defaultRetention;
  els.historyRetention.value = historyState.currentRetention;
  uploadedDocuments = [];
  renderDocuments();
  clearAttachedVisionImages();
  clearActiveImageSource();
  clearActiveImageMask();
  els.mode.value = "auto";
  syncModeUI();
  els.input.value = "";
  autosizeInput();
  setRailOpen(false);
  setStatus(chatReady ? `Connected to ${modelLabel(getSelectedModel().id)}` : "Connecting to Token Gen...", chatReady ? "good" : "neutral");
  renderMessages(false);
  renderConversationHistory();
  setHistoryStatus(historyState.currentRetention === "none" ? "Not saved" : "New private chat", "good",
    historyState.currentRetention === "none"
      ? "This chat stays only in this browser tab."
      : "This chat will be saved privately after you send a message.");
  els.input.focus();
});

renderMessages(false);
renderDocuments();
renderVisionPreview();
renderImageSourcePreview();
renderImageMaskPreview();
renderProjectState();
renderBackgroundJobs();
syncImageEditStrengthValue();
syncModeUI();
syncWebUI();
loadConversationHistory();
loadProjects();
loadBackgroundJobs();
loadModels().catch((error) => {
  setStatus(error.message, "bad");
});
loadWebSearchCapability();
loadImageCapability();

window.addEventListener("focus", () => {
  if (!historyState.available && !historyState.loading) loadConversationHistory();
  if (!jobState.available && !jobState.loading) loadBackgroundJobs();
  else refreshActiveJobs({ immediate: true });
});
