"""Read the foreground window without activating or changing any window."""
import ctypes
import re
from ctypes import wintypes


def matches_dsh_title(title):
    """Recognize the product suffix in normal browser and desktop titles."""
    return bool(re.search(r"(?:^| — | - )(?:DeepSeek Harness|DSH Local Build|DSH 本地构建)(?:$| - | 和另外 )", title))


def is_dsh_foreground():
    """A minimized window is never treated as the foreground dsh document."""
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.IsIconic.argtypes = [wintypes.HWND]
    user32.IsIconic.restype = wintypes.BOOL
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetWindowTextW.restype = ctypes.c_int
    window = user32.GetForegroundWindow()
    if not window or user32.IsIconic(window):
        return False
    title = ctypes.create_unicode_buffer(2048)
    user32.GetWindowTextW(window, title, len(title))
    return matches_dsh_title(title.value)


def suppress_for_focus(payload, foreground):
    """The independent preference overrides both document and native focus detection."""
    return not payload.get("notifyWhenFocused", False) and (payload.get("pageFocused", False) or foreground)
