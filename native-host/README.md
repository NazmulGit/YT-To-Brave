# YT-to-Brave native host

The Chrome extension cannot launch other browsers directly — Chrome's API forbids it. This tiny helper closes the gap.

## What it does
- Reads a JSON message from the extension over stdin (Chrome native messaging)
- Launches the requested browser (Brave, Firefox, Edge, Opera, Vivaldi, custom)
- Returns success/error JSON over stdout

## Files
| File | Purpose |
|---|---|
| `host.py` | The actual helper (Python 3) |
| `host.bat` | Wrapper Chrome invokes (forwards stdio to Python) |
| `com.ytbrave.host.json` | Template manifest |
| `install.py` | Installer logic (auto-detect + manual prompt + registry) |
| `install.bat` | Default entry — shows a menu |
| `install-auto.bat` | Skip the menu, go straight to AUTO mode |
| `install-manual.bat` | Skip the menu, go straight to MANUAL mode |
| `uninstall.bat` | Removes the registry entries |

## Install — two modes

### Quick way (most users)

1. Install **Python 3.8+** from https://python.org and tick *"Add to PATH"*
   *(or skip — install.bat will offer to install via `winget`)*
2. Load the extension: `chrome://extensions` → *Developer mode* → *Load unpacked* → pick the project root
3. Double-click `install.bat`
4. At the menu: press **1** *(or just Enter)* for **Auto**

That's it. The installer scans your profiles, finds the extension ID, registers everything, and opens chrome://extensions. Click the refresh icon on the extension card.

### Manual way (when auto can't see your extension)

Some setups don't expose `Preferences` files where the auto-detector looks (corporate-managed Chrome, portable browsers, custom user-data dirs). In those cases:

1. Same steps 1 and 2 as above
2. Copy the **32-character extension ID** from the YT-to-Brave card on `chrome://extensions`
3. Double-click `install.bat`, pick **2 (Manual)** — *or* double-click `install-manual.bat`
4. Paste the ID

You can paste multiple IDs (space or comma-separated) if you've loaded the extension in more than one Chromium browser.

### CLI flags (scripted installs)

```
install.bat /auto                              # auto, no menu
install.bat /manual                            # manual, no menu
install.bat --id aabbccddeeffgghhiijjkkllmmnnoopp  # use this ID directly
install.bat --help                             # show all options
```

## Uninstall
Run `uninstall.bat`.

## Troubleshooting

**"Host missing" in popup**
- Make sure `install.bat` finished without errors
- Confirm the extension ID you pasted matches `chrome://extensions`
- Reload the extension after installing

**"Python not found"**
- Reinstall Python with *Add to PATH* checked, then re-run `install.bat`

**Browser not found**
- Open extension → Settings → Browser → choose **Custom** and provide the full `.exe` path

## Security notes
- The host only accepts the `open` and `ping` actions
- It only accepts requests from the registered extension ID (Chrome enforces this)
- The host does **not** make network requests
- It does **not** run arbitrary commands — only the configured browser executable with a URL argument
