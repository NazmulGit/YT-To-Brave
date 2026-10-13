import { MESSAGE_TYPES, OPEN_MODES } from "../shared/constants.js";
import { getSettings, setSettings, getStats } from "../shared/storage.js";
import { isYouTubeUrl, isWatchableYouTubeUrl } from "../shared/url-utils.js";

const els = {
  enabled: document.getElementById("enabledToggle"),
  url: document.getElementById("currentUrl"),
  openBtn: document.getElementById("openInBraveBtn"),
  pipBtn: document.getElementById("pipBtn"),
  modeSeg: document.getElementById("modeSeg"),
  browser: document.getElementById("browserSelect"),
  targetLabel: document.getElementById("targetBrowserLabel"),
  subtitle: document.getElementById("subtitle"),
  statRedir: document.getElementById("statRedirected"),
  statPip: document.getElementById("statPip"),
  hostDot: document.getElementById("hostDot"),
  hostLabel: document.getElementById("hostLabel"),
  options: document.getElementById("optionsBtn"),
  test: document.getElementById("testHostBtn"),
  toast: document.getElementById("toast"),
};

let currentTab;
let settings;

const BROWSER_LABEL = {
  brave: "Brave",
  firefox: "Firefox",
  edge: "Edge",
  chrome: "Chrome",
  opera: "Opera",
  vivaldi: "Vivaldi",
  custom: "Custom",
};

init();

async function init() {
  settings = await getSettings();
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  els.enabled.checked = settings.enabled;
  els.browser.value = settings.targetBrowser;
  updateTargetLabel();
  setActiveMode(settings.openMode);

  const url = currentTab?.url || "";
  els.url.textContent = url ? prettyUrl(url) : "No active tab";
  const yt = isYouTubeUrl(url);
  els.openBtn.disabled = !url;
  els.pipBtn.disabled = !isWatchableYouTubeUrl(url);
  if (!yt) els.subtitle.textContent = "Not a YouTube tab — buttons still work";


  loadStats();
  pingHost();

  bind();
}

function bind() {
  els.enabled.addEventListener("change", async () => {
    settings = await setSettings({ enabled: els.enabled.checked });
    toast(settings.enabled ? "Redirect enabled" : "Redirect paused");
  });

  els.openBtn.addEventListener("click", async () => {
    if (!currentTab?.url) return;
    const r = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_IN_BROWSER, url: currentTab.url });
    if (r?.ok) {
      toast("Opened in " + BROWSER_LABEL[settings.targetBrowser]);
      loadStats();
    } else {
      toast("Failed — check native host");
    }
  });

  els.pipBtn.addEventListener("click", async () => {
    if (!currentTab?.url) return;
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_PIP, url: currentTab.url });
    window.close();
  });

  els.modeSeg.addEventListener("click", async (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    const mode = btn.dataset.mode;
    setActiveMode(mode);
    settings = await setSettings({ openMode: mode });
    toast("Mode: " + btn.textContent.trim());
  });

  els.browser.addEventListener("change", async () => {
    settings = await setSettings({ targetBrowser: els.browser.value });
    updateTargetLabel();
    toast("Target: " + BROWSER_LABEL[els.browser.value]);
    pingHost();
  });

  els.options.addEventListener("click", () => chrome.runtime.openOptionsPage());
  els.test.addEventListener("click", pingHost);

}

function setActiveMode(mode) {
  els.modeSeg.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

function updateTargetLabel() {
  els.targetLabel.textContent = BROWSER_LABEL[els.browser.value] || "Brave";
}

async function loadStats() {
  const stats = await getStats();
  els.statRedir.textContent = stats.redirected || 0;
  els.statPip.textContent = stats.pipOpened || 0;
}

async function pingHost() {
  els.hostDot.className = "stat-dot warn";
  els.hostLabel.textContent = "Checking…";
  try {
    const r = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING_NATIVE });
    if (r?.ok) {
      els.hostDot.className = "stat-dot ok";
      els.hostLabel.textContent = "Host OK";
    } else {
      els.hostDot.className = "stat-dot err";
      els.hostLabel.textContent = "Host missing";
    }
  } catch {
    els.hostDot.className = "stat-dot err";
    els.hostLabel.textContent = "Host missing";
  }
}

function prettyUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname + url.pathname + (url.search ? url.search.slice(0, 30) + "…" : "");
  } catch {
    return u;
  }
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  els.toast.classList.remove("show");
  void els.toast.offsetWidth;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1700);
}
