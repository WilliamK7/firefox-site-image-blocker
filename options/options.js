const addRuleForm = document.getElementById("addRuleForm");
const domainInput = document.getElementById("domainInput");
const feedbackElement = document.getElementById("feedback");
const exportRulesButton = document.getElementById("exportRulesButton");
const importFileInput = document.getElementById("importFileInput");
const importRulesButton = document.getElementById("importRulesButton");
const reloadTabsButton = document.getElementById("reloadTabsButton");
const storageNoteElement = document.getElementById("storageNote");
const themeToggleButton = document.getElementById("themeToggleButton");
const ruleCountElement = document.getElementById("ruleCount");
const ruleListElement = document.getElementById("ruleList");
const emptyStateElement = document.getElementById("emptyState");

const THEME_STORAGE_KEY = "optionsThemeMode";
const THEME_MODES = ["auto", "light", "dark"];

let currentDomains = [];
let currentThemeMode = "auto";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function setFeedback(message, isError = false) {
  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "#7a3528" : "#5e584d";
}

function setControlsDisabled(isDisabled) {
  reloadTabsButton.disabled = isDisabled;
  exportRulesButton.disabled = isDisabled;
  importRulesButton.disabled = isDisabled;
}

function getResolvedTheme(themeMode) {
  if (themeMode === "dark" || themeMode === "light") {
    return themeMode;
  }

  return systemThemeQuery.matches ? "dark" : "light";
}

function renderThemeButton() {
  const label =
    currentThemeMode.charAt(0).toUpperCase() + currentThemeMode.slice(1);
  themeToggleButton.textContent = `Theme: ${label}`;
}

function applyTheme(themeMode) {
  currentThemeMode = THEME_MODES.includes(themeMode) ? themeMode : "auto";
  document.documentElement.dataset.theme = getResolvedTheme(currentThemeMode);
  renderThemeButton();
}

async function loadThemePreference() {
  const result = await browser.storage.local.get({
    [THEME_STORAGE_KEY]: "auto"
  });

  applyTheme(result[THEME_STORAGE_KEY]);
}

async function cycleThemeMode() {
  const currentIndex = THEME_MODES.indexOf(currentThemeMode);
  const nextMode = THEME_MODES[(currentIndex + 1) % THEME_MODES.length];

  applyTheme(nextMode);
  await browser.storage.local.set({ [THEME_STORAGE_KEY]: nextMode });
}

function renderStorageStatus(storageArea) {
  storageNoteElement.textContent =
    storageArea === "sync"
      ? "Saved rules are stored in Firefox Sync when Add-ons sync is enabled."
      : "Saved rules are currently stored only on this device.";
}

function renderRules(domains) {
  currentDomains = [...domains];
  ruleListElement.replaceChildren();

  ruleCountElement.textContent =
    domains.length === 1 ? "1 rule" : `${domains.length} rules`;
  emptyStateElement.hidden = domains.length > 0;

  for (const domain of domains) {
    const item = document.createElement("li");
    item.className = "rule-item";

    const meta = document.createElement("div");
    meta.className = "rule-meta";

    const host = document.createElement("strong");
    host.className = "rule-host";
    host.textContent = domain;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.dataset.domain = domain;

    meta.append(host);
    item.append(meta, removeButton);
    ruleListElement.appendChild(item);
  }
}

async function refreshRules() {
  const response = await browser.runtime.sendMessage({
    type: "get-blocked-domains"
  });

  renderStorageStatus(response.storageArea);
  renderRules(response.domains ?? []);
}

function downloadRules(domains) {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    domains
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "site-image-blocker-rules.json";
  link.click();
  URL.revokeObjectURL(url);
}

function parseImportedDomains(rawText) {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(trimmedText);

    if (Array.isArray(parsedValue)) {
      return parsedValue;
    }

    if (Array.isArray(parsedValue?.domains)) {
      return parsedValue.domains;
    }
  } catch {
    return trimmedText
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

async function replaceDomains(domains) {
  return browser.runtime.sendMessage({
    type: "replace-domains",
    domains
  });
}

async function reloadAffectedTabs(domains) {
  return browser.runtime.sendMessage({
    type: "reload-affected-tabs",
    domains
  });
}

addRuleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setControlsDisabled(true);

  const rawValue = domainInput.value;
  try {
    const response = await browser.runtime.sendMessage({
      type: "add-domain",
      domain: rawValue
    });

    if (!response?.ok) {
      setFeedback("Enter a valid host name or full URL.", true);
      return;
    }

    domainInput.value = "";
    renderStorageStatus(response.storageArea);
    setFeedback(`Saved rule for ${response.domain}. Reload affected tabs when you are ready.`);
    renderRules(response.domains ?? []);
  } finally {
    setControlsDisabled(false);
  }
});

ruleListElement.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.domain) {
    return;
  }

  setControlsDisabled(true);

  try {
    const response = await browser.runtime.sendMessage({
      type: "remove-domain",
      domain: target.dataset.domain
    });

    if (!response?.ok) {
      setFeedback("That rule could not be removed.", true);
      return;
    }

    setFeedback(
      `Removed ${response.domain}. Reload affected tabs when you want to restore images.`
    );
    renderStorageStatus(response.storageArea);
    renderRules(response.domains ?? []);
  } finally {
    setControlsDisabled(false);
  }
});

reloadTabsButton.addEventListener("click", async () => {
  setControlsDisabled(true);

  try {
    const response = await reloadAffectedTabs(currentDomains);
    const message =
      response.refreshedTabs === 1
        ? "Reloaded 1 affected tab."
        : `Reloaded ${response.refreshedTabs} affected tabs.`;

    setFeedback(message);
  } catch (error) {
    console.error(error);
    setFeedback("Affected tabs could not be reloaded.", true);
  } finally {
    setControlsDisabled(false);
  }
});

exportRulesButton.addEventListener("click", () => {
  downloadRules(currentDomains);
  setFeedback(
    currentDomains.length
      ? `Exported ${currentDomains.length} saved rule${currentDomains.length === 1 ? "" : "s"}.`
      : "Exported an empty rules file."
  );
});

importRulesButton.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files ?? [];

  if (!file) {
    return;
  }

  setControlsDisabled(true);

  try {
    const importedText = await file.text();
    const importedDomains = parseImportedDomains(importedText);

    if (!importedDomains.length) {
      setFeedback("The selected file did not contain any usable host rules.", true);
      return;
    }

    const response = await replaceDomains(importedDomains);

    if (!response?.ok) {
      setFeedback("The selected file could not be imported.", true);
      return;
    }

    renderStorageStatus(response.storageArea);
    renderRules(response.domains ?? []);
    setFeedback(
      `Imported ${response.domains.length} blocked host${response.domains.length === 1 ? "" : "s"}.`
    );
  } catch (error) {
    console.error(error);
    setFeedback("The selected file could not be imported.", true);
  } finally {
    importFileInput.value = "";
    setControlsDisabled(false);
  }
});

themeToggleButton.addEventListener("click", () => {
  void cycleThemeMode().catch((error) => {
    console.error(error);
    setFeedback("The theme preference could not be saved.", true);
  });
});

systemThemeQuery.addEventListener("change", () => {
  if (currentThemeMode !== "auto") {
    return;
  }

  applyTheme("auto");
});

void loadThemePreference().catch((error) => {
  console.error(error);
  applyTheme("auto");
});

void refreshRules().catch((error) => {
  console.error(error);
  setFeedback("The saved rules could not be loaded.", true);
});
