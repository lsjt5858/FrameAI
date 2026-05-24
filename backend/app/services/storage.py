from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import settings
from app.db import new_id


class UploadFileLike(Protocol):
    filename: str | None
    content_type: str | None
    file: BinaryIO


@dataclass(frozen=True)
class StoredFile:
    file_path: str
    mime_type: str
    name: str


def ensure_storage_dirs() -> None:
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    for child in ("uploads", "generated"):
        (settings.storage_dir / child).mkdir(parents=True, exist_ok=True)


def public_url(file_path: str) -> str:
    return f"/storage/{file_path.lstrip('/')}"


def infer_asset_type(mime_type: str | None, filename: str) -> str:
    mime = mime_type or ""
    suffix = Path(filename).suffix.lower()
    if mime.startswith("image/") or suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        return "image"
    if mime.startswith("video/") or suffix in {".mp4", ".mov", ".webm", ".mkv"}:
        return "video"
    if mime.startswith("audio/") or suffix in {".mp3", ".wav", ".m4a"}:
        return "audio"
    if suffix in {".txt", ".md", ".pdf", ".json", ".doc", ".docx"}:
        return "document"
    return "other"


def safe_filename(filename: str) -> str:
    basename = Path(filename or "asset").name
    stem = Path(basename).stem or "asset"
    suffix = Path(basename).suffix.lower()
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    if not normalized:
        normalized = "asset"
    return f"{normalized[:80]}{suffix}"


def save_upload(upload: UploadFileLike) -> StoredFile:
    ensure_storage_dirs()
    today = datetime.utcnow().strftime("%Y%m%d")
    relative_dir = Path("uploads") / today
    target_dir = settings.storage_dir / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{new_id('file')}_{safe_filename(upload.filename or 'asset')}"
    target = target_dir / filename
    with target.open("wb") as file_obj:
        shutil.copyfileobj(upload.file, file_obj)

    return StoredFile(
        file_path=str(relative_dir / filename),
        mime_type=upload.content_type or "application/octet-stream",
        name=upload.filename or filename,
    )


def save_generated_file(task_type: str, filename: str, content: bytes, mime_type: str) -> StoredFile:
    ensure_storage_dirs()
    today = datetime.utcnow().strftime("%Y%m%d")
    relative_dir = Path("generated") / task_type / today
    target_dir = settings.storage_dir / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{new_id('gen')}_{safe_filename(filename)}"
    target = target_dir / safe_name
    target.write_bytes(content)

    return StoredFile(
        file_path=str(relative_dir / safe_name),
        mime_type=mime_type,
        name=filename,
    )
