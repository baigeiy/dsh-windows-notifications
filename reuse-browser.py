"""Select an existing dsh browser tab and close only the notification handoff tab."""
import json
import sys
import time
import traceback
from pathlib import Path
import ctypes
import win32api
import win32con
import win32gui
import win32process
from foreground import matches_dsh_title
from window_activation import NativeFocusDenied, focus_window, stop_taskbar_attention

TAB_TYPES = {50019, 50024}
BROWSER_CLASSES = {"Chrome_WidgetWin_1", "MozillaWindowClass"}
BROWSER_PROGRAMS = {"msedge.exe", "chrome.exe", "firefox.exe", "brave.exe", "vivaldi.exe", "opera.exe"}
STATE = Path(__file__).with_name("reuse-state.json")




def record(phase, **details):
    STATE.write_text(json.dumps({"time": time.time(), "phase": phase, **details}), encoding="utf-8")


def ui_control(hwnd):
    """Load browser accessibility support only when a tab or focus fallback needs it."""
    import uiautomation
    return uiautomation.ControlFromHandle(hwnd)


def browser_process(hwnd):
    pid = win32process.GetWindowThreadProcessId(hwnd)[1]
    try:
        process = win32api.OpenProcess(0x1000, False, pid)
    except win32api.error:
        return False
    try:
        path = ctypes.create_unicode_buffer(32768)
        size = ctypes.c_ulong(len(path))
        query = ctypes.WinDLL("kernel32", use_last_error=True).QueryFullProcessImageNameW
        query.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_ulong)]
        query.restype = ctypes.c_int
        return bool(query(int(process), 0, path, ctypes.byref(size))) and Path(path.value).name.lower() in BROWSER_PROGRAMS
    finally:
        process.Close()


def controls(root, deadline, max_depth=8):
    queue = [(root, 0)]
    while queue and time.monotonic() < deadline:
        control, depth = queue.pop(0)
        if control is not None:
            try:
                kind = control.ControlType
                yield control
                if depth >= max_depth or kind == 50030:
                    continue
                queue.extend((child, depth + 1) for child in control.GetChildren())
            except Exception as error:
                # A tab may close while its browser chrome is being enumerated.
                from comtypes import COMError
                if not isinstance(error, (LookupError, OSError, COMError)):
                    raise


def browser_windows():
    windows = []
    def collect(hwnd, _):
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetClassName(hwnd) in BROWSER_CLASSES and browser_process(hwnd):
            windows.append(hwnd)
    win32gui.EnumWindows(collect, None)
    foreground = win32gui.GetForegroundWindow()
    return sorted(windows, key=lambda hwnd: hwnd != foreground)




def reuse(marker, close_handoff=False):
    record("scan")
    deadline = time.monotonic() + 10
    candidates = []
    windows = browser_windows()
    record("scan", windows=len(windows))
    # A selected DSH tab is already identified by its browser's native window title.
    for hwnd in windows:
        title = win32gui.GetWindowText(hwnd)
        if matches_dsh_title(title) and not title.startswith("Windows 通知"):
            try:
                focus_window(hwnd)
            except (win32gui.error, NativeFocusDenied) as error:
                # Denied native activation is recovered by selecting the actual browser tab.
                record("native-focus-denied", error=str(error))
                continue
            if not close_handoff:
                stop_taskbar_attention(hwnd)
                record("done", closed=False)
                return {"reused": True, "closed": False}
            candidates.append((hwnd, None))
            break
    if not candidates:
        for hwnd in windows:
            root = ui_control(hwnd)
            for control in controls(root, deadline):
                if control.ControlType in TAB_TYPES:
                    name = control.Name
                    if matches_dsh_title(name) and not name.startswith("Windows 通知"):
                        candidates.append((hwnd, control))
                        break
            if candidates:
                break
    if not candidates:
        return {"reused": False, "closed": False}
    hwnd, tab = candidates[0]
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    if tab is not None:
        record("select")
        pattern = tab.GetSelectionItemPattern()
        if pattern is None:
            raise RuntimeError("The existing dsh tab does not expose selection")
        pattern.Select()
        tab.SetFocus()
    else:
        record("focus", selectedTab=False)
    closed = False
    if not close_handoff:
        stop_taskbar_attention(hwnd)
        record("done", closed=False)
        return {"reused": True, "closed": False}
    record("close")
    for browser in browser_windows():
        for control in controls(ui_control(browser), deadline):
            if control.ControlType in TAB_TYPES and marker in control.Name:
                for button in controls(control, deadline, max_depth=3):
                    if button.ControlType == 50000 and ("关闭" in button.Name or "close" in button.Name.lower()):
                        invoke = button.GetInvokePattern()
                        if invoke is not None:
                            invoke.Invoke()
                            closed = True
                            break
                break
    stop_taskbar_attention(hwnd)
    record("done", closed=closed)
    return {"reused": True, "closed": closed}


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    marker = payload["marker"]
    if not isinstance(marker, str) or not marker.startswith("dsh-notification-receipt-") or len(marker) > 80:
        raise ValueError("Invalid notification handoff marker")
    close_handoff = payload.get("closeHandoff", False)
    if not isinstance(close_handoff, bool):
        raise ValueError("Invalid notification handoff option")
    try:
        print(json.dumps(reuse(marker, close_handoff)))
    except Exception:
        Path(__file__).with_name("reuse-errors.log").write_text(traceback.format_exc(), encoding="utf-8")
        raise
