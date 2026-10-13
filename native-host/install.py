#!/usr/bin/env python3
"""
YT-to-Brave native host installer.

Two modes:
  1. AUTO    - scan Chrome/Brave/Edge/Vivaldi/Opera profiles to find the
               extension's ID automatically (default; recommended).
  2. MANUAL  - paste the extension ID(s) yourself.

CLI flags:
  --auto                   force auto-detect (no menu)
  --manual                 force manual prompt (no menu)
  --id <EXTENSION_ID>      use this ID directly (implies --manual,
                           can be repeated for multiple browsers)
  --help                   this help

With no args, shows an interactive menu.
"""
import json
import os
import re
import sys
import subprocess

HOST_NAME = "com.ytbrave.host"

# Per-browser locations of the user's Preferences JSON
USER_DATA_ROOTS = {
    "Chrome": r"%LOCALAPPDATA%\Google\Chrome\User Data",
    "Brave": r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data",
    "Edge": r"%LOCALAPPDATA%\Microsoft\Edge\User Data",
    "Vivaldi": r"%LOCALAPPDATA%\Vivaldi\User Data",
    "Opera": r"%APPDATA%\Opera Software\Opera Stable",
    "OperaGX": r"%APPDATA%\Opera Software\Opera GX Stable",
}

# Per-browser registry roots for native messaging hosts (HKCU)
REG_ROOTS = {
    "Chrome": r"Software\Google\Chrome\NativeMessagingHosts",
    "Brave": r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts",
    "Edge": r"Software\Microsoft\Edge\NativeMessagingHosts",
    "Vivaldi": r"Software\Vivaldi\NativeMessagingHosts",
    "Opera": r"Software\Opera Software\NativeMessagingHosts",
    "OperaGX": r"Software\Opera Software\NativeMessagingHosts",
}

# Likely browser EXEs (used to open chrome://extensions at the end)
BROWSER_EXES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

EXTENSION_ID_RE = re.compile(r"^[a-p]{32}$")


# ---- helpers ----

def norm(p: str) -> str:
    return os.path.normpath(p).lower().replace("/", "\\")


def is_valid_extension_id(s: str) -> bool:
    return bool(EXTENSION_ID_RE.match(s.strip()))


def find_extension(extension_dir: str):
    """Return [(browser, profile, ext_id, name), ...] for matching loaded extensions."""
    target = norm(extension_dir)
    found = []
    for browser, base_pat in USER_DATA_ROOTS.items():
        base = os.path.expandvars(base_pat)
        if not os.path.isdir(base):
            continue
        for entry in os.listdir(base):
            profile_dir = os.path.join(base, entry)
            prefs_path = os.path.join(profile_dir, "Preferences")
            if not os.path.isfile(prefs_path):
                continue
            try:
                with open(prefs_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            for ext_id, ext_data in (data.get("extensions", {}).get("settings", {}) or {}).items():
                path = ext_data.get("path", "")
                if not path:
                    continue
                if norm(path) == target:
                    name = (ext_data.get("manifest", {}) or {}).get("name", "?")
                    found.append((browser, entry, ext_id, name))
    return found


def write_host_manifest(manifest_path: str, host_bat: str, ext_ids):
    manifest = {
        "name": HOST_NAME,
        "description": "YT-to-Brave native helper",
        "path": host_bat,
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{eid}/" for eid in sorted(set(ext_ids))],
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def register(browser: str, manifest_path: str) -> bool:
    """Register manifest for one browser under HKCU."""
    import winreg
    key_path = REG_ROOTS[browser] + "\\" + HOST_NAME
    try:
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValue(key, "", winreg.REG_SZ, manifest_path)
        return True
    except Exception as e:
        print(f"  [!] {browser}: {e}")
        return False


def open_extensions_page():
    for exe in BROWSER_EXES:
        if os.path.exists(exe):
            try:
                subprocess.Popen([exe, "chrome://extensions/"], close_fds=True)
                return os.path.basename(exe)
            except Exception:
                continue
    try:
        os.startfile("chrome://extensions/")
        return "default browser"
    except Exception:
        return None


# ---- prompts ----

def prompt_choice() -> str:
    """Returns 'auto' | 'manual' | 'quit'."""
    print()
    print("  How would you like to install?")
    print()
    print("    [1]  Auto    -  Scan your browsers, find the extension automatically  (recommended)")
    print("    [2]  Manual  -  Paste the extension ID from chrome://extensions")
    print("    [3]  Quit")
    print()
    while True:
        try:
            ans = input("  Choice [1]: ").strip().lower()
        except EOFError:
            return "quit"
        if ans in ("", "1", "a", "auto"):
            return "auto"
        if ans in ("2", "m", "manual"):
            return "manual"
        if ans in ("3", "q", "quit", "exit"):
            return "quit"
        print(f"    '{ans}' is not a valid choice. Type 1, 2, or 3.")


def prompt_manual_ids():
    """Ask the user for one or more extension IDs."""
    print()
    print("  -- MANUAL MODE --")
    print()
    print("  How to find your extension ID:")
    print("    1. Open chrome://extensions  (or brave://extensions / edge://extensions)")
    print("    2. Toggle 'Developer mode' on (top right)")
    print("    3. Find the YT-to-Brave card")
    print("    4. Copy the 32-character ID under the name (looks like 'aabbccddeeff...')")
    print()
    print("  Tip: paste multiple IDs separated by spaces or commas if you've loaded")
    print("       the extension in BOTH Chrome and Brave/Edge.")
    print()
    while True:
        try:
            raw = input("  Extension ID(s): ").strip()
        except EOFError:
            return []
        if not raw:
            print("    ...empty input. Press Ctrl+C to cancel.")
            continue
        ids = [p.strip() for p in raw.replace(",", " ").split() if p.strip()]
        bad = [i for i in ids if not is_valid_extension_id(i)]
        if bad:
            print(f"    Not a valid extension ID: '{bad[0]}'")
            print(f"    IDs are 32 lowercase letters a-p. Try again.")
            continue
        return ids


# ---- install paths ----

def do_auto(extension_dir, script_dir):
    print()
    print("[1/4] AUTO mode -- scanning Chrome / Brave / Edge / Vivaldi / Opera profiles...")
    matches = find_extension(extension_dir)
    if not matches:
        print()
        print("       Couldn't find this extension in any browser yet.")
        print()
        print("       Two options:")
        print("         (a) Load the extension first:")
        print("              - Open chrome://extensions")
        print("              - Toggle 'Developer mode' (top right)")
        print("              - Click 'Load unpacked' and pick:")
        print(f"                {extension_dir}")
        print("              - Then re-run this installer")
        print()
        print("         (b) Switch to MANUAL mode and paste the ID yourself.")
        print()
        try:
            ans = input("  Switch to Manual mode now? [Y/n]: ").strip().lower()
        except EOFError:
            ans = "n"
        if ans in ("", "y", "yes"):
            return do_manual(extension_dir, script_dir)
        opened = open_extensions_page()
        if opened:
            print(f"       Opened chrome://extensions in {opened}")
        sys.exit(1)

    print(f"       Found in {len(matches)} place(s):")
    for browser, profile, ext_id, name in matches:
        short = ext_id[:8] + "..." + ext_id[-4:]
        print(f"         - {browser} / {profile}: {short}  ({name})")

    finish_install(script_dir, [m[2] for m in matches], extra_browsers=set(m[0] for m in matches))


def do_manual(extension_dir, script_dir, preset_ids=None):
    if preset_ids:
        ids = preset_ids
        print()
        print(f"[1/4] MANUAL mode (CLI) -- using {len(ids)} ID(s) from --id flags.")
    else:
        print()
        print("[1/4] MANUAL mode")
        ids = prompt_manual_ids()
        if not ids:
            print("       No IDs entered. Cancelled.")
            sys.exit(1)
    for i in ids:
        print(f"         - {i[:8]}...{i[-4:]}")
    finish_install(script_dir, ids, extra_browsers=set())


def finish_install(script_dir, ext_ids, extra_browsers):
    """Common finish path for both modes."""
    print()
    print("[2/4] Writing native-messaging manifest...")
    manifest_path = os.path.join(script_dir, "com.ytbrave.host.installed.json")
    host_bat = os.path.join(script_dir, "host.bat")
    write_host_manifest(manifest_path, host_bat, ext_ids)
    print(f"       -> {manifest_path}")

    print()
    print("[3/4] Registering in Windows registry (HKCU -- no admin needed)...")
    browsers = set(extra_browsers) | {"Chrome", "Brave", "Edge", "Vivaldi", "Opera"}
    ok = 0
    for browser in sorted(browsers):
        if register(browser, manifest_path):
            print(f"       -> {browser}")
            ok += 1
    if ok == 0:
        print("       [!] Couldn't register any browser. The HKCU hive may be locked.")
        sys.exit(2)

    print()
    print("[4/4] Opening chrome://extensions so you can reload the extension...")
    opened = open_extensions_page()
    if opened:
        print(f"       -> Opened in {opened}")

    print()
    print("=" * 64)
    print("  DONE.")
    print()
    print("  Next:")
    print("    * On the chrome://extensions page, click the refresh icon on")
    print("      the YT-to-Brave card.")
    print("    * Click the extension icon -> should show 'Host OK'.")
    print()
    print("  No admin rights were used. Everything is in your user account")
    print("  registry only (HKCU). Run uninstall.bat to remove cleanly.")
    print("=" * 64)
    print()


# ---- CLI parsing ----

def parse_cli(argv):
    """Returns (mode, manual_ids).
    mode: 'auto' | 'manual' | None  (None = interactive menu)."""
    mode = None
    ids = []
    i = 1
    while i < len(argv):
        a = argv[i].lower()
        if a in ("--auto", "-a", "/auto", "/a"):
            mode = "auto"
        elif a in ("--manual", "-m", "/manual", "/m"):
            mode = "manual"
        elif a in ("--id",) and i + 1 < len(argv):
            ids.append(argv[i + 1])
            mode = "manual"
            i += 1
        elif a in ("--help", "-h", "/?", "/help"):
            print(__doc__)
            sys.exit(0)
        i += 1
    return mode, ids


# ---- main ----

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    extension_dir = os.path.dirname(script_dir)
    cli_mode, cli_ids = parse_cli(sys.argv)

    print()
    print("=" * 64)
    print("  YT-to-Brave  -  native host installer")
    print("=" * 64)
    print(f"  Extension folder : {extension_dir}")
    print(f"  Host folder      : {script_dir}")

    # Direct manual path with --id flags: skip menu, validate, install
    if cli_ids:
        bad = [i for i in cli_ids if not is_valid_extension_id(i)]
        if bad:
            print(f"\n  [!] Invalid ID from --id flag: {bad[0]}")
            print("      Extension IDs are 32 lowercase letters a-p.")
            sys.exit(1)
        return do_manual(extension_dir, script_dir, preset_ids=cli_ids)

    # Pick mode (CLI flag wins, else menu)
    if cli_mode == "auto":
        mode = "auto"
    elif cli_mode == "manual":
        mode = "manual"
    else:
        mode = prompt_choice()

    if mode == "quit":
        print("\n  Cancelled.")
        return

    if mode == "auto":
        do_auto(extension_dir, script_dir)
    else:
        do_manual(extension_dir, script_dir)


if __name__ == "__main__":
    exit_code = 0
    try:
        main()
    except SystemExit as se:
        exit_code = se.code if isinstance(se.code, int) else 0
    except KeyboardInterrupt:
        print("\n\nCancelled.")
        exit_code = 130
    except Exception as e:
        print(f"\n[FATAL] {e}")
        exit_code = 1
    # Only block on Enter when running interactively (i.e. from a double-clicked
    # .bat in a console), so piped/scripted runs (e.g. CI) finish cleanly.
    if sys.stdin.isatty() and "--help" not in sys.argv and "-h" not in sys.argv:
        try:
            input("\nPress Enter to close this window...")
        except EOFError:
            pass
    sys.exit(exit_code)
