# YT-to-Brave (Core)

## Overview
**What is this:** A Chrome extension + local Python helper that automatically opens YouTube links in Brave (or any browser of your choice), with a built-in Picture-in-Picture player.
**Why it exists:** Chrome extensions cannot launch other browsers directly due to API restrictions; this project bridges that gap using Chrome Native Messaging so every YouTube link or navigation in Chrome is silently handed off to Brave without manual copy-pasting.
**What it does:**
- Intercepts YouTube link clicks and omnibox navigations in Chrome and opens them in Brave (or Firefox, Edge, Opera, Vivaldi, or a custom `.exe`)
- Provides a floating Picture-in-Picture player with full keyboard controls (play/pause, seek, speed, captions, fullscreen)
- Includes a smart installer (`install.bat`) that auto-detects the extension ID and registers the native host in the registry — no admin rights required
- Exposes a full settings page (7 tabs) for open mode, domain rules, PiP config, shortcuts, and import/export

**How to operate:**
- **Start:** Load the extension at `chrome://extensions` (Developer mode → Load unpacked → project root), then run `native-host\install.bat` and choose Auto
- **Stop:** Disable the extension at `chrome://extensions`; run `native-host\uninstall.bat` to remove the native host registry entry
- **Port / URL:** N/A (local Chrome extension, no server)
- **Config:** Extension settings stored in Chrome sync storage; native host path in `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.ytbrave.host`
- **Update:** `git pull` in `<your-clone-folder>`, then reload the extension at `chrome://extensions`; re-run `native-host\install.bat` only if `host.py` or `host.bat` changed

---

## Update Log

### v1.0.0 — Initial Release — 2026-06-12
**What changed:** First complete working release. Ships the Manifest V3 Chrome extension (background service worker, content script link-detector, 7-tab options page, toolbar popup, PiP player) together with the native host (`host.py` / `host.bat`) and a smart two-mode installer (`install.bat` / `install.py`). Auto mode scans Chrome/Brave/Edge/Vivaldi/Opera profile directories to find the extension ID without user input; manual mode accepts one or more 32-character IDs pasted at the prompt. Registry write targets `HKCU` so no admin elevation is needed. Supports opening YouTube in any of six preset browsers or a custom `.exe`, with optional timestamp (`?t=`) preservation. PiP window persists across tab navigation with on-screen controls and full keyboard bindings.
**Redo (re-apply):** `git clone <repo> <your-clone-folder>` → open `chrome://extensions`, enable Developer mode, click Load unpacked, select `<your-clone-folder>` → double-click `native-host\install.bat`, press Enter (Auto), reload extension card.
**Undo (roll back):** `native-host\uninstall.bat` (removes registry keys) → remove extension at `chrome://extensions` → `rmdir /s /q <your-clone-folder>`.
**System:** Chrome extension (no port); native host registered at `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.ytbrave.host`; Python 3.8+ required on PATH.

---
