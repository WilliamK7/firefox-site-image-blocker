const toggleButton = document.getElementById("toggleButton");
const optionsButton = document.getElementById("optionsButton");
const statusElement = document.getElementById("status");
const domainElement = document.getElementById("domain");
const ruleHintElement = document.getElementById("ruleHint");
const syncStatusElement = document.getElementById("syncStatus");

let currentTabId = null;
let currentDomain = null;
let currentMatchedDomain = null;

function setBusyState(isBusy) {
  toggleButton.disabled = isBusy;
}

function renderStorageStatus(storageArea) {
  syncStatusElement.textContent =
    storageArea === "sync"
      ? "Using Firefox Sync for saved rules"
      : "Using local storage on this device";
}

function renderUnsupportedState() {
  currentDomain = null;
  currentMatchedDomain = null;
  currentTabId = null;

  domainElement.textContent = "Unavailable";
  statusElement.textContent =
    "Open a regular http or https tab to manage image blocking.";
  ruleHintElement.textContent =
    "Firefox internal pages and extension pages cannot be toggled here.";
  toggleButton.textContent = "Unavailable on this tab";
  toggleButton.disabled = true;
}

function renderDomainState(domainState) {
  currentDomain = domainState.domain;
  currentMatchedDomain = domainState.matchedDomain;
  renderStorageStatus(domainState.storageArea);

  domainElement.textContent = domainState.domain;
  statusElement.textContent = domainState.blocked
    ? "Images are blocked for this site."
    : "Images load normally for this site.";
  ruleHintElement.textContent = domainState.blocked
    ? `Active rule: ${domainState.matchedDomain}. The tab reloads after changes.`
    : "The tab reloads after changes so image requests can be blocked cleanly.";
  toggleButton.textContent = domainState.blocked
    ? "Allow images on this site"
    : "Block images on this site";
  toggleButton.disabled = false;
}

async function loadCurrentTabState() {
  setBusyState(true);
  const storageInfo = await browser.runtime.sendMessage({
    type: "get-storage-info"
  });
  renderStorageStatus(storageInfo.storageArea);

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!activeTab?.id || !activeTab.url || !/^https?:/i.test(activeTab.url)) {
    renderUnsupportedState();
    return;
  }

  currentTabId = activeTab.id;
  currentDomain = new URL(activeTab.url).hostname.toLowerCase();

  const domainState = await browser.runtime.sendMessage({
    type: "get-domain-state",
    domain: currentDomain
  });

  renderDomainState(domainState);
}

toggleButton.addEventListener("click", async () => {
  if (!currentDomain || currentTabId === null) {
    return;
  }

  setBusyState(true);

  await browser.runtime.sendMessage({
    type: "toggle-domain",
    domain: currentDomain,
    targetDomain: currentMatchedDomain
  });

  await browser.tabs.reload(currentTabId);
  window.close();
});

optionsButton.addEventListener("click", async () => {
  await browser.runtime.openOptionsPage();
  window.close();
});

void loadCurrentTabState().catch((error) => {
  console.error(error);
  syncStatusElement.textContent = "Storage status unavailable";
  renderUnsupportedState();
});
