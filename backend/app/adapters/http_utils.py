from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings


class AdapterConfigurationError(RuntimeError):
    pass


class AdapterRequestError(RuntimeError):
    pass


def require_api_key(value: str, name: str) -> str:
    if not value:
        raise AdapterConfigurationError(f"{name} is not configured")
    return value


def raise_for_provider_error(response: httpx.Response, provider: str) -> None:
    if response.status_code < 400:
        return
    try:
        payload: Any = response.json()
    except ValueError:
        payload = response.text
    raise AdapterRequestError(f"{provider} API error {response.status_code}: {payload}")


def local_storage_path(file_path: str) -> Path:
    path = Path(file_path)
    if path.is_absolute():
        return path
    return settings.storage_dir / path


def guess_mime_type(filename: str, fallback: str = "application/octet-stream") -> str:
    return mimetypes.guess_type(filename)[0] or fallback

