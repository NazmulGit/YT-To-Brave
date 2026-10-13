// Background service worker:
// - Intercepts navigation to YouTube
// - Talks to native host to launch external browser
// - Manages context menus, commands, and Picture-in-Picture
import { NATIVE_HOST_NAME, MESSAGE_TYPES, OPEN_MODES } from "../shared/constants.js";
import { getSettings, bumpStat, getStats, resetStats } from "../shared/storage.js";
import { isYouTubeUrl, shouldRedirect, isWatchableYouTubeUrl } from "../shared/url-utils.js";

const recentlyHandled = new Map();
const HANDLED_TTL_MS = 4000;

function markHandled(url) {
  recentlyHandled.set(url, Date.now());
  setTimeout(() => recentlyHandled.delete(url), HANDLED_TTL_MS);
}
function wasRecentlyHandled(url) {
  const t = recentlyHandled.get(url);
  return t && Date.now() - t < HANDLED_TTL_MS;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await rebuildContextMenus();
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html?welcome=1") });
  }
});

chrome.runtime.onStartup.addListener(rebuildContextMenus);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    rebuildContextMenus();
  }
});

async function rebuildContextMenus() {
  const settings = await getSettings();
  await new Promise((res) => chrome.contextMenus.removeAll(res));
  if (!settings.contextMenu) return;
  chrome.contextMenus.create({
    id: "open-link-in-brave",
    title: "Open link in " + browserLabel(settings.targetBrowser),
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: "open-page-in-brave",
    title: "Open this page in " + browserLabel(settings.targetBrowser),
    contexts: ["page"],
    documentUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
  });
  chrome.contextMenus.create({
    id: "open-pip",
    title: "Open in Picture-in-Picture",
    contexts: ["page", "link"],
    targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
    documentUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"],
  });
}

function browserLabel(b) {
  return ({
    brave: "Brave",
    firefox: "Firefox",
    edge: "Edge",
    chrome: "Chrome",
    opera: "Opera",
    vivaldi: "Vivaldi",
    custom: "default browser",
  })[b] || "Brave";
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!url) return;
  if (info.menuItemId === "open-link-in-brave" || info.menuItemId === "open-page-in-brave") {
    const settings = await getSettings();
    await launchExternal(url, settings);
  } else if (info.menuItemId === "open-pip") {
    await openPipForUrl(url);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (command === "open-current-in-brave" && tab.url) {
    const settings = await getSettings();
    await launchExternal(tab.url, settings);
  } else if (command === "toggle-pip" && tab.url) {
    await openPipForUrl(tab.url);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!isYouTubeUrl(url)) return;
  if (wasRecentlyHandled(url)) return;

  const settings = await getSettings();
  if (!shouldRedirect(url, settings)) return;

  if (settings.openMode === OPEN_MODES.PIP && isWatchableYouTubeUrl(url)) {
    markHandled(url);
    await openPipForUrl(url);
    if (settings.closeChromeTab) {
      try { await chrome.tabs.remove(details.tabId); } catch { /* ignore */ }
    }
    return;
  }

  if (settings.openMode === OPEN_MODES.ASK) {
    markHandled(url);
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("src/popup/ask.html") + "?url=" + encodeURIComponent(url),
    });
    return;
  }

  markHandled(url);
  const success = await launchExternal(url, settings);
  if (success && settings.closeChromeTab) {
    try { await chrome.tabs.remove(details.tabId); } catch { /* tab may be the only one */ }
  } else if (!success) {
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("src/popup/error.html") + "?url=" + encodeURIComponent(url),
    });
  }
});

export async function launchExternal(url, settings) {
  if (!settings) settings = await getSettings();
  const payload = {
    action: "open",
    url,
    browser: settings.targetBrowser,
    customPath: settings.customBrowserPath || "",
    mode: settings.openMode === OPEN_MODES.PIP ? OPEN_MODES.NEW_TAB : settings.openMode,
  };
  try {
    const response = await sendNative(payload);
    if (response?.ok) {
      await bumpStat("redirected", settings.targetBrowser);
      if (settings.showNotifications) {
        chrome.notifications?.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon48.png"),
          title: "Opened in " + browserLabel(settings.targetBrowser),
          message: shortUrl(url),
          silent: true,
        });
      }
      return true;
    }
    notifyError(response?.error || "Native host error");
    return false;
  } catch (err) {
    notifyError(err?.message || String(err));
    return false;
  }
}

function shortUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname + url.pathname;
  } catch {
    return u;
  }
}

function notifyError(msg) {
  chrome.notifications?.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
    title: "YT-to-Brave: couldn't open external browser",
    message: msg + "\nClick the extension icon → Settings → Test connection.",
    priority: 2,
  });
}

function sendNative(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function openPipForUrl(url) {
  if (!isWatchableYouTubeUrl(url)) return;
  const pipUrl = chrome.runtime.getURL("src/pip/pip.html") + "?src=" + encodeURIComponent(url);
  const settings = await getSettings();
  await chrome.windows.create({
    url: pipUrl,
    type: "popup",
    width: settings.pip.width,
    height: settings.pip.height + 36,
    focused: true,
  });
  await bumpStat("pipOpened");
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case MESSAGE_TYPES.OPEN_IN_BROWSER: {
        const settings = await getSettings();
        const ok = await launchExternal(msg.url, settings);
        sendResponse({ ok });
        break;
      }
      case MESSAGE_TYPES.TEST_NATIVE_HOST:
      case MESSAGE_TYPES.PING_NATIVE: {
        try {
          const r = await sendNative({ action: "ping" });
          sendResponse({ ok: !!r?.ok, info: r });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
        break;
      }
      case MESSAGE_TYPES.GET_SETTINGS: {
        sendResponse(await getSettings());
        break;
      }
      case MESSAGE_TYPES.OPEN_PIP: {
        await openPipForUrl(msg.url);
        sendResponse({ ok: true });
        break;
      }
      case MESSAGE_TYPES.GET_STATS: {
        sendResponse(await getStats());
        break;
      }
      case MESSAGE_TYPES.RESET_STATS: {
        await resetStats();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true;
});

