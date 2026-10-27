"""Register the local notification sender's name, source icon and protocol activation."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import winreg

import pythoncom
from win32com.propsys import propsys, pscon
from win32com.shell import shell, shellcon
from PIL import Image

DIRECTORY = Path(__file__).resolve().parent
APP_ID = "DeepSeekHarness.Notifications"
PROTOCOL = "dsh-local-notification"


def ensure_protocol():
    """Register only this plugin's local notification activation command."""
    launcher = DIRECTORY / "dsh-notification-activate.exe"
    if not launcher.is_file():
        raise FileNotFoundError("Build the local notification launcher before registering it")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{PROTOCOL}") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:DeepSeek Harness notification")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{PROTOCOL}\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{launcher}" "%1"')
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\{PROTOCOL}\DefaultIcon") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(DIRECTORY / "sender.ico"))
    capabilities = r"Software\DSHNotifications\Capabilities"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, capabilities) as key:
        winreg.SetValueEx(key, "ApplicationName", 0, winreg.REG_SZ, "DeepSeek Harness Notifications")
        winreg.SetValueEx(key, "ApplicationDescription", 0, winreg.REG_SZ, "Open existing DeepSeek Harness browser tab")
        winreg.SetValueEx(key, "ApplicationIcon", 0, winreg.REG_SZ, str(DIRECTORY / "sender.ico"))
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, capabilities + r"\URLAssociations") as key:
        winreg.SetValueEx(key, PROTOCOL, 0, winreg.REG_SZ, PROTOCOL)
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\RegisteredApplications") as key:
        winreg.SetValueEx(key, "DeepSeek Harness Notifications", 0, winreg.REG_SZ, capabilities)
    application = rf"Software\Classes\Applications\{launcher.name}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, application) as key:
        winreg.SetValueEx(key, "FriendlyAppName", 0, winreg.REG_SZ, "DeepSeek Harness")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, application + r"\SupportedProtocols") as key:
        winreg.SetValueEx(key, PROTOCOL, 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, application + r"\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{launcher}" "%1"')
    shell.SHChangeNotify(shellcon.SHCNE_ASSOCCHANGED, shellcon.SHCNF_IDLIST | shellcon.SHCNF_FLUSH, None, None)


def icon_path(choice, role):
    if choice == "custom":
        return DIRECTORY / f"custom-{role}.png"
    return DIRECTORY / ("official-whale.png" if choice == "official" else "whale-icon.png")


def ensure_identity(preferences):
    """A real Start-menu identity supplies the Windows source header and icon."""
    ensure_protocol()
    name = preferences.get("appName", "DeepSeek Harness")
    icon = icon_path(preferences.get("appIcon", "official"), "app")
    fingerprint = hashlib.sha256(name.encode() + icon.read_bytes()).hexdigest()
    marker = DIRECTORY / "identity.json"
    if marker.exists():
        previous = json.loads(marker.read_text(encoding="utf-8"))
        if previous.get("fingerprint") == fingerprint and Path(previous["shortcut"]).exists():
            return APP_ID
    else:
        previous = {}
    ico = DIRECTORY / "sender.ico"
    with Image.open(icon) as image:
        image.convert("RGBA").save(ico, format="ICO", sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)])
    shortcut_dir = Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs/DSH Notifications"
    shortcut_dir.mkdir(parents=True, exist_ok=True)
    filename = re.sub(r'[<>:"/\\|?*]', "_", name).strip(". ") or "DeepSeek Harness"
    shortcut_path = shortcut_dir / f"{filename}.lnk"
    pythonw = DIRECTORY / ".venv/Scripts/pythonw.exe"
    helper = DIRECTORY / "activate.py"
    pythoncom.CoInitialize()
    try:
        link = pythoncom.CoCreateInstance(shell.CLSID_ShellLink, None, pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink)
        link.SetPath(str(pythonw))
        link.SetArguments(f'"{helper}" --open')
        link.SetDescription(name)
        link.SetIconLocation(str(ico), 0)
        store = link.QueryInterface(propsys.IID_IPropertyStore)
        store.SetValue(pscon.PKEY_AppUserModel_ID, propsys.PROPVARIANTType(APP_ID))
        store.Commit()
        link.QueryInterface(pythoncom.IID_IPersistFile).Save(str(shortcut_path), 0)
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Classes\AppUserModelId\{APP_ID}") as key:
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, name)
            winreg.SetValueEx(key, "IconUri", 0, winreg.REG_SZ, str(ico))
            winreg.SetValueEx(key, "ShowInSettings", 0, winreg.REG_DWORD, 1)
        shell.SHChangeNotify(shellcon.SHCNE_ASSOCCHANGED, shellcon.SHCNF_IDLIST, None, None)
    finally:
        pythoncom.CoUninitialize()
    old = Path(previous.get("shortcut", str(shortcut_path)))
    if old != shortcut_path and old.parent == shortcut_dir:
        old.unlink(missing_ok=True)
    marker.write_text(json.dumps({"fingerprint": fingerprint, "shortcut": str(shortcut_path)}, ensure_ascii=False), encoding="utf-8")
    return APP_ID


if __name__ == "__main__":
    if sys.argv[1:] == ["--prepare-icon"]:
        with Image.open(DIRECTORY / "official-whale.png") as image:
            image.convert("RGBA").save(DIRECTORY / "sender.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    else:
        settings = DIRECTORY / "settings.json"
        preferences = json.loads(settings.read_text(encoding="utf-8")) if settings.exists() else {}
        ensure_identity(preferences)
        print("identity-ready")
