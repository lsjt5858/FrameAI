from __future__ import annotations

from fastapi import APIRouter

from app.adapters.registry import list_providers
from app.core.config import settings


router = APIRouter(prefix="/settings", tags=["settings"])


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
    }

