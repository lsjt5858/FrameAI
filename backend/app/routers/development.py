from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import repositories
from app.schemas import DevelopmentWorkspaceOut, DevelopmentWorkspaceUpdate


router = APIRouter(prefix="/development-workspaces", tags=["development"])


@router.get("/{project_id}", response_model=DevelopmentWorkspaceOut)
def get_development_workspace(project_id: str) -> dict:
    workspace = repositories.get_development_workspace(project_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Project not found")
    return workspace


@router.patch("/{project_id}", response_model=DevelopmentWorkspaceOut)
def update_development_workspace(project_id: str, payload: DevelopmentWorkspaceUpdate) -> dict:
    try:
        return repositories.update_development_workspace(project_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
