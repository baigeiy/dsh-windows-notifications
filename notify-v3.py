"""Show a branded toast with acknowledgement and click-to-open removal."""
import json
import sys
from datetime import datetime, timedelta, timezone
from xml.sax.saxutils import escape, quoteattr
from foreground import is_dsh_foreground, suppress_for_focus
from identity import ensure_identity


def build_xml(payload):
    open_uri = payload["url"]
    return (
        f'<toast activationType="protocol" launch={quoteattr(open_uri)}>'
        '<visual><binding template="ToastGeneric">'
        f'<image placement="appLogoOverride" src={quoteattr(payload["icon"])}/>'
        f'<text>{escape(payload["title"])}</text><text>{escape(payload["body"])}</text>'
        '</binding></visual><actions>'
        '<action content="确认收到" activationType="system" arguments="dismiss"/>'
        f'<action content="打开 dsh" activationType="protocol" arguments={quoteattr(open_uri)} afterActivationBehavior="default"/>'
        '</actions><audio src="ms-winsoundevent:Notification.Default"/></toast>'
    )


def main(payload):
    if suppress_for_focus(payload, is_dsh_foreground()):
        print("skipped-focused")
        return
    from winrt.windows.data.xml.dom import XmlDocument
    from winrt.windows.ui.notifications import ToastNotification, ToastNotificationManager
    app_id = ensure_identity(payload)
    document = XmlDocument()
    document.load_xml(build_xml(payload))
    notifier = ToastNotificationManager.create_toast_notifier_with_id(app_id)
    toast = ToastNotification(document)
    toast.tag = payload["tag"]
    toast.group = "dsh-local"
    toast.expiration_time = datetime.now(timezone.utc) + timedelta(days=1)
    notifier.show(toast)
    print("submitted")


if __name__ == "__main__":
    sys.stdin.reconfigure(encoding="utf-8")
    main(json.load(sys.stdin))
