"""Foreground activation and taskbar attention for one known browser window."""
import win32con
import win32gui


class NativeFocusDenied(RuntimeError):
    """Windows did not grant native foreground activation; tab selection can recover."""



def focus_window(hwnd):
    """Activate natively or report denial so the caller can select the browser tab."""
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    if win32gui.GetForegroundWindow() == hwnd:
        return
    try:
        win32gui.BringWindowToTop(hwnd)
        win32gui.SetForegroundWindow(hwnd)
    except win32gui.error:
        if win32gui.GetForegroundWindow() == hwnd:
            return
        raise
    if win32gui.GetForegroundWindow() != hwnd:
        raise NativeFocusDenied("Windows did not foreground the DSH browser window")


def stop_taskbar_attention(hwnd):
    """Clear the activation request's taskbar flash on the selected browser window."""
    win32gui.FlashWindowEx(hwnd, win32con.FLASHW_STOP, 0, 0)
