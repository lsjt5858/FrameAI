from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import repositories
from app.schemas import AssetOut, AssetUpdate
from app.services.storage import infer_asset_type, public_url, save_upload


router = APIRouter(prefix="/assets", tags=["assets"])


def _asset_response(asset: dict) -> dict:
    asset["url"] = public_url(asset["file_path"])
    return asset


@router.get("", response_model=list[AssetOut])
def list_assets(
    project_id: str | None = None,
    shot_id: str | None = None,
    asset_type: str | None = None,
) -> list[dict]:
    return [_asset_response(item) for item in repositories.list_assets(project_id, shot_id, asset_type)]


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: str) -> dict:
    asset = repositories.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _asset_response(asset)


@router.post("/upload", response_model=AssetOut, status_code=201)
def upload_asset(
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    shot_id: str | None = Form(default=None),
    name: str | None = Form(default=None),
    asset_type: str | None = Form(default=None),
    source: str = Form(default="upload"),
) -> dict:
    stored = save_upload(file)
    final_type = asset_type or infer_asset_type(stored.mime_type, stored.name)
    asset = repositories.create_asset(
        {
            "project_id": project_id or None,
            "shot_id": shot_id or None,
            "name": name or stored.name,
            "asset_type": final_type,
            "file_path": stored.file_path,
            "mime_type": stored.mime_type,
            "source": source,
        }
    )
    return _asset_response(asset)


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, payload: AssetUpdate) -> dict:
    try:
        asset = repositories.update_asset(asset_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _asset_response(asset)

