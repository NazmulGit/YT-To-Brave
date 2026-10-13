// Content script: detect clicks on YouTube links from non-YouTube sites
// and forward them to the background. webNavigation already handles direct
// navigation, but this gives us a faster, friendlier intercept for clicks.
(function () {
  "use strict";

  const YT_HOSTS = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
  ];

  function isYt(url) {
    try {
      const u = new URL(url, location.href);
      return YT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    } catch {
      return false;
    }
  }

  let enabled = true;
  let openMode = "new-tab";
  chrome.storage.sync.get("settings", ({ settings }) => {
    if (settings) {
      enabled = settings.enabled !== false;
      openMode = settings.openMode || "new-tab";
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings?.newValue) {
      enabled = changes.settings.newValue.enabled !== false;
      openMode = changes.settings.newValue.openMode || "new-tab";
    }
  });

  if (isYt(location.href)) return;

  document.addEventListener(
    "click",
    (e) => {
      if (!enabled) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.href;
      if (!isYt(href)) return;
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage(
        { type: openMode === "pip" ? "OPEN_PIP" : "OPEN_IN_BROWSER", url: href },
        () => void chrome.runtime.lastError
      );
    },
    true
  );
})();
