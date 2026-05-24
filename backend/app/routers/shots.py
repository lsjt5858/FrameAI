from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import repositories
from app.schemas import ShotCreate, ShotOut, ShotUpdate


router = APIRouter(prefix="/shots", tags=["shots"])


@router.get("", response_model=list[ShotOut])
def list_shots(project_id: str | None = None) -> list[dict]:
    return repositories.list_shots(project_id)


@router.post("", response_model=ShotOut, status_code=201)
def create_shot(payload: ShotCreate) -> dict:
    if not repositories.get_project(payload.project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return repositories.create_shot(payload.model_dump())


@router.get("/{shot_id}", response_model=ShotOut)
def get_shot(shot_id: str) -> dict:
    shot = repositories.get_shot(shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")
    return shot


@router.patch("/{shot_id}", response_model=ShotOut)
def update_shot(shot_id: str, payload: ShotUpdate) -> dict:
    try:
        return repositories.update_shot(shot_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

