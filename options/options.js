const addRuleForm = document.getElementById("addRuleForm");
const domainInput = document.getElementById("domainInput");
const feedbackElement = document.getElementById("feedback");
const storageNoteElement = document.getElementById("storageNote");
const ruleCountElement = document.getElementById("ruleCount");
const ruleListElement = document.getElementById("ruleList");
const emptyStateElement = document.getElementById("emptyState");

function setFeedback(message, isError = false) {
  feedbackElement.textContent = message;
  feedbackElement.style.color = isError ? "#7a3528" : "#5e584d";
}

function renderStorageStatus(storageArea) {
  storageNoteElement.textContent =
    storageArea === "sync"
      ? "Saved rules are stored in Firefox Sync when Add-ons sync is enabled."
      : "Saved rules are currently stored only on this device.";
}

function renderRules(domains) {
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

    const copy = document.createElement("span");
    copy.className = "rule-copy";
    copy.textContent = `Also matches subdomains of ${domain}.`;

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.dataset.domain = domain;

    meta.append(host, copy);
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

addRuleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const rawValue = domainInput.value;
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
  setFeedback(`Saved rule for ${response.domain}. Reload the site to apply it.`);
  renderRules(response.domains ?? []);
});

ruleListElement.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.domain) {
    return;
  }

  const response = await browser.runtime.sendMessage({
    type: "remove-domain",
    domain: target.dataset.domain
  });

  if (!response?.ok) {
    setFeedback("That rule could not be removed.", true);
    return;
  }

  setFeedback(
    `Removed ${response.domain}. Reload open tabs on that site to restore images.`
  );
  renderStorageStatus(response.storageArea);
  renderRules(response.domains ?? []);
});

void refreshRules().catch((error) => {
  console.error(error);
  setFeedback("The saved rules could not be loaded.", true);
});
