from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


BASE_URL = os.getenv("VOLCENGINE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
API_URL = f"{BASE_URL}/images/generations"
MODEL = os.getenv("VOLCENGINE_IMAGE_MODEL", "doubao-seedream-3-0-t2i-250415")
PROMPT = os.getenv(
    "FRAMEAI_SMOKE_PROMPT",
    "AI video storyboard frame, cinematic composition, clean character reference",
)
OUTPUT = Path(os.getenv("FRAMEAI_SMOKE_OUTPUT", "storage/volcengine-smoke.png"))


def main() -> int:
    api_key = os.getenv("VOLCENGINE_API_KEY")
    if not api_key:
        print("VOLCENGINE_API_KEY is not set", file=sys.stderr)
        return 2

    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "size": os.getenv("FRAMEAI_SMOKE_IMAGE_SIZE", "1024x1024"),
        "n": 1,
        "response_format": os.getenv("FRAMEAI_SMOKE_RESPONSE_FORMAT", "b64_json"),
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(exc.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"Volcengine Ark request failed: {exc}", file=sys.stderr)
        return 1

    data = body.get("data") or body.get("images") or []
    if isinstance(data, dict):
        data = [data]
    if not data:
        print(f"Volcengine Ark response did not contain image data: {body}", file=sys.stderr)
        return 1

    item = data[0]
    if item.get("b64_json") or item.get("image_base64") or item.get("base64"):
        encoded = item.get("b64_json") or item.get("image_base64") or item.get("base64")
        content = _decode_base64(encoded)
        output = OUTPUT
    elif item.get("url"):
        content, output = _download_url(item["url"])
    else:
        print(f"Volcengine Ark response did not contain b64_json or url: {body}", file=sys.stderr)
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(content)
    print(f"wrote {output}")
    return 0


def _decode_base64(value: str) -> bytes:
    if value.startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    return base64.b64decode(value)


def _download_url(url: str) -> tuple[bytes, Path]:
    with urllib.request.urlopen(url, timeout=180) as response:
        content = response.read()
    filename = Path(urlparse(url).path).name
    output = OUTPUT if not filename or "." not in filename else OUTPUT.with_name(filename)
    return content, output


if __name__ == "__main__":
    raise SystemExit(main())
