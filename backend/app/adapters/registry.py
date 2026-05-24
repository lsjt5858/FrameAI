from __future__ import annotations

from app.adapters.base import GenerationAdapter
from app.adapters.dashscope_wan import DashScopeWanVideoAdapter
from app.adapters.mock import MockGenerationAdapter
from app.adapters.openai_image import OpenAIImageAdapter
from app.core.config import settings


_ADAPTERS: dict[str, GenerationAdapter] = {
    "mock": MockGenerationAdapter(),
    "openai": OpenAIImageAdapter(),
    "dashscope_wan": DashScopeWanVideoAdapter(),
}


def get_adapter(provider: str) -> GenerationAdapter:
    try:
        return _ADAPTERS[provider]
    except KeyError as exc:
        raise ValueError(f"Unknown generation provider: {provider}") from exc


def list_providers() -> list[dict[str, str | bool | None]]:
    return [
        {
            "id": "mock",
            "name": "Mock Provider",
            "kind": "image_video",
            "image_model": "mock-image-v1",
            "video_model": "mock-video-v1",
            "configured": True,
            "description": "本地占位 adapter，用于验证任务、素材和日志链路。",
        },
        {
            "id": "openai",
            "name": "OpenAI Images",
            "kind": "image",
            "image_model": settings.openai_image_model,
            "video_model": None,
            "configured": bool(settings.openai_api_key),
            "description": "真实生图 adapter。配置 OPENAI_API_KEY 后可用，支持文本生图和参考图编辑。",
        },
        {
            "id": "dashscope_wan",
            "name": "DashScope Wan Video",
            "kind": "video",
            "image_model": None,
            "video_model": settings.dashscope_image_video_model,
            "configured": bool(settings.dashscope_api_key),
            "description": "真实生视频 adapter。配置 DASHSCOPE_API_KEY 后可用，图生视频需要公网图片 URL。",
        },
    ]
