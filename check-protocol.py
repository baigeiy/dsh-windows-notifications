"""Query Windows URI support without launching anything or changing focus."""
import asyncio
from winrt.windows.system import Launcher, LaunchQuerySupportType
from winrt.windows.foundation import Uri
from identity import PROTOCOL


async def main():
    url = PROTOCOL + "://open"
    status = await Launcher.query_uri_support_async(Uri(url), LaunchQuerySupportType.URI)
    print(url, status.name)
    if status.name != "AVAILABLE":
        raise RuntimeError("Windows cannot activate this notification protocol; run register-machine.py during local setup")


asyncio.run(main())
