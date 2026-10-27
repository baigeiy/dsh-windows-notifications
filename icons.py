"""Decode an uploaded local icon into a bounded transparent notification bitmap."""
import base64
import io
import json
from pathlib import Path
import sys
from PIL import Image

DIRECTORY = Path(__file__).resolve().parent
Image.MAX_IMAGE_PIXELS = 16_000_000
payload = json.load(sys.stdin)
role = payload["role"]
if role not in ("app", "notification"):
    raise ValueError("Invalid icon role")
data = base64.b64decode(payload["data"], validate=True)
if len(data) > 4 * 1024 * 1024:
    raise ValueError("Icon file exceeds 4 MiB")
with Image.open(io.BytesIO(data)) as source:
    if source.width > 4096 or source.height > 4096:
        raise ValueError("Icon dimensions exceed 4096 pixels")
    image = source.convert("RGBA")
    image.thumbnail((256, 256), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (256, 256))
    output.alpha_composite(image, ((256 - image.width) // 2, (256 - image.height) // 2))
    temp = DIRECTORY / f"custom-{role}.tmp.png"
    output.save(temp)
    temp.replace(DIRECTORY / f"custom-{role}.png")
print("icon-ready")
