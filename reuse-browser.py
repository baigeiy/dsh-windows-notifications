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
import uiautomation as auto
from comtypes import COMError
from foreground import matches_dsh_title

TAB_TYPES = {50019, 50024}
BROWSER_CLASSES = {"Chrome_WidgetWin_1", "MozillaWindowClass"}
BROWSER_PROGRAMS = {"msedge.exe", "chrome.exe", "firefox.exe", "brave.exe", "vivaldi.exe", "opera.exe"}
STATE = Path(__file__).with_name("reuse-state.json")


def record(phase, **details):
    STATE.write_text(json.dumps({"time": time.time(), "phase": phase, **details}), encoding="utf-8")


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


def focus_window(hwnd):
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    if win32gui.GetForegroundWindow() == hwnd:
        return
    try:
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)
    except win32gui.error:
        # Windows can restrict foreground activation by a background helper.
        auto.ControlFromHandle(hwnd).SetFocus()
    if win32gui.GetForegroundWindow() == hwnd:
        return
    current_thread = win32api.GetCurrentThreadId()
    foreground = win32gui.GetForegroundWindow()
    foreground_thread = win32process.GetWindowThreadProcessId(foreground)[0] if foreground else current_thread
    attached = False
    try:
        if foreground_thread != current_thread:
            try:
                win32process.AttachThreadInput(current_thread, foreground_thread, True)
                attached = True
            except win32process.error:
                # Cross-integrity foreground threads can deny input attachment.
                auto.ControlFromHandle(hwnd).SetFocus()
                if win32gui.GetForegroundWindow() == hwnd:
                    return
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)
    finally:
        if attached:
            win32process.AttachThreadInput(current_thread, foreground_thread, False)


def reuse(marker):
    record("scan")
    deadline = time.monotonic() + 10
    candidates = []
    windows = browser_windows()
    record("scan", windows=len(windows))
    for hwnd in windows:
        root = auto.ControlFromHandle(hwnd)
        for control in controls(root, deadline):
            if control.ControlType in TAB_TYPES:
                name = control.Name
                if matches_dsh_title(name) and not name.startswith("Windows 通知"):
                    candidates.append((hwnd, control))
        if candidates:
            break
    if not candidates:
        for window in browser_windows():
            if matches_dsh_title(win32gui.GetWindowText(window)):
                candidates.append((window, None))
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
        focus_window(hwnd)
    closed = False
    record("close")
    for browser in browser_windows():
        for control in controls(auto.ControlFromHandle(browser), deadline):
            if control.ControlType in TAB_TYPES and marker in control.Name:
                for button in controls(control, deadline, max_depth=3):
                    if button.ControlType == 50000 and ("关闭" in button.Name or "close" in button.Name.lower()):
                        invoke = button.GetInvokePattern()
                        if invoke is not None:
                            invoke.Invoke()
                            closed = True
                            break
                break
    record("done", closed=closed)
    return {"reused": True, "closed": closed}


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    marker = payload["marker"]
    if not isinstance(marker, str) or not marker.startswith("dsh-notification-receipt-") or len(marker) > 80:
        raise ValueError("Invalid notification handoff marker")
    try:
        print(json.dumps(reuse(marker)))
    except Exception:
        Path(__file__).with_name("reuse-errors.log").write_text(traceback.format_exc(), encoding="utf-8")
        raise
