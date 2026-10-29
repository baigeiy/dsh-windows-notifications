"""Check local image URI handling with Windows' actual URL reader, without a toast."""
import ctypes
from pathlib import Path
import tempfile
import unittest
from xml.etree import ElementTree
import importlib.util

spec = importlib.util.spec_from_file_location("notify", Path(__file__).with_name("notify-v3.py"))
notify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notify)


class ImageTests(unittest.TestCase):
    def test_unicode_and_reserved_characters_round_trip(self):
        original = "file:///E:/%E4%B8%AD%E6%96%87%20%23%25%26/icon.png"
        self.assertEqual(notify.windows_image_uri(original), "file:///E:/中文%20%23%25%26/icon.png")

    def test_ascii_path_is_unchanged(self):
        original = "file:///E:/dsh-plugins/windows-notifications/whale-icon.png"
        self.assertEqual(notify.windows_image_uri(original), original)

    def test_xml_preserves_the_image_uri(self):
        payload = {"icon": "file:///E:/%E4%B8%AD%E6%96%87%20%23%25%26/icon.png",
                   "url": "dsh-local-notification://open?token=test", "title": "标题", "body": "正文"}
        xml = ElementTree.fromstring(notify.build_xml(payload))
        self.assertEqual(xml.find("./visual/binding/image").attrib["src"], "file:///E:/中文%20%23%25%26/icon.png")

    def test_disabled_opening_has_no_activation_url_or_open_button(self):
        payload = {"icon": "file:///E:/icon.png", "title": "标题", "body": "正文", "openDshOnClick": False}
        xml = ElementTree.fromstring(notify.build_xml(payload))
        self.assertEqual(xml.attrib, {"activationType": "background"})
        actions = xml.findall("./actions/action")
        self.assertEqual([action.attrib for action in actions], [{"content": "确认收到", "activationType": "system", "arguments": "dismiss"}])

    def test_existing_preferences_keep_click_to_open_enabled(self):
        payload = {"icon": "file:///E:/icon.png", "url": "dsh-local-notification://open?token=test", "title": "标题", "body": "正文"}
        xml = ElementTree.fromstring(notify.build_xml(payload))
        self.assertEqual(xml.attrib["activationType"], "protocol")
        self.assertEqual(xml.attrib["launch"], payload["url"])
        self.assertEqual(xml.findall("./actions/action")[-1].attrib["arguments"], payload["url"])

    def test_windows_reads_image_in_unicode_directory(self):
        source = Path(__file__).with_name("whale-icon.png")
        temp_root = Path(__file__).parent / "build" / "tmp"
        temp_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="图片 # %E6 & ", dir=temp_root) as directory:
            target = Path(directory) / "大肥鱼 # %E6 &.png"
            target.write_bytes(source.read_bytes())
            uri = notify.windows_image_uri(target.as_uri())
            reader = ctypes.WinDLL("urlmon").URLOpenBlockingStreamW
            reader.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_void_p), ctypes.c_ulong, ctypes.c_void_p]
            reader.restype = ctypes.c_long
            stream = ctypes.c_void_p()
            result = reader(None, uri, ctypes.byref(stream), 0, None)
            try:
                self.assertEqual(result, 0, f"Windows image reader failed: {result & 0xffffffff:#x}")
                self.assertTrue(stream.value)
            finally:
                if stream.value:
                    table = ctypes.cast(stream, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
                    release = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)(table[2])
                    release(stream)


unittest.main()
