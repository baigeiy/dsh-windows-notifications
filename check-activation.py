"""Check notification protocol handling without launching a browser or touching windows."""
import io
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import activate


class ActivationTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name)
        (path / "runtime.json").write_text(json.dumps({"baseUrl": "http://127.0.0.1:3080/"}), encoding="utf-8")
        location = patch.object(activate, "DIRECTORY", path)
        location.start()
        self.addCleanup(location.stop)
        self.uri = "dsh-local-notification://open?token=" + "a" * 43

    def test_existing_tab_is_reused_without_creating_any_browser_page(self):
        with patch.object(activate, "urlopen", side_effect=[io.BytesIO(b"unused receipt HTML"), io.BytesIO(b'{"reused":true,"closed":false}')]) as request, patch.object(activate.webbrowser, "open") as browser:
            activate.main(self.uri)
        browser.assert_not_called()
        self.assertEqual(request.call_count, 2)
        self.assertEqual(request.call_args.args[0].method, "POST")

    def test_absent_dsh_opens_one_product_page(self):
        with patch.object(activate, "urlopen", side_effect=[io.BytesIO(b""), io.BytesIO(b'{"reused":false,"closed":false}')]), patch.object(activate.webbrowser, "open") as browser:
            activate.main(self.uri)
        browser.assert_called_once_with("http://127.0.0.1:3080/")

    def test_invalid_or_failed_receipt_never_opens_a_duplicate_page(self):
        with patch.object(activate, "urlopen") as request, patch.object(activate.webbrowser, "open") as browser:
            with self.assertRaises(ValueError):
                activate.main("dsh-local-notification://open?token=bad")
            request.assert_not_called()
            request.side_effect = OSError("receipt rejected")
            with self.assertRaises(OSError):
                activate.main(self.uri)
        browser.assert_not_called()


unittest.main()
