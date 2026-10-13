// Shared constants for the extension.

export const NATIVE_HOST_NAME = "com.ytbrave.host";

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  STATS: "stats",
};

export const DEFAULT_BROWSER_PATHS = {
  brave: [
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ],
  firefox: [
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
  ],
  edge: [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  chrome: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  opera: [
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Opera\\opera.exe",
  ],
  vivaldi: [
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Vivaldi\\Application\\vivaldi.exe",
  ],
};

export const OPEN_MODES = {
  NEW_TAB: "new-tab",
  NEW_WINDOW: "new-window",
  PRIVATE_WINDOW: "private-window",
  PIP: "pip",
  ASK: "ask",
};



export const DEFAULT_SETTINGS = {
  enabled: true,
  targetBrowser: "brave",
  customBrowserPath: "",
  openMode: OPEN_MODES.NEW_TAB,
  closeChromeTab: true,
  showNotifications: true,
  domainRules: {
    "youtube.com": true,
    "youtu.be": true,
    "m.youtube.com": true,
    "music.youtube.com": false,
    "studio.youtube.com": false,
    "tv.youtube.com": false,
  },
  pip: {
    enabled: true,
    width: 480,
    height: 270,
    autoplay: true,
    defaultSpeed: 1.0,
    rememberPosition: true,
    showCaptions: false,
    skipSeconds: 10,
    bigSkipSeconds: 30,
  },
  contextMenu: true,
  preserveTimestamp: true,
  whitelistDomains: [],
  blacklistDomains: [],
  shortcuts: {
    togglePip: "Ctrl+Shift+P",
    openInBrave: "Ctrl+Shift+B",
  },
};

export const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "studio.youtube.com",
  "tv.youtube.com",
  "youtu.be",
];

export const MESSAGE_TYPES = {
  OPEN_IN_BROWSER: "OPEN_IN_BROWSER",
  TEST_NATIVE_HOST: "TEST_NATIVE_HOST",
  GET_SETTINGS: "GET_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  TOGGLE_PIP: "TOGGLE_PIP",
  OPEN_PIP: "OPEN_PIP",
  GET_STATS: "GET_STATS",
  RESET_STATS: "RESET_STATS",
  PING_NATIVE: "PING_NATIVE",
};
