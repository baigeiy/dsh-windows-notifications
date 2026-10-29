"""Check tab reuse without selecting or focusing any real browser window."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location("reuse_browser", Path(__file__).with_name("reuse-browser.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def control(kind, name="", children=()):
    item = MagicMock()
    item.ControlType = kind
    item.Name = name
    item.GetChildren.return_value = list(children)
    return item


class ReuseTests(unittest.TestCase):
    def setUp(self):
        recorder = patch.object(module, "record")
        recorder.start()
        self.addCleanup(recorder.stop)
        titles = patch.object(module.win32gui, "GetWindowText", return_value="普通网页")
        titles.start()
        self.addCleanup(titles.stop)
        flash = patch.object(module.win32gui, "FlashWindowEx", return_value=False)
        self.flash = flash.start()
        self.addCleanup(flash.stop)

    def test_foreground_browser_needs_no_thread_input_attachment(self):
        with patch.object(module.win32gui, "IsIconic", return_value=False), patch.object(module.win32gui, "GetForegroundWindow", return_value=42), patch.object(module.win32process, "AttachThreadInput") as attach:
            module.focus_window(42)
        attach.assert_not_called()

    def test_direct_foreground_activation_needs_no_thread_input_attachment(self):
        with patch.object(module.win32gui, "IsIconic", return_value=False), patch.object(module.win32gui, "GetForegroundWindow", side_effect=[5, 42]), patch.object(module.win32gui, "BringWindowToTop"), patch.object(module.win32gui, "SetForegroundWindow"), patch.object(module.win32process, "AttachThreadInput") as attach:
            module.focus_window(42)
        attach.assert_not_called()

    def test_foreground_change_is_accepted_when_windows_api_reports_an_error(self):
        with patch.object(module.win32gui, "IsIconic", return_value=False), patch.object(module.win32gui, "GetForegroundWindow", side_effect=[5, 42]), patch.object(module.win32gui, "BringWindowToTop"), patch.object(module.win32gui, "SetForegroundWindow", side_effect=module.win32gui.error(0, "SetForegroundWindow", "")), patch.object(module, "ui_control") as accessibility:
            module.focus_window(42)
        accessibility.assert_not_called()

    def test_failed_native_foreground_change_reports_denial(self):
        with patch.object(module.win32gui, "IsIconic", return_value=False), patch.object(module.win32gui, "GetForegroundWindow", return_value=5), patch.object(module.win32gui, "BringWindowToTop"), patch.object(module.win32gui, "SetForegroundWindow", side_effect=module.win32gui.error(0, "SetForegroundWindow", "")):
            with self.assertRaises(module.win32gui.error):
                module.focus_window(42)

    def test_denied_native_activation_falls_back_to_the_existing_tab(self):
        existing = control(50019, "工作 — DSH 本地构建")
        root = control(50032, children=[existing])
        with patch.object(module, "browser_windows", return_value=[42]), patch.object(module.win32gui, "GetWindowText", return_value="工作 — DSH 本地构建"), patch.object(module, "focus_window", side_effect=module.win32gui.error(0, "SetForegroundWindow", "")), patch.object(module, "ui_control", return_value=root):
            result = module.reuse("dsh-notification-receipt-test")
        self.assertTrue(result["reused"])
        existing.GetSelectionItemPattern.return_value.Select.assert_called_once()
        existing.SetFocus.assert_called_once()
        self.flash.assert_called_once_with(42, module.win32con.FLASHW_STOP, 0, 0)

    def test_selects_existing_background_tab_and_closes_only_receipt(self):
        existing = control(50019, "正在工作 — DSH 本地构建")
        unrelated = control(50019, "其他网页")
        close = control(50000, "关闭标签页")
        bridge = control(50019, "dsh-notification-receipt-test", [close])
        root = control(50032, children=[unrelated, existing, bridge])
        with patch.object(module, "browser_windows", return_value=[42]), patch.object(module, "ui_control", return_value=root), patch.object(module, "focus_window") as focus:
            result = module.reuse("dsh-notification-receipt-test", close_handoff=True)
        self.assertEqual(result, {"reused": True, "closed": True})
        focus.assert_not_called()
        existing.GetSelectionItemPattern.return_value.Select.assert_called_once()
        existing.SetFocus.assert_called_once()
        unrelated.GetSelectionItemPattern.assert_not_called()
        close.GetInvokePattern.return_value.Invoke.assert_called_once()
        self.flash.assert_called_once_with(42, module.win32con.FLASHW_STOP, 0, 0)

    def test_restores_minimized_browser_before_foregrounding(self):
        with patch.object(module.win32gui, "IsIconic", return_value=True), patch.object(module.win32gui, "ShowWindow") as restore, patch.object(module.win32gui, "GetForegroundWindow", side_effect=[5, 42]), patch.object(module.win32gui, "BringWindowToTop"), patch.object(module.win32gui, "SetForegroundWindow"):
            module.focus_window(42)
        restore.assert_called_once_with(42, module.win32con.SW_RESTORE)

    def test_no_existing_dsh_tab_reports_absence_without_opening_pages(self):
        root = control(50032, children=[control(50019, "普通网页")])
        with patch.object(module, "browser_windows", return_value=[42]), patch.object(module, "ui_control", return_value=root), patch.object(module.win32gui, "GetWindowText", return_value="普通网页"), patch.object(module, "focus_window") as focus:
            result = module.reuse("dsh-notification-receipt-test")
        self.assertFalse(result["reused"])
        focus.assert_not_called()
        self.flash.assert_not_called()

    def test_does_not_search_a_web_documents_content_for_tab_titles(self):
        fake_tab = control(50019, "正文 — DSH 本地构建")
        document = control(50030, children=[fake_tab])
        root = control(50032, children=[document])
        with patch.object(module, "browser_windows", return_value=[42]), patch.object(module, "ui_control", return_value=root), patch.object(module.win32gui, "GetWindowText", return_value="普通网页"):
            self.assertFalse(module.reuse("dsh-notification-receipt-test")["reused"])
        document.GetChildren.assert_not_called()

    def test_selected_dsh_window_avoids_accessibility_scan(self):
        with patch.object(module, "browser_windows", return_value=[5, 42]), patch.object(module.win32gui, "GetWindowText", side_effect=["普通网页", "工作 — DSH 本地构建"]), patch.object(module, "ui_control") as accessibility, patch.object(module, "focus_window") as focus:
            result = module.reuse("dsh-notification-receipt-test")
        self.assertEqual(result, {"reused": True, "closed": False})
        accessibility.assert_not_called()
        focus.assert_called_once_with(42)
        self.flash.assert_called_once_with(42, module.win32con.FLASHW_STOP, 0, 0)

    def test_hidden_dsh_tab_stops_at_first_match_and_skips_handoff_scan(self):
        existing = control(50019, "工作 — DSH 本地构建")
        unused = control(50032)
        root = control(50032, children=[existing, unused])
        with patch.object(module, "browser_windows", return_value=[42]) as windows, patch.object(module, "ui_control", return_value=root) as accessibility:
            result = module.reuse("dsh-notification-receipt-test")
        self.assertTrue(result["reused"])
        self.assertEqual(windows.call_count, 1)
        self.assertEqual(accessibility.call_count, 1)
        existing.GetChildren.assert_not_called()
        unused.GetChildren.assert_not_called()


unittest.main()
