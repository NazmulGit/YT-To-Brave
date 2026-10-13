import { MESSAGE_TYPES, NATIVE_HOST_NAME } from "../shared/constants.js";
import { getSettings, setSettings, resetSettings, getStats, resetStats } from "../shared/storage.js";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

let settings;
let saveTimer;

init();

async function init() {
  settings = await getSettings();
  renderAll();
  bindNav();
  bindGeneral();
  bindBrowser();
  bindDomains();
  bindPip();
  bindShortcuts();
  bindAdvanced();
  bindWelcome();
  pingHost();

  if (new URLSearchParams(location.search).get("welcome") === "1") {
    $("welcomeBanner").hidden = false;
  }
}

/* ---- NAV ---- */
function bindNav() {
  $$(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      $$(".nav-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      const tab = link.dataset.tab;
      $$(".tab").forEach((t) => (t.hidden = t.dataset.tab !== tab));
      const titles = {
        general: ["General", "Core behavior of the redirect"],
        browser: ["Browser", "Pick the browser to launch"],
        domains: ["Domain rules", "Which YouTube hosts get redirected"],
        pip: ["Picture-in-Picture", "Configure the floating mini-player"],
        shortcuts: ["Shortcuts", "Keyboard shortcuts"],
        advanced: ["Advanced", "Native host, stats, import/export"],
        about: ["About", "Version & info"],
      };
      const [t, s] = titles[tab] || [tab, ""];
      $("pageTitle").textContent = t;
      $("pageSub").textContent = s;
    });
  });
}

/* ---- RENDER ---- */
function renderAll() {
  $("enabled").checked = settings.enabled;
  $("closeChromeTab").checked = settings.closeChromeTab;
  $("showNotifications").checked = settings.showNotifications;
  $("contextMenu").checked = settings.contextMenu;
  $("preserveTimestamp").checked = settings.preserveTimestamp;

  $$('input[name="openMode"]').forEach((r) => (r.checked = r.value === settings.openMode));

  $$(".browser-card").forEach((c) => c.classList.toggle("active", c.dataset.browser === settings.targetBrowser));
  $("customPathCard").hidden = settings.targetBrowser !== "custom";
  $("customBrowserPath").value = settings.customBrowserPath || "";

  renderDomainList();
  $("whitelistDomains").value = (settings.whitelistDomains || []).join("\n");
  $("blacklistDomains").value = (settings.blacklistDomains || []).join("\n");

  $("pipEnabled").checked = settings.pip.enabled;
  $("pipW").value = settings.pip.width;
  $("pipH").value = settings.pip.height;
  $("pipSpeed").value = settings.pip.defaultSpeed;
  $("pipSkip").value = settings.pip.skipSeconds;
  $("pipBigSkip").value = settings.pip.bigSkipSeconds;
  $("pipAutoplay").checked = settings.pip.autoplay;
  $("pipRememberPos").checked = settings.pip.rememberPosition;
  $("pipCaptions").checked = settings.pip.showCaptions;
  $$(".kSkip").forEach((e) => (e.textContent = settings.pip.skipSeconds));
  $$(".kBigSkip").forEach((e) => (e.textContent = settings.pip.bigSkipSeconds));


  loadStatsUI();
}

function renderDomainList() {
  const list = $("domainList");
  list.innerHTML = "";
  Object.entries(settings.domainRules).forEach(([domain, on]) => {
    const row = document.createElement("div");
    row.className = "domain-row";
    row.innerHTML = `
      <code>${domain}</code>
      <label class="switch"><input type="checkbox" ${on ? "checked" : ""} data-domain="${domain}" /><span class="slider"></span></label>
    `;
    list.appendChild(row);
  });
  list.addEventListener("change", async (e) => {
    if (e.target.matches("input[type=checkbox]")) {
      const d = e.target.dataset.domain;
      const next = { domainRules: { ...settings.domainRules, [d]: e.target.checked } };
      settings = await setSettings(next);
      flashSaved();
    }
  }, { once: true });
}

/* ---- GENERAL ---- */
function bindGeneral() {
  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("closeChromeTab").addEventListener("change", (e) => save({ closeChromeTab: e.target.checked }));
  $("showNotifications").addEventListener("change", (e) => save({ showNotifications: e.target.checked }));
  $("contextMenu").addEventListener("change", (e) => save({ contextMenu: e.target.checked }));
  $("preserveTimestamp").addEventListener("change", (e) => save({ preserveTimestamp: e.target.checked }));
  $$('input[name="openMode"]').forEach((r) => r.addEventListener("change", () => save({ openMode: r.value })));
  $("resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all settings to defaults?")) return;
    settings = await resetSettings();
    renderAll();
    flashSaved();
  });
}

/* ---- BROWSER ---- */
function bindBrowser() {
  $$(".browser-card").forEach((card) => {
    card.addEventListener("click", () => {
      const b = card.dataset.browser;
      $$(".browser-card").forEach((c) => c.classList.toggle("active", c === card));
      $("customPathCard").hidden = b !== "custom";
      save({ targetBrowser: b });
    });
  });
  let pathTimer;
  $("customBrowserPath").addEventListener("input", (e) => {
    clearTimeout(pathTimer);
    pathTimer = setTimeout(() => save({ customBrowserPath: e.target.value }), 350);
  });
}

/* ---- DOMAINS ---- */
function bindDomains() {
  $("domainList").addEventListener("change", async (e) => {
    if (!e.target.matches("input[type=checkbox]")) return;
    const d = e.target.dataset.domain;
    settings = await setSettings({ domainRules: { ...settings.domainRules, [d]: e.target.checked } });
    flashSaved();
  });
  $("whitelistDomains").addEventListener("change", (e) => save({ whitelistDomains: parseLines(e.target.value) }));
  $("blacklistDomains").addEventListener("change", (e) => save({ blacklistDomains: parseLines(e.target.value) }));
}
function parseLines(t) { return t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean); }

/* ---- PIP ---- */
function bindPip() {
  const num = (id) => parseFloat($(id).value || 0);
  $("pipEnabled").addEventListener("change", (e) => save({ pip: { ...settings.pip, enabled: e.target.checked } }));
  $("pipW").addEventListener("change", () => save({ pip: { ...settings.pip, width: num("pipW") } }));
  $("pipH").addEventListener("change", () => save({ pip: { ...settings.pip, height: num("pipH") } }));
  $("pipSpeed").addEventListener("change", (e) => save({ pip: { ...settings.pip, defaultSpeed: parseFloat(e.target.value) } }));
  $("pipSkip").addEventListener("change", () => {
    const v = num("pipSkip");
    save({ pip: { ...settings.pip, skipSeconds: v } });
    $$(".kSkip").forEach((el) => (el.textContent = v));
  });
  $("pipBigSkip").addEventListener("change", () => {
    const v = num("pipBigSkip");
    save({ pip: { ...settings.pip, bigSkipSeconds: v } });
    $$(".kBigSkip").forEach((el) => (el.textContent = v));
  });
  $("pipAutoplay").addEventListener("change", (e) => save({ pip: { ...settings.pip, autoplay: e.target.checked } }));
  $("pipRememberPos").addEventListener("change", (e) => save({ pip: { ...settings.pip, rememberPosition: e.target.checked } }));
  $("pipCaptions").addEventListener("change", (e) => save({ pip: { ...settings.pip, showCaptions: e.target.checked } }));
}


/* ---- SHORTCUTS ---- */
function bindShortcuts() {
  $("openShortcutsPage").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
}

/* ---- ADVANCED ---- */
function bindAdvanced() {
  $("hostTest").addEventListener("click", pingHost);
  $("hostTest2").addEventListener("click", pingHost);
  $("copyHostName").addEventListener("click", async () => {
    await navigator.clipboard.writeText(NATIVE_HOST_NAME);
    flashSaved("Host name copied");
  });
  $("resetStats").addEventListener("click", async () => {
    await resetStats();
    loadStatsUI();
    flashSaved("Stats reset");
  });
  $("exportBtn").addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yt-to-brave-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      settings = await setSettings(obj);
      renderAll();
      flashSaved("Settings imported");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  });
}

/* ---- WELCOME ---- */
function bindWelcome() {
  const banner = $("welcomeBanner");
  const minimize = () => {
    banner.classList.add("minimized");
    chrome.storage.local.set({ welcomeMinimized: true });
  };
  const expand = () => {
    banner.classList.remove("minimized");
    chrome.storage.local.set({ welcomeMinimized: false });
  };

  $("dismissWelcome").addEventListener("click", (e) => {
    e.stopPropagation();
    minimize();
    history.replaceState({}, "", location.pathname);
  });
  $("minToggle").addEventListener("click", (e) => {
    e.stopPropagation();
    if (banner.classList.contains("minimized")) expand();
    else minimize();
  });
  banner.addEventListener("click", (e) => {
    if (!banner.classList.contains("minimized")) return;
    if (e.target.closest("button")) return;
    expand();
  });

  // Restore minimized state on subsequent visits
  chrome.storage.local.get("welcomeMinimized", ({ welcomeMinimized }) => {
    if (welcomeMinimized) banner.classList.add("minimized");
  });
}

/* ---- HELPERS ---- */
async function save(partial) {
  settings = await setSettings(partial);
  flashSaved();
}

let saveBarTimer;
function flashSaved(msg = "Settings updated ✓") {
  const bar = $("saveBar");
  bar.firstElementChild.textContent = msg;
  bar.hidden = false;
  bar.style.animation = "none";
  void bar.offsetWidth;
  bar.style.animation = "";
  clearTimeout(saveBarTimer);
  saveBarTimer = setTimeout(() => (bar.hidden = true), 2400);
}

async function pingHost() {
  const dot = document.querySelector("#hostStatus .dot");
  const text = document.querySelector("#hostStatus .text");
  dot.className = "dot warn";
  text.textContent = "Testing…";
  try {
    const r = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING_NATIVE });
    if (r?.ok) {
      dot.className = "dot ok";
      text.textContent = "Native host OK";
      $("hostInfo").textContent = JSON.stringify(r.info, null, 2);
    } else {
      dot.className = "dot err";
      text.textContent = "Host missing — install it";
      $("hostInfo").textContent = "Error: " + (r?.error || "no response");
    }
  } catch (e) {
    dot.className = "dot err";
    text.textContent = "Host missing";
    $("hostInfo").textContent = "Error: " + e.message;
  }
}

async function loadStatsUI() {
  const stats = await getStats();
  $("statRedir").textContent = stats.redirected || 0;
  $("statPip").textContent = stats.pipOpened || 0;
  $("statLast").textContent = stats.lastRedirect ? new Date(stats.lastRedirect).toLocaleString() : "never";
}
