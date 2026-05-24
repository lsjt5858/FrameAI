from __future__ import annotations

from fastapi import APIRouter

from app import repositories
from app.schemas import ApiCallLogOut


router = APIRouter(prefix="/logs", tags=["api_call_logs"])


@router.get("", response_model=list[ApiCallLogOut])
def list_logs(task_id: str | None = None) -> list[dict]:
    return repositories.list_api_call_logs(task_id)

