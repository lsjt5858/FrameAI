from __future__ import annotations

import asyncio
import base64
from time import monotonic
from typing import Any
from urllib.parse import urlparse

import httpx

from app import repositories
from app.adapters.base import GenerationArtifact
from app.adapters.http_utils import raise_for_provider_error, require_api_key
from app.core.config import settings
from app.services.storage import external_storage_url


class VolcengineArkAdapter:
    provider = "volcengine_ark"

    async def generate_image(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        api_key = require_api_key(settings.volcengine_api_key, "VOLCENGINE_API_KEY")
        params = task.get("params", {})
        payload = {
            "model": task.get("model") or settings.volcengine_image_model,
            "prompt": task["prompt"],
            "size": _image_size(params.get("resolution"), params.get("aspect_ratio")),
            "n": _safe_count(params.get("count"), default=1, limit=4),
            "response_format": params.get("response_format") or "b64_json",
        }
        _merge_optional_params(
            payload,
            params,
            {"seed", "guidance_scale", "watermark", "quality"},
        )
        payload.update(params.get("volcengine_extra") or {})

        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{settings.volcengine_base_url}/images/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            raise_for_provider_error(response, self.provider)
            return await self._image_artifacts_from_response(client, response.json())

    async def generate_video(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        api_key = require_api_key(settings.volcengine_api_key, "VOLCENGINE_API_KEY")
        async with httpx.AsyncClient(timeout=60) as client:
            submit_payload = self._build_video_payload(task)
            submit_response = await client.post(
                f"{settings.volcengine_base_url}/contents/generations/tasks",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=submit_payload,
            )
            raise_for_provider_error(submit_response, self.provider)
            submit_data = submit_response.json()
            external_task_id = _extract_task_id(submit_data)
            if not external_task_id:
                raise RuntimeError(f"Volcengine Ark did not return a task id: {submit_data}")

            repositories.update_generation_task(task["id"], {"external_task_id": external_task_id})
            final_status = await self._poll_until_finished(client, api_key, external_task_id)
            video_urls = _extract_video_urls(final_status)
            if not video_urls:
                raise RuntimeError(f"Volcengine Ark task completed without video URLs: {final_status}")

            artifacts = []
            for index, video_url in enumerate(video_urls, start=1):
                content = await self.download_result(video_url)
                artifacts.append(
                    GenerationArtifact(
                        name=f"Volcengine video result {index}",
                        asset_type="video",
                        filename=_filename_from_url(video_url, f"volcengine-video-{index}.mp4"),
                        mime_type="video/mp4",
                        content=content,
                        metadata={
                            "raw_provider": self.provider,
                            "external_task_id": external_task_id,
                            "result_index": index,
                            "source_url": video_url,
                        },
                    )
                )
            return artifacts

    async def get_task_status(self, external_task_id: str) -> dict[str, Any]:
        api_key = require_api_key(settings.volcengine_api_key, "VOLCENGINE_API_KEY")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(
                f"{settings.volcengine_base_url}/contents/generations/tasks/{external_task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            raise_for_provider_error(response, self.provider)
            return response.json()

    async def download_result(self, result_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            response = await client.get(result_url)
            raise_for_provider_error(response, self.provider)
            return response.content

    async def _image_artifacts_from_response(
        self,
        client: httpx.AsyncClient,
        payload: dict[str, Any],
    ) -> list[GenerationArtifact]:
        items = payload.get("data") or payload.get("images") or []
        if isinstance(items, dict):
            items = [items]

        artifacts: list[GenerationArtifact] = []
        for index, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue
            encoded = item.get("b64_json") or item.get("image_base64") or item.get("base64")
            image_url = item.get("url") or _extract_url_from_image_item(item)
            if encoded:
                content = _decode_base64(encoded)
                mime_type = "image/png"
                filename = f"volcengine-image-{index}.png"
            elif image_url:
                response = await client.get(image_url, timeout=180, follow_redirects=True)
                raise_for_provider_error(response, self.provider)
                content = response.content
                mime_type = response.headers.get("content-type", "image/png").split(";")[0]
                filename = _filename_from_url(image_url, f"volcengine-image-{index}.png")
            else:
                continue
            artifacts.append(
                GenerationArtifact(
                    name=f"Volcengine image result {index}",
                    asset_type="image",
                    filename=filename,
                    mime_type=mime_type,
                    content=content,
                    metadata={
                        "raw_provider": self.provider,
                        "result_index": index,
                        "source_url": image_url,
                    },
                )
            )

        if not artifacts:
            raise RuntimeError(f"Volcengine Ark image response did not include any results: {payload}")
        return artifacts

    def _build_video_payload(self, task: dict[str, Any]) -> dict[str, Any]:
        params = task.get("params", {})
        reference_urls = _reference_asset_urls(task.get("reference_asset_ids", []))
        model = task.get("model")
        if not reference_urls and (
            not model or model == settings.volcengine_image_video_model or "i2v" in model
        ):
            model = settings.volcengine_text_video_model
        if reference_urls and (
            not model or model == settings.volcengine_text_video_model or "t2v" in model
        ):
            model = settings.volcengine_image_video_model

        content: list[dict[str, Any]] = [{"type": "text", "text": _video_prompt(task["prompt"], params)}]
        if params.get("mode") == "first_last_frame":
            if len(reference_urls) < 2:
                raise RuntimeError(
                    "Volcengine Ark first/last-frame video requires two public image URLs. "
                    "Set FRAMEAI_PUBLIC_STORAGE_BASE_URL or use assets with external URLs."
                )
            content.append({"type": "image_url", "role": "first_frame", "image_url": {"url": reference_urls[0]}})
            content.append({"type": "image_url", "role": "last_frame", "image_url": {"url": reference_urls[1]}})
        elif reference_urls:
            content.append({"type": "image_url", "image_url": {"url": reference_urls[0]}})

        payload: dict[str, Any] = {
            "model": model,
            "content": content,
        }
        _merge_optional_params(
            payload,
            params,
            {"duration", "resolution", "ratio", "fps", "seed", "watermark"},
        )
        if params.get("aspect_ratio") and "ratio" not in payload:
            payload["ratio"] = params["aspect_ratio"]
        payload.update(params.get("volcengine_extra") or {})
        return payload

    async def _poll_until_finished(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        task_id: str,
    ) -> dict[str, Any]:
        started = monotonic()
        while True:
            response = await client.get(
                f"{settings.volcengine_base_url}/contents/generations/tasks/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            raise_for_provider_error(response, self.provider)
            payload = response.json()
            status = _extract_task_status(payload)
            if status in {"succeeded", "success", "completed", "done"}:
                return payload
            if status in {"failed", "error", "cancelled", "canceled", "expired"}:
                raise RuntimeError(f"Volcengine Ark task {task_id} ended with status {status}: {payload}")
            if monotonic() - started > settings.volcengine_timeout_seconds:
                raise TimeoutError(f"Volcengine Ark task {task_id} timed out")
            await asyncio.sleep(settings.volcengine_poll_interval_seconds)


def _reference_asset_urls(asset_ids: list[str]) -> list[str]:
    urls: list[str] = []
    for asset_id in asset_ids:
        asset = repositories.get_asset(asset_id)
        if not asset:
            continue
        params = asset.get("params") or {}
        explicit_url = params.get("external_url") or params.get("source_url") or params.get("url")
        if explicit_url and str(explicit_url).startswith(("http://", "https://")):
            urls.append(str(explicit_url))
            continue
        external_url = external_storage_url(asset["file_path"])
        if external_url:
            urls.append(external_url)
    return urls


def _image_size(resolution: Any, aspect_ratio: Any) -> str:
    if isinstance(resolution, str) and "x" in resolution:
        return resolution
    # Seedream 4.5 requires at least 3686400 pixels (e.g., 1920x1920)
    if aspect_ratio == "9:16":
        return "1152x2048"  # 2359296 pixels -> use 2048x2048 for safety
    if aspect_ratio == "16:9":
        return "2048x1152"  # 2359296 pixels -> use 2048x2048 for safety
    if aspect_ratio == "4:3":
        return "2048x1536"  # 3145728 pixels -> still below, use 2048x2048
    return "2048x2048"  # 4194304 pixels, meets minimum requirement


def _video_prompt(prompt: str, params: dict[str, Any]) -> str:
    hints = []
    motion = params.get("motion")
    camera_move = params.get("camera_move")
    if motion:
        hints.append(f"motion={motion}")
    if camera_move:
        hints.append(f"camera_move={camera_move}")
    if not hints:
        return prompt
    return f"{prompt}\n\nFrameAI params: {', '.join(hints)}"


def _safe_count(value: Any, default: int, limit: int) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = default
    return max(1, min(count, limit))


def _merge_optional_params(payload: dict[str, Any], params: dict[str, Any], names: set[str]) -> None:
    for name in names:
        if params.get(name) is not None:
            payload[name] = params[name]


def _extract_task_id(payload: dict[str, Any]) -> str | None:
    output = payload.get("output") or {}
    result = payload.get("result") or {}
    return payload.get("id") or payload.get("task_id") or output.get("task_id") or result.get("id")


def _extract_task_status(payload: dict[str, Any]) -> str:
    output = payload.get("output") or {}
    result = payload.get("result") or {}
    status = (
        payload.get("status")
        or payload.get("task_status")
        or output.get("status")
        or output.get("task_status")
        or result.get("status")
        or "running"
    )
    return str(status).lower()


def _extract_video_urls(payload: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    _collect_urls(payload, urls)
    return _unique(urls)


def _collect_urls(value: Any, urls: list[str]) -> None:
    if isinstance(value, dict):
        for key in ("video_url", "result_url", "content_url"):
            item = value.get(key)
            if isinstance(item, str) and item.startswith(("http://", "https://")):
                urls.append(item)
            elif isinstance(item, dict):
                nested_url = item.get("url")
                if isinstance(nested_url, str) and nested_url.startswith(("http://", "https://")):
                    urls.append(nested_url)
        generic_url = value.get("url")
        node_type = str(value.get("type") or "").lower()
        if (
            isinstance(generic_url, str)
            and generic_url.startswith(("http://", "https://"))
            and ("video" in node_type or _url_looks_like_video(generic_url))
        ):
            urls.append(generic_url)
        for item in value.values():
            if isinstance(item, (dict, list)):
                _collect_urls(item, urls)
    elif isinstance(value, list):
        for item in value:
            _collect_urls(item, urls)


def _extract_url_from_image_item(item: dict[str, Any]) -> str | None:
    image_url = item.get("image_url")
    if isinstance(image_url, str):
        return image_url
    if isinstance(image_url, dict):
        url = image_url.get("url")
        if isinstance(url, str):
            return url
    return None


def _decode_base64(value: str) -> bytes:
    if value.startswith("data:") and "," in value:
        value = value.split(",", 1)[1]
    return base64.b64decode(value)


def _filename_from_url(url: str, fallback: str) -> str:
    path = urlparse(url).path
    filename = path.rsplit("/", 1)[-1]
    if filename and "." in filename:
        return filename
    return fallback


def _url_looks_like_video(url: str) -> bool:
    path = urlparse(url).path.lower()
    return path.endswith((".mp4", ".mov", ".webm", ".mkv", ".m3u8"))


def _unique(values: list[str]) -> list[str]:
    seen = set()
    unique_values = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique_values.append(value)
    return unique_values
