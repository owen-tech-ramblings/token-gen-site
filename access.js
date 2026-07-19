(() => {
  "use strict";

  const snapshotElement = document.querySelector("#accessSnapshot");
  const state = {
    activityFilter: "all",
    data: JSON.parse(snapshotElement?.textContent || '{"people":[]}'),
    search: "",
  };

  const elements = {
    activityEmpty: document.querySelector("#activityEmpty"),
    activityFilters: document.querySelector("#activityFilters"),
    activityList: document.querySelector("#activityList"),
    authorisedCount: document.querySelector("#authorisedCount"),
    failedCount: document.querySelector("#failedCount"),
    peopleEmpty: document.querySelector("#peopleEmpty"),
    peopleList: document.querySelector("#peopleList"),
    peopleSearch: document.querySelector("#peopleSearch"),
    signedInCount: document.querySelector("#signedInCount"),
    successfulCount: document.querySelector("#successfulCount"),
  };

  const dateFormatter = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });

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
    return displayName(person)
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?";
  }

  function attemptBadge(kind, count) {
    const badge = node("span", `access-attempt-badge access-attempt-${kind}`);
    const dot = node("span", "access-status-dot");
    dot.setAttribute("aria-hidden", "true");
    badge.append(dot, document.createTextNode(`${count} ${kind === "good" ? "successful" : "unsuccessful"}`));
    return badge;
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

    const status = node("div", "access-person-cell access-row-actions");
    status.setAttribute("role", "cell");
    status.append(node("span", "access-policy-status", "Authorised"));

    row.append(identity, login, attempts, status);
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
        person.attempts.map((attempt) => ({ ...attempt, email: person.email, name: person.name })),
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

  elements.peopleSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderPeople();
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

  renderMetrics();
  renderPeople();
  renderActivity();
})();
