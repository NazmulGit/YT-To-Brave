// YouTube URL parsing and matching.
import { YT_HOSTS } from "./constants.js";

export function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return YT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export function getRootHost(url) {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");
    if (parts.length >= 2) return parts.slice(-2).join(".");
    return u.hostname;
  } catch {
    return null;
  }
}

export function getYouTubeHostKey(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    return h;
  } catch {
    return null;
  }
}

export function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.pathname === "/watch") {
      return u.searchParams.get("v");
    }
    if (u.pathname.startsWith("/shorts/")) {
      return u.pathname.split("/")[2] || null;
    }
    if (u.pathname.startsWith("/embed/")) {
      return u.pathname.split("/")[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractTimestamp(url) {
  try {
    const u = new URL(url);
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (!t) return 0;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    let s = 0;
    const m = t.match(/(\d+)h/);
    const m2 = t.match(/(\d+)m/);
    const m3 = t.match(/(\d+)s/);
    if (m) s += parseInt(m[1], 10) * 3600;
    if (m2) s += parseInt(m2[1], 10) * 60;
    if (m3) s += parseInt(m3[1], 10);
    return s;
  } catch {
    return 0;
  }
}

export function isWatchableYouTubeUrl(url) {
  if (!isYouTubeUrl(url)) return false;
  return !!extractVideoId(url);
}

export function shouldRedirect(url, settings) {
  if (!settings.enabled) return false;
  if (!isYouTubeUrl(url)) return false;
  const host = getYouTubeHostKey(url);
  if (!host) return false;

  if (settings.blacklistDomains?.some((d) => host.endsWith(d))) return false;
  if (settings.whitelistDomains?.length && !settings.whitelistDomains.some((d) => host.endsWith(d))) {
    return false;
  }

  const rule = settings.domainRules?.[host];
  if (rule === false) return false;
  if (rule === true) return true;

  const baseHost = host.replace(/^www\./, "");
  const baseRule = settings.domainRules?.[baseHost];
  if (baseRule === false) return false;
  if (baseRule === true) return true;

  return true;
}
