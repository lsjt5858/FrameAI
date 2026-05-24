from __future__ import annotations

import json
from typing import Any

from app.db import connect, new_id, utcnow


JSON_DEFAULTS: dict[str, Any] = {
    "characters": [],
    "reference_asset_ids": [],
    "params": {},
    "upstream_asset_ids": [],
    "variables": [],
    "result_asset_ids": [],
    "request_payload": {},
    "response_payload": {},
}


def _dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _load(value: str | None, field: str) -> Any:
    if not value:
        return JSON_DEFAULTS.get(field, None)
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return JSON_DEFAULTS.get(field, None)


def _row(row: Any, json_fields: set[str] | None = None) -> dict[str, Any] | None:
    if row is None:
        return None

    data = dict(row)
    for field in json_fields or set():
        if field in data:
            data[field] = _load(data[field], field)
    if "is_selected" in data:
        data["is_selected"] = bool(data["is_selected"])
    return data


def _rows(rows: list[Any], json_fields: set[str] | None = None) -> list[dict[str, Any]]:
    return [_row(item, json_fields) for item in rows if item is not None]  # type: ignore[list-item]


def _not_found(resource: str, item_id: str) -> ValueError:
    return ValueError(f"{resource} not found: {item_id}")


def list_projects() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY updated_at DESC"
        ).fetchall()
    return _rows(rows)


def get_project(project_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row(row)


def create_project(data: dict[str, Any]) -> dict[str, Any]:
    now = utcnow()
    project_id = new_id("prj")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO projects (id, name, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                data["name"],
                data.get("description") or "",
                data.get("status") or "active",
                now,
                now,
            ),
        )
        conn.commit()
    return get_project(project_id)  # type: ignore[return-value]


def update_project(project_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_project(project_id)
    if not existing:
        raise _not_found("project", project_id)

    allowed = {"name", "description", "status"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if not updates:
        return existing

    updates["updated_at"] = utcnow()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with connect() as conn:
        conn.execute(
            f"UPDATE projects SET {assignments} WHERE id = ?",
            (*updates.values(), project_id),
        )
        conn.commit()
    return get_project(project_id)  # type: ignore[return-value]


def delete_project(project_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()


def next_shot_number(project_id: str) -> int:
    with connect() as conn:
        value = conn.execute(
            "SELECT COALESCE(MAX(shot_number), 0) + 1 FROM shots WHERE project_id = ?",
            (project_id,),
        ).fetchone()[0]
    return int(value)


def list_shots(project_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM shots"
    params: list[Any] = []
    if project_id:
        sql += " WHERE project_id = ?"
        params.append(project_id)
    sql += " ORDER BY shot_number ASC, created_at ASC"

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return _rows(rows, {"characters", "reference_asset_ids"})


def get_shot(shot_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM shots WHERE id = ?", (shot_id,)).fetchone()
    return _row(row, {"characters", "reference_asset_ids"})


def create_shot(data: dict[str, Any]) -> dict[str, Any]:
    now = utcnow()
    shot_id = new_id("shot")
    shot_number = data.get("shot_number") or next_shot_number(data["project_id"])
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO shots (
                id, project_id, shot_number, title, story, characters, scene_id,
                reference_asset_ids, image_prompt, video_prompt, status, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                shot_id,
                data["project_id"],
                shot_number,
                data.get("title") or "",
                data.get("story") or "",
                _dump(data.get("characters") or []),
                data.get("scene_id"),
                _dump(data.get("reference_asset_ids") or []),
                data.get("image_prompt") or "",
                data.get("video_prompt") or "",
                data.get("status") or "draft",
                data.get("notes") or "",
                now,
                now,
            ),
        )
        conn.commit()
    return get_shot(shot_id)  # type: ignore[return-value]


def update_shot(shot_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_shot(shot_id)
    if not existing:
        raise _not_found("shot", shot_id)

    allowed = {
        "shot_number",
        "title",
        "story",
        "characters",
        "scene_id",
        "reference_asset_ids",
        "image_prompt",
        "video_prompt",
        "selected_image_asset_id",
        "selected_video_asset_id",
        "status",
        "notes",
    }
    updates = {key: value for key, value in fields.items() if key in allowed}
    for field in ("characters", "reference_asset_ids"):
        if field in updates:
            updates[field] = _dump(updates[field] or [])
    if not updates:
        return existing

    updates["updated_at"] = utcnow()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with connect() as conn:
        conn.execute(
            f"UPDATE shots SET {assignments} WHERE id = ?",
            (*updates.values(), shot_id),
        )
        conn.commit()
    return get_shot(shot_id)  # type: ignore[return-value]


def list_assets(
    project_id: str | None = None,
    shot_id: str | None = None,
    asset_type: str | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM assets WHERE 1 = 1"
    params: list[Any] = []
    if project_id:
        sql += " AND project_id = ?"
        params.append(project_id)
    if shot_id:
        sql += " AND shot_id = ?"
        params.append(shot_id)
    if asset_type:
        sql += " AND asset_type = ?"
        params.append(asset_type)
    sql += " ORDER BY created_at DESC"

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return _rows(rows, {"params", "upstream_asset_ids"})


def get_asset(asset_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
    return _row(row, {"params", "upstream_asset_ids"})


def create_asset(data: dict[str, Any]) -> dict[str, Any]:
    asset_id = new_id("ast")
    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO assets (
                id, project_id, shot_id, name, asset_type, file_path, mime_type,
                source, provider, model, prompt, params, upstream_asset_ids,
                task_id, is_selected, review_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                asset_id,
                data.get("project_id"),
                data.get("shot_id"),
                data["name"],
                data["asset_type"],
                data["file_path"],
                data.get("mime_type") or "application/octet-stream",
                data.get("source") or "upload",
                data.get("provider"),
                data.get("model"),
                data.get("prompt"),
                _dump(data.get("params") or {}),
                _dump(data.get("upstream_asset_ids") or []),
                data.get("task_id"),
                1 if data.get("is_selected") else 0,
                data.get("review_status") or "unreviewed",
                now,
            ),
        )
        conn.commit()
    return get_asset(asset_id)  # type: ignore[return-value]


def update_asset(asset_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_asset(asset_id)
    if not existing:
        raise _not_found("asset", asset_id)

    allowed = {"name", "project_id", "shot_id", "is_selected", "review_status"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "is_selected" in updates:
        updates["is_selected"] = 1 if updates["is_selected"] else 0
    if not updates:
        return existing

    assignments = ", ".join(f"{key} = ?" for key in updates)
    with connect() as conn:
        conn.execute(
            f"UPDATE assets SET {assignments} WHERE id = ?",
            (*updates.values(), asset_id),
        )
        conn.commit()
    return get_asset(asset_id)  # type: ignore[return-value]


def list_prompt_templates(category: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM prompt_templates"
    params: list[Any] = []
    if category:
        sql += " WHERE category = ?"
        params.append(category)
    sql += " ORDER BY updated_at DESC"

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return _rows(rows, {"variables"})


def get_prompt_template(template_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM prompt_templates WHERE id = ?",
            (template_id,),
        ).fetchone()
    return _row(row, {"variables"})


def create_prompt_template(data: dict[str, Any]) -> dict[str, Any]:
    template_id = new_id("tpl")
    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO prompt_templates (
                id, name, category, content, variables, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                template_id,
                data["name"],
                data.get("category") or "general",
                data["content"],
                _dump(data.get("variables") or []),
                data.get("notes") or "",
                now,
                now,
            ),
        )
        conn.commit()
    return get_prompt_template(template_id)  # type: ignore[return-value]


def update_prompt_template(template_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_prompt_template(template_id)
    if not existing:
        raise _not_found("prompt template", template_id)

    allowed = {"name", "category", "content", "variables", "notes"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "variables" in updates:
        updates["variables"] = _dump(updates["variables"] or [])
    if not updates:
        return existing

    updates["updated_at"] = utcnow()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with connect() as conn:
        conn.execute(
            f"UPDATE prompt_templates SET {assignments} WHERE id = ?",
            (*updates.values(), template_id),
        )
        conn.commit()
    return get_prompt_template(template_id)  # type: ignore[return-value]


def delete_prompt_template(template_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM prompt_templates WHERE id = ?", (template_id,))
        conn.commit()


def list_generation_tasks(
    project_id: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM generation_tasks WHERE 1 = 1"
    params: list[Any] = []
    if project_id:
        sql += " AND project_id = ?"
        params.append(project_id)
    if status:
        sql += " AND status = ?"
        params.append(status)
    sql += " ORDER BY created_at DESC"

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return _rows(rows, {"params", "reference_asset_ids", "result_asset_ids"})


def get_generation_task(task_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM generation_tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
    return _row(row, {"params", "reference_asset_ids", "result_asset_ids"})


def create_generation_task(task_type: str, data: dict[str, Any]) -> dict[str, Any]:
    task_id = new_id("task")
    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO generation_tasks (
                id, project_id, shot_id, task_type, provider, model, prompt, params,
                reference_asset_ids, status, attempts, max_retries, result_asset_ids,
                estimated_cost, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, '[]', 0, ?, ?)
            """,
            (
                task_id,
                data.get("project_id"),
                data.get("shot_id"),
                task_type,
                data.get("provider") or "mock",
                data.get("model") or "mock-v1",
                data["prompt"],
                _dump(data.get("params") or {}),
                _dump(data.get("reference_asset_ids") or []),
                data.get("max_retries", 1),
                now,
                now,
            ),
        )
        conn.commit()
    return get_generation_task(task_id)  # type: ignore[return-value]


def claim_next_pending_task() -> dict[str, Any] | None:
    now = utcnow()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id FROM generation_tasks
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            """
        ).fetchone()
        if not row:
            return None

        task_id = row["id"]
        conn.execute(
            """
            UPDATE generation_tasks
            SET status = 'running',
                attempts = attempts + 1,
                started_at = COALESCE(started_at, ?),
                updated_at = ?
            WHERE id = ?
            """,
            (now, now, task_id),
        )
        conn.commit()
    return get_generation_task(task_id)


def update_generation_task(task_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_generation_task(task_id)
    if not existing:
        raise _not_found("generation task", task_id)

    allowed = {
        "status",
        "external_task_id",
        "result_asset_ids",
        "error_message",
        "estimated_cost",
        "started_at",
        "finished_at",
    }
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "result_asset_ids" in updates:
        updates["result_asset_ids"] = _dump(updates["result_asset_ids"] or [])
    if not updates:
        return existing

    updates["updated_at"] = utcnow()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with connect() as conn:
        conn.execute(
            f"UPDATE generation_tasks SET {assignments} WHERE id = ?",
            (*updates.values(), task_id),
        )
        conn.commit()
    return get_generation_task(task_id)  # type: ignore[return-value]


def retry_generation_task(task_id: str) -> dict[str, Any]:
    task = get_generation_task(task_id)
    if not task:
        raise _not_found("generation task", task_id)
    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            UPDATE generation_tasks
            SET status = 'pending',
                error_message = NULL,
                finished_at = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (now, task_id),
        )
        conn.commit()
    return get_generation_task(task_id)  # type: ignore[return-value]


def cancel_generation_task(task_id: str) -> dict[str, Any]:
    task = get_generation_task(task_id)
    if not task:
        raise _not_found("generation task", task_id)

    if task["status"] in {"succeeded", "failed", "cancelled"}:
        return task

    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            UPDATE generation_tasks
            SET status = 'cancelled',
                error_message = 'Task cancelled by user',
                finished_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (now, now, task_id),
        )
        conn.commit()
    return get_generation_task(task_id)  # type: ignore[return-value]


def create_api_call_log(data: dict[str, Any]) -> dict[str, Any]:
    log_id = new_id("log")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO api_call_logs (
                id, task_id, provider, model, endpoint, request_payload,
                response_payload, status, error_message, estimated_cost,
                started_at, finished_at, duration_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                log_id,
                data.get("task_id"),
                data["provider"],
                data["model"],
                data["endpoint"],
                _dump(data.get("request_payload") or {}),
                _dump(data.get("response_payload") or {}),
                data["status"],
                data.get("error_message"),
                data.get("estimated_cost") or 0,
                data["started_at"],
                data["finished_at"],
                data.get("duration_ms") or 0,
            ),
        )
        conn.commit()
    with connect() as conn:
        row = conn.execute("SELECT * FROM api_call_logs WHERE id = ?", (log_id,)).fetchone()
    return _row(row, {"request_payload", "response_payload"})  # type: ignore[return-value]


def list_api_call_logs(task_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM api_call_logs"
    params: list[Any] = []
    if task_id:
        sql += " WHERE task_id = ?"
        params.append(task_id)
    sql += " ORDER BY started_at DESC"

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return _rows(rows, {"request_payload", "response_payload"})
