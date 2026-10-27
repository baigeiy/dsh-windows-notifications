"""Check foreground suppression and the independent override."""
import unittest
from unittest.mock import MagicMock, patch
from foreground import is_dsh_foreground, matches_dsh_title, suppress_for_focus


class FocusTests(unittest.TestCase):
    def test_background_notifies_and_focused_suppresses(self):
        self.assertFalse(suppress_for_focus({}, False))
        self.assertTrue(suppress_for_focus({}, True))
        self.assertTrue(suppress_for_focus({"pageFocused": True}, False))

    def test_switch_allows_foreground_notifications(self):
        self.assertFalse(suppress_for_focus({"notifyWhenFocused": True}, True))
        self.assertFalse(suppress_for_focus({"notifyWhenFocused": True, "pageFocused": True}, True))

    def test_browser_and_desktop_titles(self):
        for title in ["DeepSeek Harness", "Session - DSH Local Build - Microsoft Edge", "Session — DeepSeek Harness - Google Chrome", "Session — DSH Local Build 和另外 14 个页面 - 个人 - Microsoft Edge", "回答后结束对话 — DSH 本地构建 和另外 2 个页面 - 个人 - Microsoft Edge"]:
            self.assertTrue(matches_dsh_title(title), title)
        for title in ["ChatGPT", "YouTube - Microsoft Edge", "DSH Local Build notes - Notepad"]:
            self.assertFalse(matches_dsh_title(title), title)

    def test_minimized_window_does_not_suppress(self):
        user32 = MagicMock()
        user32.GetForegroundWindow.return_value = 123
        user32.IsIconic.return_value = True
        with patch("foreground.ctypes.WinDLL", return_value=user32):
            self.assertFalse(is_dsh_foreground())
            user32.GetWindowTextW.assert_not_called()


unittest.main()
