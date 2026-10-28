# Artwork

The MIT license covers this project's code. DeepSeek names and official whale artwork identify the supported product and are not a claim of official endorsement. The character image was supplied by the original user and its background was removed for this plugin. Artwork and third-party trademarks are not relicensed under the code license. You can replace both notification icons in Settings → Windows 通知.

# Bundled runtime

The Windows x64 archive includes CPython 3.13.17 from python.org and binary wheels pinned by requirements.lock. Python's license is included as runtime/LICENSE.txt. Third-party packages retain their own licenses and notices in runtime/Lib/*-dist-info and package directories: PyWinRT (winrt-runtime and Windows projections), pywin32, Pillow, UIAutomation, comtypes and typing_extensions. These components are not relicensed under this project's MIT license. native/manifest.json records the Python source URL and SHA256, archive SHA256, requirements-lock SHA256 and launcher-source SHA256. The C# launcher is built from notification-launcher.cs by build-runtime.ps1.
