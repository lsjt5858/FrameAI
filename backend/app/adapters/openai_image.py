from __future__ import annotations

import base64
from typing import Any

import httpx

from app import repositories
from app.adapters.base import GenerationArtifact
from app.adapters.http_utils import (
    guess_mime_type,
    local_storage_path,
    raise_for_provider_error,
    require_api_key,
)
from app.core.config import settings


class OpenAIImageAdapter:
    provider = "openai"

    async def generate_image(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        api_key = require_api_key(settings.openai_api_key, "OPENAI_API_KEY")
        if task.get("reference_asset_ids"):
            return await self._edit_images(task, api_key)
        return await self._generate_images(task, api_key)

    async def generate_video(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        raise NotImplementedError("OpenAIImageAdapter only supports image generation")

    async def get_task_status(self, external_task_id: str) -> dict[str, Any]:
        return {"external_task_id": external_task_id, "status": "unsupported"}

    async def download_result(self, result_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(result_url)
            raise_for_provider_error(response, self.provider)
            return response.content

    async def _generate_images(self, task: dict[str, Any], api_key: str) -> list[GenerationArtifact]:
        params = task.get("params", {})
        payload = {
            "model": task.get("model") or settings.openai_image_model,
            "prompt": task["prompt"],
            "n": _safe_count(params.get("count"), default=1, limit=8),
            "size": _openai_size(params.get("resolution"), params.get("aspect_ratio")),
        }
        quality = params.get("quality")
        if quality:
            payload["quality"] = quality

        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{settings.openai_base_url}/images/generations",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            raise_for_provider_error(response, self.provider)
            return _artifacts_from_openai_response(response.json(), "openai-image")

    async def _edit_images(self, task: dict[str, Any], api_key: str) -> list[GenerationArtifact]:
        params = task.get("params", {})
        data = {
            "model": task.get("model") or settings.openai_image_model,
            "prompt": task["prompt"],
            "n": str(_safe_count(params.get("count"), default=1, limit=8)),
            "size": _openai_size(params.get("resolution"), params.get("aspect_ratio")),
        }
        files = []
        opened_files = []
        try:
            for asset_id in task.get("reference_asset_ids", []):
                asset = repositories.get_asset(asset_id)
                if not asset:
                    continue
                path = local_storage_path(asset["file_path"])
                file_obj = path.open("rb")
                opened_files.append(file_obj)
                files.append(("image[]", (path.name, file_obj, asset.get("mime_type") or guess_mime_type(path.name))))
            if not files:
                return await self._generate_images(task, api_key)

            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(
                    f"{settings.openai_base_url}/images/edits",
                    headers={"Authorization": f"Bearer {api_key}"},
                    data=data,
                    files=files,
                )
                raise_for_provider_error(response, self.provider)
                return _artifacts_from_openai_response(response.json(), "openai-image-edit")
        finally:
            for file_obj in opened_files:
                file_obj.close()


def _artifacts_from_openai_response(payload: dict[str, Any], prefix: str) -> list[GenerationArtifact]:
    artifacts: list[GenerationArtifact] = []
    for index, item in enumerate(payload.get("data", []), start=1):
        if item.get("b64_json"):
            content = base64.b64decode(item["b64_json"])
            mime_type = "image/png"
            filename = f"{prefix}-{index}.png"
        elif item.get("url"):
            # Some deployments return a URL instead of inline bytes. Preserve it as metadata manifest.
            content = item["url"].encode("utf-8")
            mime_type = "text/uri-list"
            filename = f"{prefix}-{index}.url"
        else:
            continue
        artifacts.append(
            GenerationArtifact(
                name=f"OpenAI image result {index}",
                asset_type="image",
                filename=filename,
                mime_type=mime_type,
                content=content,
                metadata={"raw_provider": "openai", "result_index": index},
            )
        )
    if not artifacts:
        raise RuntimeError("OpenAI image response did not include any results")
    return artifacts


def _openai_size(resolution: Any, aspect_ratio: Any) -> str:
    if resolution in {"1024x1024", "1536x1024", "1024x1536", "auto"}:
        return resolution
    if aspect_ratio == "9:16":
        return "1024x1536"
    if aspect_ratio == "16:9":
        return "1536x1024"
    return "1024x1024"


def _safe_count(value: Any, default: int, limit: int) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = default
    return max(1, min(count, limit))

