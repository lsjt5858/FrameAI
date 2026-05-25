from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from pathlib import Path


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_env_file(path: Path, *, override: bool = False) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and (override or key not in os.environ):
            os.environ[key] = value


def load_env_files(*, override: bool = False) -> None:
    for env_path in (REPO_ROOT / ".env", BACKEND_DIR / ".env"):
        _load_env_file(env_path, override=override)


load_env_files()


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


@dataclass
class Settings:
    app_name: str = "FrameAI"
    app_version: str = "0.1.0"
    repo_root: Path = REPO_ROOT
    backend_dir: Path = BACKEND_DIR
    database_path: Path = field(
        default_factory=lambda: _resolve_path(
            os.getenv("FRAMEAI_DATABASE_PATH"),
            REPO_ROOT / "data" / "frameai.sqlite3",
        )
    )
    storage_dir: Path = field(
        default_factory=lambda: _resolve_path(
            os.getenv("FRAMEAI_STORAGE_DIR"),
            REPO_ROOT / "storage",
        )
    )
    public_storage_base_url: str = field(default_factory=lambda: os.getenv("FRAMEAI_PUBLIC_STORAGE_BASE_URL", "").rstrip("/"))
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_base_url: str = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"))
    openai_image_model: str = field(default_factory=lambda: os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1"))
    dashscope_api_key: str = field(default_factory=lambda: os.getenv("DASHSCOPE_API_KEY", ""))
    dashscope_region: str = field(default_factory=lambda: os.getenv("DASHSCOPE_REGION", "intl"))
    dashscope_text_video_model: str = field(default_factory=lambda: os.getenv("DASHSCOPE_TEXT_VIDEO_MODEL", "wan2.7-t2v"))
    dashscope_image_video_model: str = field(default_factory=lambda: os.getenv("DASHSCOPE_IMAGE_VIDEO_MODEL", "wan2.7-i2v"))
    dashscope_poll_interval_seconds: float = field(default_factory=lambda: float(os.getenv("DASHSCOPE_POLL_INTERVAL_SECONDS", "15")))
    dashscope_timeout_seconds: float = field(default_factory=lambda: float(os.getenv("DASHSCOPE_TIMEOUT_SECONDS", "600")))
    volcengine_api_key: str = field(default_factory=lambda: os.getenv("VOLCENGINE_API_KEY", ""))
    volcengine_base_url: str = field(
        default_factory=lambda: os.getenv(
            "VOLCENGINE_BASE_URL",
            "https://ark.cn-beijing.volces.com/api/v3",
        ).rstrip("/")
    )
    volcengine_image_model: str = field(default_factory=lambda: os.getenv("VOLCENGINE_IMAGE_MODEL", "doubao-seedream-3-0-t2i-250415"))
    volcengine_text_video_model: str = field(
        default_factory=lambda: os.getenv(
            "VOLCENGINE_TEXT_VIDEO_MODEL",
            "doubao-seedance-1-0-lite-t2v-250428",
        )
    )
    volcengine_image_video_model: str = field(
        default_factory=lambda: os.getenv(
            "VOLCENGINE_IMAGE_VIDEO_MODEL",
            "doubao-seedance-1-0-pro-250528",
        )
    )
    volcengine_poll_interval_seconds: float = field(default_factory=lambda: float(os.getenv("VOLCENGINE_POLL_INTERVAL_SECONDS", "15")))
    volcengine_timeout_seconds: float = field(default_factory=lambda: float(os.getenv("VOLCENGINE_TIMEOUT_SECONDS", "900")))
    cors_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("FRAMEAI_CORS_ORIGINS"),
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
        )
    )


settings = Settings()


def reload_settings() -> Settings:
    load_env_files(override=True)
    next_settings = Settings()
    for item in fields(settings):
        setattr(settings, item.name, getattr(next_settings, item.name))
    return settings
