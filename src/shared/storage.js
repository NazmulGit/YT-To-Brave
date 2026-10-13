// Settings + stats helpers.
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants.js";

export async function getSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const merged = deepMerge(DEFAULT_SETTINGS, stored[STORAGE_KEYS.SETTINGS] || {});
  return merged;
}

export async function setSettings(partial) {
  const current = await getSettings();
  const updated = deepMerge(current, partial);
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

export async function resetSettings() {
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
  return DEFAULT_SETTINGS;
}

export async function getStats() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  return stored[STORAGE_KEYS.STATS] || {
    redirected: 0,
    pipOpened: 0,
    lastRedirect: null,
    perBrowser: {},
  };
}

export async function bumpStat(key, browser = null) {
  const stats = await getStats();
  stats[key] = (stats[key] || 0) + 1;
  stats.lastRedirect = Date.now();
  if (browser) {
    stats.perBrowser[browser] = (stats.perBrowser[browser] || 0) + 1;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

export async function resetStats() {
  await chrome.storage.local.remove(STORAGE_KEYS.STATS);
}

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!override || typeof override !== "object") return out;
  for (const key of Object.keys(override)) {
    const bv = base?.[key];
    const ov = override[key];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && ov && typeof ov === "object" && !Array.isArray(ov)) {
      out[key] = deepMerge(bv, ov);
    } else {
      out[key] = ov;
    }
  }
  return out;
}
