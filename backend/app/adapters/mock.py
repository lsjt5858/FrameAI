from __future__ import annotations

import asyncio
import html
import json
from datetime import datetime, timezone
from textwrap import wrap
from typing import Any

from app.adapters.base import GenerationArtifact


class MockGenerationAdapter:
    provider = "mock"

    async def generate_image(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        await asyncio.sleep(1)
        count = _safe_count(task.get("params", {}).get("count"), default=1, limit=8)
        prompt = task["prompt"]
        artifacts: list[GenerationArtifact] = []
        for result_index in range(1, count + 1):
            title_lines = wrap(prompt, width=32)[:4]
            tspans = "".join(
                f'<tspan x="40" dy="{28 if index else 0}">{html.escape(line)}</tspan>'
                for index, line in enumerate(title_lines)
            )
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#14213d"/>
      <stop offset="0.55" stop-color="#2a9d8f"/>
      <stop offset="1" stop-color="#f4a261"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="32" y="32" width="1216" height="656" rx="20" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
  <text x="40" y="92" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="700">FrameAI Mock Image #{result_index}</text>
  <text x="40" y="162" fill="#ffffff" font-family="Arial, sans-serif" font-size="28">{tspans}</text>
  <text x="40" y="646" fill="rgba(255,255,255,.82)" font-family="Arial, sans-serif" font-size="20">provider={html.escape(task["provider"])} | model={html.escape(task["model"])}</text>
</svg>"""
            artifacts.append(
                GenerationArtifact(
                    name=f"Mock image result {result_index}",
                    asset_type="image",
                    filename=f"mock-image-{result_index}.svg",
                    mime_type="image/svg+xml",
                    content=svg.encode("utf-8"),
                    metadata={"mock": True, "result_index": result_index},
                )
            )
        return artifacts

    async def generate_video(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        await asyncio.sleep(1)
        count = _safe_count(task.get("params", {}).get("count"), default=1, limit=4)
        artifacts: list[GenerationArtifact] = []
        for result_index in range(1, count + 1):
            manifest = {
                "kind": "mock_video_manifest",
                "message": "真实视频平台接入前，这里用于占位和验证任务链路。",
                "provider": task["provider"],
                "model": task["model"],
                "prompt": task["prompt"],
                "reference_asset_ids": task.get("reference_asset_ids", []),
                "result_index": result_index,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            artifacts.append(
                GenerationArtifact(
                    name=f"Mock video result {result_index}",
                    asset_type="video",
                    filename=f"mock-video-{result_index}.json",
                    mime_type="application/json",
                    content=json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
                    metadata={"mock": True, "result_index": result_index},
                )
            )
        return artifacts

    async def get_task_status(self, external_task_id: str) -> dict[str, Any]:
        return {"external_task_id": external_task_id, "status": "succeeded"}

    async def download_result(self, result_url: str) -> bytes:
        return result_url.encode("utf-8")


def _safe_count(value: Any, default: int, limit: int) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = default
    return max(1, min(count, limit))
