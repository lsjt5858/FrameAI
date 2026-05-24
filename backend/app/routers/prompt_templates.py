from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import repositories
from app.schemas import PromptTemplateCreate, PromptTemplateOut, PromptTemplateUpdate


router = APIRouter(prefix="/prompt-templates", tags=["prompt_templates"])


@router.get("", response_model=list[PromptTemplateOut])
def list_prompt_templates(category: str | None = None) -> list[dict]:
    return repositories.list_prompt_templates(category)


@router.post("", response_model=PromptTemplateOut, status_code=201)
def create_prompt_template(payload: PromptTemplateCreate) -> dict:
    return repositories.create_prompt_template(payload.model_dump())


@router.get("/{template_id}", response_model=PromptTemplateOut)
def get_prompt_template(template_id: str) -> dict:
    template = repositories.get_prompt_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return template


@router.patch("/{template_id}", response_model=PromptTemplateOut)
def update_prompt_template(template_id: str, payload: PromptTemplateUpdate) -> dict:
    try:
        return repositories.update_prompt_template(template_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{template_id}")
def delete_prompt_template(template_id: str) -> dict[str, bool]:
    repositories.delete_prompt_template(template_id)
    return {"ok": True}

