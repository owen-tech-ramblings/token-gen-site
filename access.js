(() => {
  "use strict";

  const API_PATH = "/api/private/access";
  const OWNER_EMAIL = "jesse@owenonthenet.com";
  const state = {
    activityFilter: "all",
    busy: false,
    data: { capturedAt: null, people: [], policyVersion: "" },
    editingEmail: "",
    removingEmail: "",
    search: "",
  };

  const elements = {
    activityEmpty: document.querySelector("#activityEmpty"),
    activityFilters: document.querySelector("#activityFilters"),
    activityList: document.querySelector("#activityList"),
    addPersonButton: document.querySelector("#addPersonButton"),
    authorisedCount: document.querySelector("#authorisedCount"),
    failedCount: document.querySelector("#failedCount"),
    pageAlert: document.querySelector("#pageAlert"),
    pageAlertText: document.querySelector("#pageAlertText"),
    peopleEmpty: document.querySelector("#peopleEmpty"),
    peopleList: document.querySelector("#peopleList"),
    peopleSearch: document.querySelector("#peopleSearch"),
    personDialog: document.querySelector("#personDialog"),
    personDialogKicker: document.querySelector("#personDialogKicker"),
    personDialogTitle: document.querySelector("#personDialogTitle"),
    personEmail: document.querySelector("#personEmail"),
    personForm: document.querySelector("#personForm"),
    personFormError: document.querySelector("#personFormError"),
    personName: document.querySelector("#personName"),
    personSubmit: document.querySelector("#personSubmit"),
    refreshButton: document.querySelector("#refreshButton"),
    removeCopy: document.querySelector("#removeCopy"),
    removeDialog: document.querySelector("#removeDialog"),
    removeForm: document.querySelector("#removeForm"),
    removeFormError: document.querySelector("#removeFormError"),
    removeSubmit: document.querySelector("#removeSubmit"),
    retryButton: document.querySelector("#retryButton"),
    signedInCount: document.querySelector("#signedInCount"),
    successfulCount: document.querySelector("#successfulCount"),
    syncStatus: document.querySelector("#syncStatus"),
    toast: document.querySelector("#toast"),
  };

  const dateFormatter = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
  let toastTimer;

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatDate(value) {
    if (!value) return "Never";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "Unknown" : dateFormatter.format(parsed);
  }

  function relativeDate(value) {
    if (!value) return "No successful sign-in recorded";
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "Time unavailable";
    const minutes = Math.round((timestamp - Date.now()) / 60000);
    const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 48) return relative.format(hours, "hour");
    return relative.format(Math.round(hours / 24), "day");
  }

  function displayName(person) {
    return person.name || person.email.split("@")[0];
  }

  function initials(person) {
    return (
      displayName(person)
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "?"
    );
  }

  function attemptBadge(kind, count) {
    const badge = node("span", `access-attempt-badge access-attempt-${kind}`);
    const dot = node("span", "access-status-dot");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(`${count} ${kind === "good" ? "successful" : "unsuccessful"}`));
    return badge;
  }

  function actionButton(label, action, email, danger = false) {
    const button = node("button", `access-row-button${danger ? " is-danger" : ""}`, label);
    button.type = "button";
    button.dataset.action = action;
    button.dataset.email = email;
    return button;
  }

  function personRow(person) {
    const row = node("div", "access-person-row");
    row.setAttribute("role", "row");

    const identity = node("div", "access-person-cell access-person-identity");
    identity.setAttribute("role", "cell");
    const avatar = node("span", "access-avatar", initials(person));
    avatar.setAttribute("aria-hidden", "true");
    const identityCopy = node("span", "access-person-copy");
    identityCopy.append(node("strong", "", person.name || "Name not set"), node("small", "", person.email));
    identity.append(avatar, identityCopy);

    const login = node("div", "access-person-cell access-last-login");
    login.setAttribute("role", "cell");
    login.append(
      node("span", "access-mobile-label", "Last successful login"),
      node("strong", "", formatDate(person.lastSuccessfulLogin)),
      node("small", "", relativeDate(person.lastSuccessfulLogin)),
    );

    const attempts = node("div", "access-person-cell access-attempts");
    attempts.setAttribute("role", "cell");
    attempts.append(
      node("span", "access-mobile-label", "Recent attempts"),
      attemptBadge("good", person.recentSuccessCount || 0),
      attemptBadge("bad", person.recentFailureCount || 0),
    );

    const actions = node("div", "access-person-cell access-row-actions");
    actions.setAttribute("role", "cell");
    actions.append(actionButton("Edit", "edit", person.email));
    if (person.email.toLowerCase() !== OWNER_EMAIL) {
      actions.append(actionButton("Remove", "remove", person.email, true));
    }

    row.append(identity, login, attempts, actions);
    return row;
  }

  function renderPeople() {
    const query = state.search.trim().toLowerCase();
    const people = state.data.people.filter((person) =>
      `${person.name || ""} ${person.email}`.toLowerCase().includes(query),
    );
    elements.peopleList.replaceChildren(...people.map(personRow));
    elements.peopleEmpty.hidden = people.length > 0;
  }

  function allActivity() {
    return state.data.people
      .flatMap((person) =>
        (person.attempts || []).map((attempt) => ({ ...attempt, email: person.email, name: person.name })),
      )
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  }

  function activityItem(activity) {
    const item = node("li", "access-activity-item");
    const status = node("span", `access-activity-status ${activity.allowed ? "is-good" : "is-bad"}`);
    status.setAttribute("aria-label", activity.allowed ? "Successful" : "Unsuccessful");
    const copy = node("div", "access-activity-copy");
    const heading = node("div", "access-activity-heading");
    heading.append(
      node("strong", "", displayName(activity)),
      node(
        "span",
        activity.allowed ? "access-outcome-good" : "access-outcome-bad",
        activity.allowed ? "Successful" : "Unsuccessful",
      ),
    );
    const details = [formatDate(activity.at), activity.method, activity.country].filter(Boolean).join(" · ");
    copy.append(heading, node("small", "", activity.email), node("small", "access-activity-meta", details));
    item.append(status, copy);
    return item;
  }

  function renderActivity() {
    const activity = allActivity().filter((entry) => {
      if (state.activityFilter === "success") return entry.allowed;
      if (state.activityFilter === "failed") return !entry.allowed;
      return true;
    });
    elements.activityList.replaceChildren(...activity.map(activityItem));
    elements.activityEmpty.hidden = activity.length > 0;
  }

  function renderMetrics() {
    const attempts = allActivity();
    elements.authorisedCount.textContent = String(state.data.people.length);
    elements.signedInCount.textContent = String(state.data.people.filter((person) => person.lastSuccessfulLogin).length);
    elements.successfulCount.textContent = String(attempts.filter((attempt) => attempt.allowed).length);
    elements.failedCount.textContent = String(attempts.filter((attempt) => !attempt.allowed).length);
  }

  function render() {
    renderMetrics();
    renderPeople();
    renderActivity();
    elements.syncStatus.textContent = state.data.capturedAt ? `Updated ${formatDate(state.data.capturedAt)}` : "";
  }

  function setPageError(message) {
    elements.pageAlertText.textContent = message;
    elements.pageAlert.hidden = !message;
  }

  function setFormError(element, message) {
    element.textContent = message;
    element.hidden = !message;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3600);
  }

  function setBusy(busy) {
    state.busy = busy;
    elements.addPersonButton.disabled = busy;
    elements.refreshButton.disabled = busy;
    elements.personSubmit.disabled = busy;
    elements.removeSubmit.disabled = busy;
    elements.refreshButton.classList.toggle("is-loading", busy);
  }

  async function apiRequest(method = "GET", body) {
    const response = await fetch(API_PATH, {
      method,
      credentials: "include",
      headers: body
        ? { "content-type": "application/json", "x-token-gen-admin": "1" }
        : { "x-token-gen-admin": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new ApiError(payload?.error?.message || "Something went wrong.", response.status, payload?.error?.code);
    }
    return payload.data;
  }

  async function loadDirectory({ quiet = false } = {}) {
    if (state.busy) return;
    setBusy(true);
    if (!quiet) setPageError("");
    try {
      state.data = await apiRequest();
      render();
      setPageError("");
    } catch (error) {
      setPageError(error instanceof ApiError ? error.message : "Access could not be loaded.");
      elements.syncStatus.textContent = "Unable to refresh";
    } finally {
      setBusy(false);
    }
  }

  function openAddDialog() {
    state.editingEmail = "";
    elements.personDialogKicker.textContent = "New person";
    elements.personDialogTitle.textContent = "Add access";
    elements.personSubmit.textContent = "Add person";
    elements.personName.value = "";
    elements.personEmail.value = "";
    elements.personEmail.readOnly = false;
    setFormError(elements.personFormError, "");
    elements.personDialog.showModal();
    elements.personName.focus();
  }

  function openEditDialog(email) {
    const person = state.data.people.find((candidate) => candidate.email === email);
    if (!person) return;
    state.editingEmail = person.email;
    elements.personDialogKicker.textContent = "Person details";
    elements.personDialogTitle.textContent = "Edit name";
    elements.personSubmit.textContent = "Save changes";
    elements.personName.value = person.name || "";
    elements.personEmail.value = person.email;
    elements.personEmail.readOnly = true;
    setFormError(elements.personFormError, "");
    elements.personDialog.showModal();
    elements.personName.focus();
  }

  function openRemoveDialog(email) {
    const person = state.data.people.find((candidate) => candidate.email === email);
    if (!person) return;
    state.removingEmail = person.email;
    elements.removeCopy.textContent = `Remove access for ${person.email}?`;
    setFormError(elements.removeFormError, "");
    elements.removeDialog.showModal();
    elements.removeSubmit.focus();
  }

  function closeDialog(dialog) {
    if (dialog.open && !state.busy) dialog.close();
  }

  async function refreshAfterConflict() {
    await loadDirectory({ quiet: true });
    setPageError("Access changed elsewhere. The list has been refreshed.");
  }

  elements.addPersonButton.addEventListener("click", openAddDialog);
  elements.refreshButton.addEventListener("click", () => loadDirectory());
  elements.retryButton.addEventListener("click", () => loadDirectory());

  elements.peopleSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderPeople();
  });

  elements.peopleList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action][data-email]");
    if (!button || state.busy) return;
    if (button.dataset.action === "edit") openEditDialog(button.dataset.email);
    if (button.dataset.action === "remove") openRemoveDialog(button.dataset.email);
  });

  elements.activityFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activityFilter = button.dataset.filter;
    for (const candidate of elements.activityFilters.querySelectorAll("[data-filter]")) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    renderActivity();
  });

  for (const button of document.querySelectorAll("[data-close-person]")) {
    button.addEventListener("click", () => closeDialog(elements.personDialog));
  }
  for (const button of document.querySelectorAll("[data-close-remove]")) {
    button.addEventListener("click", () => closeDialog(elements.removeDialog));
  }

  elements.personForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    const name = elements.personName.value.trim();
    const email = elements.personEmail.value.trim().toLowerCase();
    setFormError(elements.personFormError, "");
    setBusy(true);
    try {
      if (state.editingEmail) {
        await apiRequest("PATCH", { email: state.editingEmail, name });
        elements.personDialog.close();
        showToast("Name updated.");
      } else {
        await apiRequest("POST", { email, name, policyVersion: state.data.policyVersion });
        elements.personDialog.close();
        showToast("Access added.");
      }
      setBusy(false);
      await loadDirectory({ quiet: true });
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 409) {
        elements.personDialog.close();
        await refreshAfterConflict();
        return;
      }
      setFormError(elements.personFormError, error instanceof ApiError ? error.message : "Changes could not be saved.");
    }
  });

  elements.removeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy || !state.removingEmail) return;
    setFormError(elements.removeFormError, "");
    setBusy(true);
    try {
      await apiRequest("DELETE", { email: state.removingEmail, policyVersion: state.data.policyVersion });
      elements.removeDialog.close();
      showToast("Access removed.");
      setBusy(false);
      await loadDirectory({ quiet: true });
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 409) {
        elements.removeDialog.close();
        await refreshAfterConflict();
        return;
      }
      setFormError(elements.removeFormError, error instanceof ApiError ? error.message : "Access could not be removed.");
    }
  });

  loadDirectory();
})();
