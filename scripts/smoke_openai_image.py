from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


API_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + "/images/generations"
MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
PROMPT = os.getenv("FRAMEAI_SMOKE_PROMPT", "A clean production storyboard frame for an AI video workflow dashboard")
OUTPUT = Path(os.getenv("FRAMEAI_SMOKE_OUTPUT", "storage/openai-smoke.png"))


def main() -> int:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is not set", file=sys.stderr)
        return 2

    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "size": "1024x1024",
        "n": 1,
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
        print(f"OpenAI request failed: {exc}", file=sys.stderr)
        return 1

    data = body.get("data") or []
    if not data or not data[0].get("b64_json"):
        print(f"OpenAI response did not contain b64_json: {body}", file=sys.stderr)
        return 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(base64.b64decode(data[0]["b64_json"]))
    print(f"wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

