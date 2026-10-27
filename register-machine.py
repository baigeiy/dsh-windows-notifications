"""Install this plugin's dedicated protocol for the local Windows activation broker."""
import winreg
from identity import DIRECTORY, PROTOCOL
from win32com.shell import shell, shellcon

launcher = DIRECTORY / "dsh-notification-activate.exe"
with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, rf"Software\Classes\{PROTOCOL}") as key:
    winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:DeepSeek Harness notification")
    winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, rf"Software\Classes\{PROTOCOL}\shell\open\command") as key:
    winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{launcher}" "%1"')
shell.SHChangeNotify(shellcon.SHCNE_ASSOCCHANGED, shellcon.SHCNF_IDLIST | shellcon.SHCNF_FLUSH, None, None)
