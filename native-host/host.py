#!/usr/bin/env python3
"""
YT-to-Brave native messaging host.

Reads a JSON message on stdin from the Chrome extension, launches the
requested browser, and writes a JSON reply on stdout.

Message format (length-prefixed, native messaging spec):
  { "action": "open" | "ping",
    "url": "<full URL>",
    "browser": "brave" | "firefox" | "edge" | "chrome" | "opera" | "vivaldi" | "custom",
    "customPath": "<path or empty>",
    "mode": "new-tab" | "new-window" | "private-window" }
"""
import json
import os
import struct
import subprocess
import sys
import shutil

# Force unbuffered binary stdio (required by native messaging on Windows).
if hasattr(sys.stdin, "buffer"):
    sys.stdin = sys.stdin.buffer  # type: ignore
if hasattr(sys.stdout, "buffer"):
    sys.stdout = sys.stdout.buffer  # type: ignore


def expand_user(p: str) -> str:
    return os.path.expandvars(os.path.expanduser(p)) if p else p


KNOWN_PATHS = {
    "brave": [
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
    ],
    "firefox": [
        r"C:\Program Files\Mozilla Firefox\firefox.exe",
        r"C:\Program Files (x86)\Mozilla Firefox\firefox.exe",
    ],
    "edge": [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ],
    "chrome": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ],
    "opera": [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Opera\opera.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Opera GX\opera.exe"),
    ],
    "vivaldi": [
        os.path.expandvars(r"%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe"),
        r"C:\Program Files\Vivaldi\Application\vivaldi.exe",
    ],
}


def find_browser(name: str, custom: str = "") -> str | None:
    if name == "custom" and custom:
        custom = expand_user(custom)
        if os.path.exists(custom):
            return custom
        return None
    for path in KNOWN_PATHS.get(name, []):
        if os.path.exists(path):
            return path
    return None


def build_args(exe: str, name: str, url: str, mode: str) -> list[str]:
    """Return command-line args for the chosen browser/mode."""
    args: list[str] = [exe]
    is_chromium = name in ("brave", "chrome", "edge", "opera", "vivaldi")
    if is_chromium:
        if mode == "new-window":
            args.append("--new-window")
        elif mode == "private-window":
            if name == "edge":
                args.append("--inprivate")
            else:
                args.append("--incognito")
        args.append(url)
    elif name == "firefox":
        if mode == "private-window":
            args.extend(["-private-window", url])
        elif mode == "new-window":
            args.extend(["-new-window", url])
        else:
            args.extend(["-new-tab", url])
    else:
        # custom or unknown — just pass URL as last arg
        args.append(url)
    return args


def launch(exe: str, args: list[str]) -> bool:
    """Launch detached so the helper exits immediately."""
    try:
        creationflags = 0
        if sys.platform == "win32":
            DETACHED_PROCESS = 0x00000008
            CREATE_NEW_PROCESS_GROUP = 0x00000200
            creationflags = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(
            args,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            creationflags=creationflags,
        )
        return True
    except Exception as e:
        sys.stderr.write(f"launch error: {e}\n")
        return False


# ---- Native messaging I/O ----

def read_message():
    raw_len = sys.stdin.read(4)
    if len(raw_len) < 4:
        return None
    msg_len = struct.unpack("@I", raw_len)[0]
    if msg_len <= 0 or msg_len > 1024 * 1024:
        return None
    payload = sys.stdin.read(msg_len)
    return json.loads(payload.decode("utf-8"))


def send_message(msg: dict):
    data = json.dumps(msg).encode("utf-8")
    sys.stdout.write(struct.pack("@I", len(data)))
    sys.stdout.write(data)
    sys.stdout.flush()


def handle(msg: dict) -> dict:
    action = msg.get("action", "")
    if action == "ping":
        return {
            "ok": True,
            "version": "1.0.0",
            "platform": sys.platform,
            "python": sys.version.split()[0],
            "browsers_found": {
                k: bool(find_browser(k)) for k in KNOWN_PATHS
            },
        }
    if action != "open":
        return {"ok": False, "error": f"unknown action: {action}"}

    url = msg.get("url", "")
    browser = msg.get("browser", "brave")
    custom = msg.get("customPath", "")
    mode = msg.get("mode", "new-tab")

    if not url:
        return {"ok": False, "error": "missing url"}

    exe = find_browser(browser, custom)
    if not exe:
        # fall back to system shell open
        if sys.platform == "win32":
            try:
                os.startfile(url)  # type: ignore[attr-defined]
                return {"ok": True, "fallback": "shell-open", "browser": browser}
            except Exception as e:
                return {"ok": False, "error": f"{browser} not found and shell-open failed: {e}"}
        return {"ok": False, "error": f"{browser} executable not found"}

    args = build_args(exe, browser, url, mode)
    if launch(exe, args):
        return {"ok": True, "browser": browser, "exe": exe, "mode": mode}
    return {"ok": False, "error": "Popen failed"}


def main():
    while True:
        msg = read_message()
        if msg is None:
            return
        try:
            reply = handle(msg)
        except Exception as e:
            reply = {"ok": False, "error": str(e)}
        send_message(reply)


if __name__ == "__main__":
    main()
