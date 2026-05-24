from __future__ import annotations

from app.adapters.base import GenerationAdapter
from app.adapters.mock import MockGenerationAdapter


_ADAPTERS: dict[str, GenerationAdapter] = {
    "mock": MockGenerationAdapter(),
}


def get_adapter(provider: str) -> GenerationAdapter:
    try:
        return _ADAPTERS[provider]
    except KeyError as exc:
        raise ValueError(f"Unknown generation provider: {provider}") from exc


def list_providers() -> list[dict[str, str]]:
    return [
        {
            "id": "mock",
            "name": "Mock Provider",
            "image_model": "mock-image-v1",
            "video_model": "mock-video-v1",
            "description": "本地占位 adapter，用于验证任务、素材和日志链路。",
        }
    ]

