from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[3]


def _resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback.resolve()

    path = Path(value).expanduser()
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path.resolve()


def _split_csv(value: str | None, fallback: list[str]) -> list[str]:
    if not value:
        return fallback
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "FrameAI"
    app_version: str = "0.1.0"
    repo_root: Path = REPO_ROOT
    backend_dir: Path = BACKEND_DIR
    database_path: Path = _resolve_path(
        os.getenv("FRAMEAI_DATABASE_PATH"),
        REPO_ROOT / "data" / "frameai.sqlite3",
    )
    storage_dir: Path = _resolve_path(
        os.getenv("FRAMEAI_STORAGE_DIR"),
        REPO_ROOT / "storage",
    )
    public_storage_base_url: str = os.getenv("FRAMEAI_PUBLIC_STORAGE_BASE_URL", "").rstrip("/")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    openai_image_model: str = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
    dashscope_api_key: str = os.getenv("DASHSCOPE_API_KEY", "")
    dashscope_region: str = os.getenv("DASHSCOPE_REGION", "intl")
    dashscope_text_video_model: str = os.getenv("DASHSCOPE_TEXT_VIDEO_MODEL", "wan2.7-t2v")
    dashscope_image_video_model: str = os.getenv("DASHSCOPE_IMAGE_VIDEO_MODEL", "wan2.7-i2v")
    dashscope_poll_interval_seconds: float = float(os.getenv("DASHSCOPE_POLL_INTERVAL_SECONDS", "15"))
    dashscope_timeout_seconds: float = float(os.getenv("DASHSCOPE_TIMEOUT_SECONDS", "600"))
    cors_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "cors_origins",
            _split_csv(
                os.getenv("FRAMEAI_CORS_ORIGINS"),
                [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ],
            ),
        )


settings = Settings()
