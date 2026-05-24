from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from time import monotonic

from app import repositories
from app.adapters.registry import get_adapter
from app.db import utcnow
from app.services.storage import save_generated_file


async def run_worker_loop(poll_interval: float = 2.0) -> None:
    while True:
        await process_next_task()
        await asyncio.sleep(poll_interval)


async def process_next_task() -> None:
    task = repositories.claim_next_pending_task()
    if not task:
        return

    started_at = datetime.now(timezone.utc)
    monotonic_start = monotonic()
    endpoint = f"{task['provider']}.{task['task_type']}.generate"

    try:
        adapter = get_adapter(task["provider"])
        if task["task_type"] == "image":
            artifacts = await adapter.generate_image(task)
        elif task["task_type"] == "video":
            artifacts = await adapter.generate_video(task)
        else:
            raise ValueError(f"Unsupported task type: {task['task_type']}")

        result_asset_ids: list[str] = []
        for artifact in artifacts:
            stored = save_generated_file(
                task["task_type"],
                artifact.filename,
                artifact.content,
                artifact.mime_type,
            )
            asset = repositories.create_asset(
                {
                    "project_id": task.get("project_id"),
                    "shot_id": task.get("shot_id"),
                    "name": artifact.name,
                    "asset_type": artifact.asset_type,
                    "file_path": stored.file_path,
                    "mime_type": stored.mime_type,
                    "source": f"generated_{task['task_type']}",
                    "provider": task["provider"],
                    "model": task["model"],
                    "prompt": task["prompt"],
                    "params": {**task.get("params", {}), **artifact.metadata},
                    "upstream_asset_ids": task.get("reference_asset_ids", []),
                    "task_id": task["id"],
                }
            )
            result_asset_ids.append(asset["id"])

        finished_at = utcnow()
        repositories.update_generation_task(
            task["id"],
            {
                "status": "succeeded",
                "result_asset_ids": result_asset_ids,
                "error_message": None,
                "finished_at": finished_at,
                "estimated_cost": 0,
            },
        )
        _log_api_call(task, endpoint, "succeeded", started_at, monotonic_start, result_asset_ids=result_asset_ids)
    except Exception as exc:  # noqa: BLE001 - worker should keep running after task failures.
        should_retry = task["attempts"] <= task["max_retries"]
        repositories.update_generation_task(
            task["id"],
            {
                "status": "pending" if should_retry else "failed",
                "error_message": str(exc),
                "finished_at": None if should_retry else utcnow(),
            },
        )
        _log_api_call(task, endpoint, "failed", started_at, monotonic_start, error_message=str(exc))


def _log_api_call(
    task: dict,
    endpoint: str,
    status: str,
    started_at: datetime,
    monotonic_start: float,
    result_asset_ids: list[str] | None = None,
    error_message: str | None = None,
) -> None:
    finished_at = datetime.now(timezone.utc)
    duration_ms = int((monotonic() - monotonic_start) * 1000)
    repositories.create_api_call_log(
        {
            "task_id": task["id"],
            "provider": task["provider"],
            "model": task["model"],
            "endpoint": endpoint,
            "request_payload": {
                "prompt": task["prompt"],
                "params": task.get("params", {}),
                "reference_asset_ids": task.get("reference_asset_ids", []),
            },
            "response_payload": {"result_asset_ids": result_asset_ids or []},
            "status": status,
            "error_message": error_message,
            "estimated_cost": 0,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "duration_ms": duration_ms,
        }
    )

