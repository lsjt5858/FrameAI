from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException

from app.adapters.registry import list_providers
from app.core.config import BACKEND_DIR, reload_settings, settings
from app.schemas import ProviderConfigUpdate


router = APIRouter(prefix="/settings", tags=["settings"])
LOCAL_ENV_PATH = BACKEND_DIR / ".env"
OPENAI_IMAGE_MODEL_OPTIONS = [
    {"value": "gpt-image-1.5", "label": "GPT Image 1.5"},
    {"value": "gpt-image-1", "label": "GPT Image 1"},
    {"value": "gpt-image-1-mini", "label": "GPT Image 1 Mini"},
    {"value": "chatgpt-image-latest", "label": "ChatGPT Image Latest"},
    {"value": "dall-e-3", "label": "DALL-E 3"},
    {"value": "dall-e-2", "label": "DALL-E 2"},
]
DASHSCOPE_TEXT_VIDEO_MODEL_OPTIONS = [
    {"value": "wan2.7-t2v", "label": "Wan 2.7 文生视频"},
    {"value": "wan2.6-t2v", "label": "Wan 2.6 文生视频"},
    {"value": "wan2.6-t2v-us", "label": "Wan 2.6 T2V US"},
    {"value": "wan2.5-t2v-preview", "label": "Wan 2.5 T2V Preview"},
    {"value": "wan2.2-t2v-plus", "label": "Wan 2.2 T2V Plus"},
    {"value": "wanx2.1-t2v-plus", "label": "Wanx 2.1 T2V Plus"},
    {"value": "wanx2.1-t2v-turbo", "label": "Wanx 2.1 T2V Turbo"},
    {"value": "wan2.1-t2v-plus", "label": "Wan 2.1 T2V Plus"},
    {"value": "wan2.1-t2v-turbo", "label": "Wan 2.1 T2V Turbo"},
]
DASHSCOPE_IMAGE_VIDEO_MODEL_OPTIONS = [
    {"value": "wan2.7-i2v", "label": "Wan 2.7 图生视频"},
    {"value": "wan2.5-i2v-preview", "label": "Wan 2.5 I2V Preview"},
    {"value": "wan2.2-i2v-flash", "label": "Wan 2.2 I2V Flash"},
    {"value": "wan2.2-kf2v-flash", "label": "Wan 2.2 首尾帧 Flash"},
    {"value": "wanx2.1-i2v-plus", "label": "Wanx 2.1 I2V Plus"},
    {"value": "wanx2.1-i2v-turbo", "label": "Wanx 2.1 I2V Turbo"},
    {"value": "wan2.1-i2v-plus", "label": "Wan 2.1 I2V Plus"},
    {"value": "wan2.1-i2v-turbo", "label": "Wan 2.1 I2V Turbo"},
]
VOLCENGINE_IMAGE_MODEL_OPTIONS = [
    {"value": "doubao-seedream-5-0-260128", "label": "Seedream 5.0 Lite"},
    {"value": "doubao-seedream-4-5-251128", "label": "Seedream 4.5"},
    {"value": "doubao-seedream-4-0-250828", "label": "Seedream 4.0"},
    {"value": "doubao-seedream-3-0-t2i-250415", "label": "Seedream 3.0"},
]
VOLCENGINE_TEXT_VIDEO_MODEL_OPTIONS = [
    {"value": "doubao-seedance-1-5-pro-251215", "label": "Seedance 1.5 Pro"},
    {"value": "doubao-seedance-1-0-pro-250528", "label": "Seedance 1.0 Pro"},
    {"value": "doubao-seedance-1-0-pro-fast-250610", "label": "Seedance 1.0 Pro Fast 250610"},
    {"value": "doubao-seedance-1-0-pro-fast-250528", "label": "Seedance 1.0 Pro Fast 250528"},
    {"value": "doubao-seedance-1-0-lite-t2v-250428", "label": "Seedance Lite T2V 250428"},
    {"value": "doubao-seedance-1-0-lite-t2v-250219", "label": "Seedance Lite T2V 250219"},
]
VOLCENGINE_IMAGE_VIDEO_MODEL_OPTIONS = [
    {"value": "doubao-seedance-1-5-pro-251215", "label": "Seedance 1.5 Pro"},
    {"value": "doubao-seedance-1-0-pro-250528", "label": "Seedance 1.0 Pro"},
    {"value": "doubao-seedance-1-0-pro-fast-250610", "label": "Seedance 1.0 Pro Fast 250610"},
    {"value": "doubao-seedance-1-0-lite-i2v-250428", "label": "Seedance Lite I2V 250428"},
    {"value": "doubao-seedance-1-0-lite-i2v-250219", "label": "Seedance Lite I2V 250219"},
]
PROVIDER_CONFIGS: dict[str, dict[str, Any]] = {
    "openai": {
        "name": "OpenAI Images",
        "description": "用于真实生图和参考图编辑。",
        "fields": [
            {
                "name": "api_key",
                "label": "API Key",
                "env": "OPENAI_API_KEY",
                "setting": "openai_api_key",
                "secret": True,
                "required": True,
                "placeholder": "sk-...",
            },
            {
                "name": "base_url",
                "label": "Base URL",
                "env": "OPENAI_BASE_URL",
                "setting": "openai_base_url",
                "advanced": True,
                "placeholder": "https://api.openai.com/v1",
            },
            {
                "name": "image_model",
                "label": "生图模型",
                "env": "OPENAI_IMAGE_MODEL",
                "setting": "openai_image_model",
                "required": True,
                "capability": "image",
                "capability_label": "生图",
                "options": OPENAI_IMAGE_MODEL_OPTIONS,
                "placeholder": "gpt-image-1",
            },
        ],
    },
    "dashscope_wan": {
        "name": "DashScope Wan Video",
        "description": "用于通义万相文生视频、图生视频。",
        "fields": [
            {
                "name": "api_key",
                "label": "API Key",
                "env": "DASHSCOPE_API_KEY",
                "setting": "dashscope_api_key",
                "secret": True,
                "required": True,
                "placeholder": "sk-...",
            },
            {
                "name": "region",
                "label": "区域",
                "env": "DASHSCOPE_REGION",
                "setting": "dashscope_region",
                "advanced": True,
                "options": [
                    {"value": "intl", "label": "intl"},
                    {"value": "cn", "label": "cn"},
                ],
                "placeholder": "intl 或 cn",
            },
            {
                "name": "text_video_model",
                "label": "文生视频模型",
                "env": "DASHSCOPE_TEXT_VIDEO_MODEL",
                "setting": "dashscope_text_video_model",
                "required": True,
                "capability": "text_video",
                "capability_label": "文生视频",
                "options": DASHSCOPE_TEXT_VIDEO_MODEL_OPTIONS,
                "placeholder": "wan2.7-t2v",
            },
            {
                "name": "image_video_model",
                "label": "图生视频模型",
                "env": "DASHSCOPE_IMAGE_VIDEO_MODEL",
                "setting": "dashscope_image_video_model",
                "required": True,
                "capability": "image_video",
                "capability_label": "图生视频",
                "options": DASHSCOPE_IMAGE_VIDEO_MODEL_OPTIONS,
                "placeholder": "wan2.7-i2v",
            },
        ],
    },
    "volcengine_ark": {
        "name": "Volcengine Ark / Doubao",
        "description": "用于火山方舟 Seedream 生图、Seedance 生视频。",
        "fields": [
            {
                "name": "api_key",
                "label": "API Key",
                "env": "VOLCENGINE_API_KEY",
                "setting": "volcengine_api_key",
                "secret": True,
                "required": True,
                "placeholder": "火山方舟 API Key",
            },
            {
                "name": "base_url",
                "label": "Base URL",
                "env": "VOLCENGINE_BASE_URL",
                "setting": "volcengine_base_url",
                "advanced": True,
                "placeholder": "https://ark.cn-beijing.volces.com/api/v3",
            },
            {
                "name": "image_model",
                "label": "生图模型",
                "env": "VOLCENGINE_IMAGE_MODEL",
                "setting": "volcengine_image_model",
                "required": True,
                "capability": "image",
                "capability_label": "生图",
                "options": VOLCENGINE_IMAGE_MODEL_OPTIONS,
                "placeholder": "doubao-seedream-3-0-t2i-250415",
            },
            {
                "name": "text_video_model",
                "label": "文生视频模型",
                "env": "VOLCENGINE_TEXT_VIDEO_MODEL",
                "setting": "volcengine_text_video_model",
                "required": True,
                "capability": "text_video",
                "capability_label": "文生视频",
                "options": VOLCENGINE_TEXT_VIDEO_MODEL_OPTIONS,
                "placeholder": "doubao-seedance-1-0-lite-t2v-250428",
            },
            {
                "name": "image_video_model",
                "label": "图生视频模型",
                "env": "VOLCENGINE_IMAGE_VIDEO_MODEL",
                "setting": "volcengine_image_video_model",
                "required": True,
                "capability": "image_video",
                "capability_label": "图生视频",
                "options": VOLCENGINE_IMAGE_VIDEO_MODEL_OPTIONS,
                "placeholder": "doubao-seedance-1-0-pro-250528",
            },
        ],
    },
}


@router.get("/providers")
def providers() -> dict:
    return {"providers": list_providers()}


@router.get("/runtime")
def runtime() -> dict:
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "database_path": str(settings.database_path),
        "storage_dir": str(settings.storage_dir),
        "provider_env_path": str(LOCAL_ENV_PATH),
    }


@router.get("/provider-configs")
def provider_configs() -> dict:
    return {
        "env_path": str(LOCAL_ENV_PATH),
        "providers": [_serialize_provider_config(provider_id) for provider_id in PROVIDER_CONFIGS],
    }


@router.patch("/provider-configs/{provider_id}")
def update_provider_config(provider_id: str, payload: ProviderConfigUpdate) -> dict:
    spec = PROVIDER_CONFIGS.get(provider_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Provider config not found")

    fields_by_name = {field["name"]: field for field in spec["fields"]}
    unknown_fields = set(payload.values) - set(fields_by_name)
    unknown_secrets = set(payload.clear_secrets) - set(fields_by_name)
    if unknown_fields or unknown_secrets:
        raise HTTPException(status_code=400, detail="Unknown provider config field")

    env_updates: dict[str, str | None] = {}
    for field_name, raw_value in payload.values.items():
        field = fields_by_name[field_name]
        value = _clean_env_value(raw_value)
        if field.get("secret") and not value:
            continue
        env_updates[field["env"]] = value or None

    for field_name in payload.clear_secrets:
        field = fields_by_name[field_name]
        if not field.get("secret"):
            raise HTTPException(status_code=400, detail="Only secret fields can be cleared")
        env_updates[field["env"]] = None

    if env_updates:
        _write_local_env(env_updates)
        for key, value in env_updates.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        reload_settings()

    return {
        "env_path": str(LOCAL_ENV_PATH),
        "provider": _serialize_provider_config(provider_id),
        "providers": list_providers(),
    }


def _serialize_provider_config(provider_id: str) -> dict:
    spec = PROVIDER_CONFIGS[provider_id]
    return {
        "id": provider_id,
        "name": spec["name"],
        "description": spec["description"],
        "fields": [_serialize_config_field(field) for field in spec["fields"]],
    }


def _serialize_config_field(field: dict[str, Any]) -> dict:
    value = str(getattr(settings, field["setting"], "") or "")
    secret = bool(field.get("secret"))
    return {
        "name": field["name"],
        "label": field["label"],
        "env": field["env"],
        "secret": secret,
        "required": bool(field.get("required")),
        "advanced": bool(field.get("advanced")),
        "capability": field.get("capability", ""),
        "capability_label": field.get("capability_label", ""),
        "options": field.get("options", []),
        "value": "" if secret else value,
        "configured": bool(value) if secret else None,
        "masked_value": _mask_secret(value) if secret else "",
        "placeholder": field.get("placeholder", ""),
    }


def _clean_env_value(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = value.strip()
    if "\n" in cleaned or "\r" in cleaned:
        raise HTTPException(status_code=400, detail="Environment values cannot contain newlines")
    return cleaned


def _read_env_lines() -> list[str]:
    if not LOCAL_ENV_PATH.exists():
        return []
    return LOCAL_ENV_PATH.read_text(encoding="utf-8").splitlines()


def _write_local_env(updates: dict[str, str | None]) -> None:
    LOCAL_ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = _read_env_lines()
    rendered: list[str] = []
    seen: set[str] = set()

    for raw_line in lines:
        key = _extract_env_key(raw_line)
        if not key or key not in updates:
            rendered.append(raw_line)
            continue
        seen.add(key)
        value = updates[key]
        if value is not None:
            rendered.append(f"{key}={_format_env_value(value)}")

    missing_updates = [(key, value) for key, value in updates.items() if key not in seen and value is not None]
    if missing_updates and rendered and rendered[-1].strip():
        rendered.append("")
    for key, value in missing_updates:
        rendered.append(f"{key}={_format_env_value(value)}")

    LOCAL_ENV_PATH.write_text("\n".join(rendered).rstrip() + "\n", encoding="utf-8")


def _extract_env_key(raw_line: str) -> str | None:
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None
    key = line.split("=", 1)[0].strip()
    return key or None


def _format_env_value(value: str) -> str:
    if any(char.isspace() for char in value) or "#" in value:
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return value


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "已保存"
    return f"{value[:4]}...{value[-4:]}"
