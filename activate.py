"""Acknowledge a toast, remove it from Windows history and optionally open dsh."""
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
import webbrowser

from identity_constants import APP_ID, PROTOCOL

DIRECTORY = Path(__file__).resolve().parent


def acknowledge(tag):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", tag):
        raise ValueError("Invalid notification tag")
    from winrt.windows.ui.notifications import ToastNotificationManager
    ToastNotificationManager.history.remove_grouped_tag_with_id(tag, "dsh-local", APP_ID)


def main(argument):
    settings = json.loads((DIRECTORY / "runtime.json").read_text(encoding="utf-8"))
    url = settings["baseUrl"]
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("Notification activation requires a local dsh URL")
    if argument == "--open":
        preferences_file = DIRECTORY / "settings.json"
        preferences = json.loads(preferences_file.read_text(encoding="utf-8")) if preferences_file.exists() else {}
        opening_enabled = preferences.get("openDshOnClick", True)
        if not isinstance(opening_enabled, bool):
            raise ValueError("openDshOnClick must be a boolean")
        if opening_enabled:
            webbrowser.open(url)
    else:
        activation = urlparse(argument)
        query = parse_qs(activation.query)
        token = query.get("token", [""])[0]
        if activation.scheme != PROTOCOL or activation.netloc != "open" or activation.path not in ("", "/") or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token) or set(query) != {"token"} or len(query["token"]) != 1:
            raise ValueError("Invalid notification activation")
        origin = f"{parsed.scheme}://{parsed.netloc}"
        suffix = "?" + urlencode({"token": token})
        # The HTTP receipt is consumed by this hidden process, never a browser tab.
        with urlopen(origin + "/dsh-notifications/ack" + suffix, timeout=20) as response:
            response.read()
        with urlopen(Request(origin + "/dsh-notifications/reuse" + suffix, method="POST"), timeout=20) as response:
            result = json.load(response)
        if result["reused"] is False and not result.get("openingDisabled", False):
            webbrowser.open(url)


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except Exception as error:
        with (DIRECTORY / "activation-errors.log").open("a", encoding="utf-8") as log:
            log.write(f"{type(error).__name__}: {error}\n")
        raise
