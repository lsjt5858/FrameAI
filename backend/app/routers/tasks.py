from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import repositories
from app.schemas import ApiCallLogOut, GenerationTaskCreate, GenerationTaskOut


router = APIRouter(prefix="/tasks", tags=["generation_tasks"])


@router.get("", response_model=list[GenerationTaskOut])
def list_tasks(project_id: str | None = None, status: str | None = None) -> list[dict]:
    return repositories.list_generation_tasks(project_id, status)


@router.post("/image", response_model=GenerationTaskOut, status_code=201)
def create_image_task(payload: GenerationTaskCreate) -> dict:
    return repositories.create_generation_task("image", payload.model_dump())


@router.post("/video", response_model=GenerationTaskOut, status_code=201)
def create_video_task(payload: GenerationTaskCreate) -> dict:
    return repositories.create_generation_task("video", payload.model_dump())


@router.get("/{task_id}", response_model=GenerationTaskOut)
def get_task(task_id: str) -> dict:
    task = repositories.get_generation_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/retry", response_model=GenerationTaskOut)
def retry_task(task_id: str) -> dict:
    try:
        return repositories.retry_generation_task(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{task_id}/logs", response_model=list[ApiCallLogOut])
def list_task_logs(task_id: str) -> list[dict]:
    return repositories.list_api_call_logs(task_id)

