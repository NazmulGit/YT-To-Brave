# YTBravePran (YT-to-Brave) — Open YouTube Links in Brave with Picture-in-Picture

**YTBravePran** is a browser extension plus native host that opens YouTube links in **Brave** (or any browser you choose) automatically, with a built-in Picture-in-Picture player.

- **Extension** (Manifest V3: background, content and options scripts) and a **Python native messaging host** with installers.
- **Current release:** v1.0.0

> Status: private repository.

---


> Open YouTube links in **Brave** (or any browser of your choice) automatically — with a built-in Picture-in-Picture player.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-ff3d00) ![Windows](https://img.shields.io/badge/Platform-Windows-blue) ![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-green)

## What it does

- Click a YouTube link in Chrome → it opens in **Brave** instead.
- Type a YouTube URL into Chrome's omnibox → same thing.
- Or open it in a **floating Picture-in-Picture player** with full keyboard control.
- Pick *any* browser as the target: Brave, Firefox, Edge, Chrome, Opera, Vivaldi, or a custom `.exe`.

## Why this is built the way it is

Chrome extensions cannot launch other browsers directly — the API forbids it for security reasons. The standard solution is **Native Messaging**: a tiny local helper script that the extension talks to, which then runs the browser. This repo includes both pieces.

```
Chrome  ──[intercept YouTube nav]──>  Extension
                                           │
                                           ▼
                                    Native messaging
                                           │
                                           ▼
                                  host.py  ──>  brave.exe <URL>
```

## Install (one time)

### 1. Install the extension

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this project folder (the one containing `manifest.json`)
5. Copy the **extension ID** shown on the card — you'll paste it in step 2

### 2. Install the native host

Open the `native-host` folder and pick one of:

| Double-click | What it does |
|---|---|
| **`install.bat`** | Shows a menu — **[1] Auto** / **[2] Manual** / **[3] Quit** |
| `install-auto.bat` | Skip the menu, go straight to auto-detect |
| `install-manual.bat` | Skip the menu, prompt for the extension ID |

**Auto mode** *(recommended)*:
- Detects Python (offers `winget install Python.Python.3.12` if missing)
- Scans your Chrome / Brave / Edge / Vivaldi / Opera profiles to find the extension ID itself
- Writes the manifest, registers it in `HKCU` (no admin), opens `chrome://extensions` for you

**Manual mode**:
- Asks you to paste the 32-character extension ID from `chrome://extensions`
- Validates the ID format (must be 32 lowercase letters a-p)
- Accepts multiple IDs separated by spaces or commas (useful if you've loaded the extension in both Chrome AND Brave/Edge)
- Same registry steps from there

If auto-detect can't find the extension (e.g., you haven't loaded it yet), it'll offer to switch to manual on the spot.

CLI flags for power users: `install.bat /auto`, `install.bat /manual`, `install.bat --id <ID> --id <ID2>`.

### 3. Verify

Click the extension icon → status should say **Host OK**. Click **Test connection** to re-check.

## Usage

| Action | What happens |
|---|---|
| Click a YouTube link anywhere | Opens in Brave (default) |
| Visit `youtube.com/watch?...` directly | Same — auto-redirects |
| `Ctrl+Shift+Y` | Opens the popup |
| `Ctrl+Shift+B` | Opens current tab in Brave |
| `Ctrl+Shift+P` | Toggle Picture-in-Picture for current tab |
| Right-click a YouTube link | "Open in Brave" / "Open in PiP" |
| Hover any `<video>` on a page | Floating "MediaPlayer" button appears *(when enabled)* |

### Settings (extension icon → Settings)

- **General** — master switch, open mode (new tab / window / private / PiP / ask), close-Chrome-tab toggle, notifications, context menu, preserve `?t=` timestamps
- **Browser** — pick target browser or set a custom executable path
- **Domain rules** — toggle each YouTube subdomain (`music.youtube.com` and `studio.youtube.com` are off by default), whitelist/blacklist
- **Picture-in-Picture** — size, default speed, skip seconds, autoplay, remember position, captions
- **Shortcuts** — full keyboard shortcut reference + link to Chrome's shortcut editor
- **Advanced** — native host status, statistics, import/export settings as JSON

## Picture-in-Picture controls

The PiP window is a real Chrome popup so it persists across tabs and survives navigation.

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Skip ±10s (configurable) |
| `J` / `L` | Skip ±30s (configurable) |
| `↑` / `↓` | Volume ±5% |
| `M` | Mute |
| `F` | Fullscreen |
| `C` | Captions |
| `<` / `>` | Speed down / up |
| `0`–`9` | Jump to 0%–90% |
| `Home` / `End` | Start / End |
| `Esc` | Exit fullscreen |

Plus on-screen: progress bar, time display, volume slider, speed dropdown (0.25× → 2×), captions toggle, fullscreen, theater mode, "open in Brave" pop-out, close.


## File structure

```
.
├─ manifest.json
├─ icons/                            PNG icons (16/32/48/128)
├─ assets/logo.svg                   Master logo
├─ src/
│  ├─ background/service-worker.js   Intercepts navigation, opens players
│  ├─ content/
│  │  ├─ link-detector.js            YouTube link click interception
│  ├─ shared/                        Constants + storage + URL parsing
│  ├─ popup/                         Toolbar popup
│  ├─ options/                       Full settings page (7 tabs)
│  ├─ pip/                           YouTube Picture-in-Picture player
│     ├─ player.html
│     ├─ player.css
│     └─ player.js
└─ native-host/
   ├─ host.py                        The helper that launches browsers
   ├─ host.bat                       Windows wrapper Chrome invokes
   ├─ install.py                     NEW · smart auto-detecting installer
   ├─ install.bat                    NEW · zero-prompt double-click installer
   ├─ uninstall.bat                  Removes registry keys
   └─ com.ytbrave.host.json          Native messaging manifest template
```

## Privacy

- **No network requests.** The extension only talks to the local helper.
- **No analytics.** Nothing is logged, sent, or saved off-machine.
- The native host accepts only `open` and `ping` actions, only from the registered extension ID. It launches one configured browser executable with a URL — nothing else.

## Uninstall

1. Run `native-host/uninstall.bat` to remove registry entries
2. Remove the extension at `chrome://extensions`

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Host missing" in popup | Run `install.bat`, paste correct extension ID, reload extension |
| Python not found | Reinstall Python with *Add to PATH* checked |
| Brave not found | Settings → Browser → **Custom** → enter full path to `.exe` |
| YouTube still opens in Chrome | Check the master switch and the domain in Settings → Domain rules |
| PiP shows blank | Some videos block embeds — they fall back to opening in Brave |

## License

MIT — do whatever you want with it.

---

## Keywords
youtube brave extension, open youtube in brave, picture in picture, native messaging host, browser redirect extension, manifest v3
