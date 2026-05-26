from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


TaskStatus = Literal["pending", "running", "succeeded", "failed", "cancelled"]
TaskType = Literal["image", "video"]
AssetType = Literal["image", "video", "audio", "document", "other"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    status: str = "active"


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    status: str | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    status: str
    created_at: str
    updated_at: str


class DevelopmentWorkspaceUpdate(BaseModel):
    logline: str | None = None
    genre: str | None = None
    targetPlatform: str | None = None
    audience: str | None = None
    worldview: str | None = None
    visualStyle: str | None = None
    episodeTitle: str | None = None
    episodeScript: str | None = None
    characters: list[dict[str, Any]] | None = None
    props: list[dict[str, Any]] | None = None
    scenes: list[dict[str, Any]] | None = None
    shotDrafts: list[dict[str, Any]] | None = None
    checklist: dict[str, bool] | None = None
    qualityChecks: dict[str, bool] | None = None
    publishPlan: dict[str, Any] | None = None


class DevelopmentWorkspaceOut(BaseModel):
    id: str
    project_id: str
    logline: str
    genre: str
    targetPlatform: str
    audience: str
    worldview: str
    visualStyle: str
    episodeTitle: str
    episodeScript: str
    characters: list[dict[str, Any]]
    props: list[dict[str, Any]]
    scenes: list[dict[str, Any]]
    shotDrafts: list[dict[str, Any]]
    checklist: dict[str, bool]
    qualityChecks: dict[str, bool]
    publishPlan: dict[str, Any]
    created_at: str
    updated_at: str


class ShotCreate(BaseModel):
    project_id: str
    shot_number: int | None = Field(default=None, ge=1)
    title: str = ""
    story: str = ""
    characters: list[str] = Field(default_factory=list)
    scene_id: str | None = None
    character_asset_ids: list[str] = Field(default_factory=list)
    costume_asset_ids: list[str] = Field(default_factory=list)
    scene_asset_ids: list[str] = Field(default_factory=list)
    reference_asset_ids: list[str] = Field(default_factory=list)
    image_prompt: str = ""
    video_prompt: str = ""
    status: str = "draft"
    notes: str = ""


class ShotUpdate(BaseModel):
    shot_number: int | None = Field(default=None, ge=1)
    title: str | None = None
    story: str | None = None
    characters: list[str] | None = None
    scene_id: str | None = None
    character_asset_ids: list[str] | None = None
    costume_asset_ids: list[str] | None = None
    scene_asset_ids: list[str] | None = None
    reference_asset_ids: list[str] | None = None
    image_prompt: str | None = None
    video_prompt: str | None = None
    selected_image_asset_id: str | None = None
    selected_video_asset_id: str | None = None
    status: str | None = None
    notes: str | None = None


class ShotOut(BaseModel):
    id: str
    project_id: str
    shot_number: int
    title: str
    story: str
    characters: list[str]
    scene_id: str | None = None
    character_asset_ids: list[str]
    costume_asset_ids: list[str]
    scene_asset_ids: list[str]
    reference_asset_ids: list[str]
    image_prompt: str
    video_prompt: str
    selected_image_asset_id: str | None = None
    selected_video_asset_id: str | None = None
    status: str
    notes: str
    created_at: str
    updated_at: str


class AssetOut(BaseModel):
    id: str
    project_id: str | None = None
    shot_id: str | None = None
    name: str
    asset_type: AssetType
    file_path: str
    url: str | None = None
    mime_type: str
    source: str
    provider: str | None = None
    model: str | None = None
    prompt: str | None = None
    params: dict[str, Any]
    upstream_asset_ids: list[str]
    task_id: str | None = None
    is_selected: bool
    review_status: str
    created_at: str


class AssetUpdate(BaseModel):
    name: str | None = None
    project_id: str | None = None
    shot_id: str | None = None
    is_selected: bool | None = None
    review_status: str | None = None


class PromptTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = "general"
    content: str = Field(min_length=1)
    variables: list[str] = Field(default_factory=list)
    notes: str = ""


class PromptTemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    content: str | None = None
    variables: list[str] | None = None
    notes: str | None = None


class PromptTemplateOut(BaseModel):
    id: str
    name: str
    category: str
    content: str
    variables: list[str]
    notes: str
    created_at: str
    updated_at: str


class GenerationTaskCreate(BaseModel):
    project_id: str | None = None
    shot_id: str | None = None
    provider: str = "mock"
    model: str = "mock-v1"
    prompt: str = Field(min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)
    reference_asset_ids: list[str] = Field(default_factory=list)
    max_retries: int = Field(default=1, ge=0, le=5)


class GenerationTaskOut(BaseModel):
    id: str
    project_id: str | None = None
    shot_id: str | None = None
    task_type: TaskType
    provider: str
    model: str
    prompt: str
    params: dict[str, Any]
    reference_asset_ids: list[str]
    status: TaskStatus
    attempts: int
    max_retries: int
    external_task_id: str | None = None
    result_asset_ids: list[str]
    error_message: str | None = None
    estimated_cost: float
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str
    updated_at: str


class ApiCallLogOut(BaseModel):
    id: str
    task_id: str | None = None
    provider: str
    model: str
    endpoint: str
    request_payload: dict[str, Any]
    response_payload: dict[str, Any]
    status: str
    error_message: str | None = None
    estimated_cost: float
    started_at: str
    finished_at: str
    duration_ms: int


class ProviderConfigUpdate(BaseModel):
    values: dict[str, str | None] = Field(default_factory=dict)
    clear_secrets: list[str] = Field(default_factory=list)
