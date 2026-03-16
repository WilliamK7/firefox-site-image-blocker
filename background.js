const STORAGE_KEY = "blockedDomains";

let blockedDomainsCache = [];
let blockedDomainsBySpecificity = [];
let blockedDomainsReady = false;
let blockedDomainsPromise = null;
let primaryStorageAreaName = "sync";

function getStorageArea(areaName) {
  return browser.storage[areaName];
}

function getStorageMetadata() {
  return {
    storageArea: primaryStorageAreaName,
    usesFirefoxSync: primaryStorageAreaName === "sync"
  };
}

function normalizeDomainInput(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmedValue = rawValue.trim().toLowerCase();

  if (!trimmedValue) {
    return null;
  }

  const schemeLessValue = trimmedValue.replace(/^\*\./, "");

  try {
    const parsedUrl = new URL(
      schemeLessValue.includes("://")
        ? schemeLessValue
        : `https://${schemeLessValue}`
    );

    return parsedUrl.hostname.replace(/\.$/, "");
  } catch {
    if (/^[a-z0-9.-]+$/.test(schemeLessValue)) {
      return schemeLessValue.replace(/\.$/, "");
    }

    return null;
  }
}

function normalizeDomainList(rawDomains) {
  if (!Array.isArray(rawDomains)) {
    return [];
  }

  return [...new Set(rawDomains.map(normalizeDomainInput).filter(Boolean))].sort();
}

function updateBlockedDomainsCache(rawDomains) {
  blockedDomainsCache = normalizeDomainList(rawDomains);
  blockedDomainsBySpecificity = [...blockedDomainsCache].sort(
    (left, right) => right.length - left.length
  );
  blockedDomainsReady = true;
  return blockedDomainsCache;
}

function findMatchingDomain(
  rawValue,
  blockedDomains = blockedDomainsBySpecificity
) {
  const normalizedDomain = normalizeDomainInput(rawValue);

  if (!normalizedDomain) {
    return null;
  }

  return blockedDomains.find(
    (blockedDomain) =>
      normalizedDomain === blockedDomain ||
      normalizedDomain.endsWith(`.${blockedDomain}`)
  ) ?? null;
}

async function loadBlockedDomains() {
  if (blockedDomainsReady) {
    return blockedDomainsCache;
  }

  if (!blockedDomainsPromise) {
    blockedDomainsPromise = initializeStorage().then(() => blockedDomainsCache)
      .finally(() => {
        blockedDomainsPromise = null;
      });
  }

  return blockedDomainsPromise;
}

async function mirrorDomainsToLocal(domains) {
  await browser.storage.local.set({ [STORAGE_KEY]: domains });
}

async function persistDomains(domains) {
  const storageArea = getStorageArea(primaryStorageAreaName);

  try {
    await storageArea.set({ [STORAGE_KEY]: domains });
  } catch (error) {
    if (primaryStorageAreaName !== "sync") {
      throw error;
    }

    console.warn("storage.sync write failed, falling back to storage.local", error);
    primaryStorageAreaName = "local";
    await browser.storage.local.set({ [STORAGE_KEY]: domains });
    return;
  }

  if (primaryStorageAreaName === "sync") {
    await mirrorDomainsToLocal(domains);
  }
}

async function initializeStorage() {
  const localResult = await browser.storage.local.get({ [STORAGE_KEY]: [] });
  const localDomains = normalizeDomainList(localResult[STORAGE_KEY]);
  const syncStorage = getStorageArea("sync");

  if (syncStorage) {
    try {
      const syncResult = await syncStorage.get({ [STORAGE_KEY]: [] });
      let syncDomains = normalizeDomainList(syncResult[STORAGE_KEY]);

      if (!syncDomains.length && localDomains.length) {
        syncDomains = localDomains;
        await syncStorage.set({ [STORAGE_KEY]: syncDomains });
      }

      updateBlockedDomainsCache(syncDomains);
      primaryStorageAreaName = "sync";
      await mirrorDomainsToLocal(syncDomains);
      return blockedDomainsCache;
    } catch (error) {
      console.warn("storage.sync is unavailable, falling back to storage.local", error);
    }
  }

  updateBlockedDomainsCache(localDomains);
  primaryStorageAreaName = "local";
  return blockedDomainsCache;
}

async function saveBlockedDomains(rawDomains) {
  updateBlockedDomainsCache(rawDomains);
  await persistDomains(blockedDomainsCache);
  return blockedDomainsCache;
}

async function getDomainState(rawDomain) {
  const domain = normalizeDomainInput(rawDomain);
  const blockedDomains = await loadBlockedDomains();
  const matchedDomain = domain
    ? findMatchingDomain(domain, blockedDomains)
    : null;

  return {
    blocked: Boolean(matchedDomain),
    domain,
    domains: blockedDomains,
    matchedDomain,
    ...getStorageMetadata()
  };
}

async function addDomain(rawDomain) {
  const domain = normalizeDomainInput(rawDomain);

  if (!domain) {
    return {
      error: "INVALID_DOMAIN",
      ok: false
    };
  }

  const blockedDomains = await loadBlockedDomains();

  if (blockedDomains.includes(domain)) {
    return {
      domain,
      domains: blockedDomains,
      ok: true,
      ...getStorageMetadata()
    };
  }

  const nextDomains = await saveBlockedDomains([...blockedDomains, domain]);

  return {
    domain,
    domains: nextDomains,
    ok: true,
    ...getStorageMetadata()
  };
}

async function removeDomain(rawDomain) {
  const domain = normalizeDomainInput(rawDomain);

  if (!domain) {
    return {
      error: "INVALID_DOMAIN",
      ok: false
    };
  }

  const blockedDomains = await loadBlockedDomains();
  const nextDomains = await saveBlockedDomains(
    blockedDomains.filter((blockedDomain) => blockedDomain !== domain)
  );

  return {
    domain,
    domains: nextDomains,
    ok: true,
    ...getStorageMetadata()
  };
}

async function toggleDomain(rawDomain, rawTargetDomain) {
  const domain = normalizeDomainInput(rawDomain);

  if (!domain) {
    return {
      error: "INVALID_DOMAIN",
      ok: false
    };
  }

  const blockedDomains = await loadBlockedDomains();
  const targetDomain = normalizeDomainInput(rawTargetDomain);
  const matchedDomain =
    targetDomain && blockedDomains.includes(targetDomain)
      ? targetDomain
      : findMatchingDomain(domain, blockedDomains);

  if (matchedDomain) {
    const nextDomains = await saveBlockedDomains(
      blockedDomains.filter((blockedDomain) => blockedDomain !== matchedDomain)
    );

    return {
      blocked: false,
      domain,
      domains: nextDomains,
      matchedDomain: null,
      ok: true,
      removedDomain: matchedDomain,
      ...getStorageMetadata()
    };
  }

  const nextDomains = await saveBlockedDomains([...blockedDomains, domain]);

  return {
    blocked: true,
    domain,
    domains: nextDomains,
    matchedDomain: domain,
    ok: true,
    ...getStorageMetadata()
  };
}

function shouldBlockImageRequest(details, blockedDomains) {
  if (!blockedDomains.length) {
    return false;
  }

  return [details.documentUrl, details.originUrl].some((urlValue) =>
    findMatchingDomain(urlValue, blockedDomains)
  );
}

async function injectHideImagesScript(details) {
  const blockedDomains = await loadBlockedDomains();

  if (!findMatchingDomain(details.url, blockedDomains)) {
    return;
  }

  try {
    await browser.tabs.executeScript(details.tabId, {
      file: "content/hide-images.js",
      frameId: details.frameId,
      runAt: "document_start"
    });
  } catch (error) {
    console.warn("Failed to inject hide-images.js", error);
  }
}

browser.runtime.onInstalled.addListener(() => {
  void loadBlockedDomains();
});

browser.runtime.onStartup.addListener(() => {
  void loadBlockedDomains();
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (!changes[STORAGE_KEY]) {
    return;
  }

  if (primaryStorageAreaName === "sync" && areaName === "local") {
    return;
  }

  if (areaName !== primaryStorageAreaName) {
    return;
  }

  updateBlockedDomainsCache(changes[STORAGE_KEY].newValue);

  if (areaName === "sync" && primaryStorageAreaName === "sync") {
    void mirrorDomainsToLocal(blockedDomainsCache);
  }
});

browser.runtime.onMessage.addListener((message) => {
  switch (message?.type) {
    case "add-domain":
      return addDomain(message.domain);

    case "get-blocked-domains":
      return loadBlockedDomains().then((domains) => ({
        domains,
        ...getStorageMetadata()
      }));

    case "get-domain-state":
      return getDomainState(message.domain);

    case "get-storage-info":
      return loadBlockedDomains().then(() => getStorageMetadata());

    case "remove-domain":
      return removeDomain(message.domain);

    case "toggle-domain":
      return toggleDomain(message.domain, message.targetDomain);

    default:
      return undefined;
  }
});

browser.webNavigation.onCommitted.addListener(
  (details) => {
    if (details.tabId < 0) {
      return;
    }

    void injectHideImagesScript(details);
  },
  {
    url: [
      {
        schemes: ["http", "https"]
      }
    ]
  }
);

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const blockedDomains = await loadBlockedDomains();

    if (!shouldBlockImageRequest(details, blockedDomains)) {
      return {};
    }

    return { cancel: true };
  },
  {
    types: ["image", "imageset"],
    urls: ["<all_urls>"]
  },
  ["blocking"]
);
