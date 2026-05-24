from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import repositories
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects() -> list[dict]:
    return repositories.list_projects()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate) -> dict:
    return repositories.create_project(payload.model_dump())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str) -> dict:
    project = repositories.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectUpdate) -> dict:
    try:
        return repositories.update_project(project_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{project_id}")
def delete_project(project_id: str) -> dict[str, bool]:
    repositories.delete_project(project_id)
    return {"ok": True}

