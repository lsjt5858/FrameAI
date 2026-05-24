from __future__ import annotations

import asyncio
from time import monotonic
from typing import Any

import httpx

from app import repositories
from app.adapters.base import GenerationArtifact
from app.adapters.http_utils import raise_for_provider_error, require_api_key
from app.core.config import settings
from app.services.storage import external_storage_url


class DashScopeWanVideoAdapter:
    provider = "dashscope_wan"

    @property
    def _base_url(self) -> str:
        if settings.dashscope_region == "cn":
            return "https://dashscope.aliyuncs.com/api/v1"
        return "https://dashscope-intl.aliyuncs.com/api/v1"

    async def generate_image(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        raise NotImplementedError("DashScopeWanVideoAdapter only supports video generation")

    async def generate_video(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        api_key = require_api_key(settings.dashscope_api_key, "DASHSCOPE_API_KEY")
        async with httpx.AsyncClient(timeout=60) as client:
            submit_payload = self._build_submit_payload(task)
            submit_response = await client.post(
                f"{self._base_url}/services/aigc/video-generation/video-synthesis",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "X-DashScope-Async": "enable",
                },
                json=submit_payload,
            )
            raise_for_provider_error(submit_response, self.provider)
            submit_data = submit_response.json()
            task_id = _extract_dashscope_task_id(submit_data)
            if not task_id:
                raise RuntimeError(f"DashScope did not return a task id: {submit_data}")

            repositories.update_generation_task(task["id"], {"external_task_id": task_id})
            final_status = await self._poll_until_finished(client, api_key, task_id)
            video_urls = _extract_video_urls(final_status)
            if not video_urls:
                raise RuntimeError(f"DashScope task completed without video URLs: {final_status}")

            artifacts = []
            for index, video_url in enumerate(video_urls, start=1):
                content = await self.download_result(video_url)
                artifacts.append(
                    GenerationArtifact(
                        name=f"Wan video result {index}",
                        asset_type="video",
                        filename=f"wan-video-{index}.mp4",
                        mime_type="video/mp4",
                        content=content,
                        metadata={
                            "raw_provider": "dashscope_wan",
                            "external_task_id": task_id,
                            "result_index": index,
                        },
                    )
                )
            return artifacts

    async def get_task_status(self, external_task_id: str) -> dict[str, Any]:
        api_key = require_api_key(settings.dashscope_api_key, "DASHSCOPE_API_KEY")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(
                f"{self._base_url}/tasks/{external_task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            raise_for_provider_error(response, self.provider)
            return response.json()

    async def download_result(self, result_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.get(result_url)
            raise_for_provider_error(response, self.provider)
            return response.content

    def _build_submit_payload(self, task: dict[str, Any]) -> dict[str, Any]:
        params = task.get("params", {})
        reference_urls = _reference_asset_urls(task.get("reference_asset_ids", []))
        model = task.get("model")
        if not reference_urls and (not model or "i2v" in model):
            model = settings.dashscope_text_video_model
        if reference_urls and (not model or "t2v" in model):
            model = settings.dashscope_image_video_model

        input_payload: dict[str, Any] = {"prompt": task["prompt"]}
        if params.get("mode") == "first_last_frame":
            if len(reference_urls) < 2:
                raise RuntimeError(
                    "DashScope first/last-frame video requires two public image URLs. "
                    "Set FRAMEAI_PUBLIC_STORAGE_BASE_URL or use assets with external URLs."
                )
            if "wan2.7" in model:
                input_payload["media"] = [
                    {"type": "first_frame", "url": reference_urls[0]},
                    {"type": "last_frame", "url": reference_urls[1]},
                ]
            else:
                input_payload["first_frame_url"] = reference_urls[0]
                input_payload["last_frame_url"] = reference_urls[1]
        elif reference_urls:
            if "wan2.7" in model:
                input_payload["media"] = [{"type": "first_frame", "url": reference_urls[0]}]
            else:
                input_payload["img_url"] = reference_urls[0]

        parameters = {
            "duration": params.get("duration", 5),
            "resolution": params.get("resolution", "720P"),
            "prompt_extend": params.get("prompt_extend", True),
            "watermark": params.get("watermark", False),
        }
        if params.get("seed") is not None:
            parameters["seed"] = params["seed"]
        return {
            "model": model,
            "input": input_payload,
            "parameters": parameters,
        }

    async def _poll_until_finished(
        self,
        client: httpx.AsyncClient,
        api_key: str,
        task_id: str,
    ) -> dict[str, Any]:
        started = monotonic()
        while True:
            response = await client.get(
                f"{self._base_url}/tasks/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            raise_for_provider_error(response, self.provider)
            payload = response.json()
            status = _extract_task_status(payload)
            if status in {"SUCCEEDED", "succeeded"}:
                return payload
            if status in {"FAILED", "failed", "CANCELED", "cancelled"}:
                raise RuntimeError(f"DashScope task {task_id} ended with status {status}: {payload}")
            if monotonic() - started > settings.dashscope_timeout_seconds:
                raise TimeoutError(f"DashScope task {task_id} timed out")
            await asyncio.sleep(settings.dashscope_poll_interval_seconds)


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


def _extract_dashscope_task_id(payload: dict[str, Any]) -> str | None:
    output = payload.get("output") or {}
    return output.get("task_id") or payload.get("task_id")


def _extract_task_status(payload: dict[str, Any]) -> str:
    output = payload.get("output") or {}
    return output.get("task_status") or output.get("status") or payload.get("status") or "UNKNOWN"


def _extract_video_urls(payload: dict[str, Any]) -> list[str]:
    output = payload.get("output") or {}
    results = output.get("results") or output.get("videos") or []
    urls: list[str] = []
    if output.get("video_url"):
        urls.append(output["video_url"])
    for result in results:
        if isinstance(result, dict):
            url = result.get("url") or result.get("video_url")
            if url:
                urls.append(url)
        elif isinstance(result, str) and result.startswith(("http://", "https://")):
            urls.append(result)
    return urls
