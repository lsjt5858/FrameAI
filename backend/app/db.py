from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

from app.core.config import settings


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def connect() -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)

    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_development_workspaces (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
                logline TEXT NOT NULL DEFAULT '',
                genre TEXT NOT NULL DEFAULT '',
                target_platform TEXT NOT NULL DEFAULT '',
                audience TEXT NOT NULL DEFAULT '',
                worldview TEXT NOT NULL DEFAULT '',
                visual_style TEXT NOT NULL DEFAULT '',
                episode_title TEXT NOT NULL DEFAULT '',
                episode_script TEXT NOT NULL DEFAULT '',
                characters TEXT NOT NULL DEFAULT '[]',
                props TEXT NOT NULL DEFAULT '[]',
                scenes TEXT NOT NULL DEFAULT '[]',
                shot_drafts TEXT NOT NULL DEFAULT '[]',
                checklist TEXT NOT NULL DEFAULT '{}',
                quality_checks TEXT NOT NULL DEFAULT '{}',
                publish_plan TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS shots (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                shot_number INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                story TEXT NOT NULL DEFAULT '',
                characters TEXT NOT NULL DEFAULT '[]',
                scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL,
                character_asset_ids TEXT NOT NULL DEFAULT '[]',
                costume_asset_ids TEXT NOT NULL DEFAULT '[]',
                scene_asset_ids TEXT NOT NULL DEFAULT '[]',
                reference_asset_ids TEXT NOT NULL DEFAULT '[]',
                image_prompt TEXT NOT NULL DEFAULT '',
                video_prompt TEXT NOT NULL DEFAULT '',
                selected_image_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
                selected_video_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                shot_id TEXT REFERENCES shots(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                asset_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
                source TEXT NOT NULL DEFAULT 'upload',
                provider TEXT,
                model TEXT,
                prompt TEXT,
                params TEXT NOT NULL DEFAULT '{}',
                upstream_asset_ids TEXT NOT NULL DEFAULT '[]',
                task_id TEXT REFERENCES generation_tasks(id) ON DELETE SET NULL,
                is_selected INTEGER NOT NULL DEFAULT 0,
                review_status TEXT NOT NULL DEFAULT 'unreviewed',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS prompt_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                content TEXT NOT NULL,
                variables TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS generation_tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                shot_id TEXT REFERENCES shots(id) ON DELETE SET NULL,
                task_type TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt TEXT NOT NULL,
                params TEXT NOT NULL DEFAULT '{}',
                reference_asset_ids TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                max_retries INTEGER NOT NULL DEFAULT 1,
                external_task_id TEXT,
                result_asset_ids TEXT NOT NULL DEFAULT '[]',
                error_message TEXT,
                estimated_cost REAL NOT NULL DEFAULT 0,
                started_at TEXT,
                finished_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS api_call_logs (
                id TEXT PRIMARY KEY,
                task_id TEXT REFERENCES generation_tasks(id) ON DELETE SET NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                request_payload TEXT NOT NULL DEFAULT '{}',
                response_payload TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL,
                error_message TEXT,
                estimated_cost REAL NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
            CREATE INDEX IF NOT EXISTS idx_assets_shot ON assets(shot_id);
            CREATE INDEX IF NOT EXISTS idx_shots_project ON shots(project_id);
            CREATE INDEX IF NOT EXISTS idx_workspaces_project ON project_development_workspaces(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON generation_tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON generation_tasks(project_id);
            """
        )
        _ensure_column(conn, "assets", "review_status", "TEXT NOT NULL DEFAULT 'unreviewed'")
        _ensure_column(conn, "shots", "character_asset_ids", "TEXT NOT NULL DEFAULT '[]'")
        _ensure_column(conn, "shots", "costume_asset_ids", "TEXT NOT NULL DEFAULT '[]'")
        _ensure_column(conn, "shots", "scene_asset_ids", "TEXT NOT NULL DEFAULT '[]'")
        _seed_prompt_templates(conn)
        conn.commit()


def _seed_prompt_templates(conn: sqlite3.Connection) -> None:
    total = conn.execute("SELECT COUNT(*) FROM prompt_templates").fetchone()[0]
    if total:
        return

    now = utcnow()
    templates = [
        (
            "角色三视图模板",
            "character",
            "为角色 {{character_name}} 生成正面、侧面、背面三视图，保持五官、发型、服装和比例一致。风格：{{style}}。",
        ),
        (
            "场景四宫格模板",
            "scene",
            "生成 {{scene_name}} 的四宫格场景参考图，分别展示远景、中景、近景和关键道具细节，统一色调：{{mood}}。",
        ),
        (
            "人物一致性模板",
            "image",
            "基于参考图保持角色身份一致，生成镜头画面：{{shot_story}}。要求服装、年龄、发型和面部特征稳定。",
        ),
        (
            "图生视频模板",
            "video",
            "基于参考图生成 {{duration}} 秒视频，动作：{{action}}，镜头运动：{{camera_move}}，保持主体稳定、无畸变。",
        ),
    ]
    for name, category, content in templates:
        conn.execute(
            """
            INSERT INTO prompt_templates (
                id, name, category, content, variables, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, '[]', '', ?, ?)
            """,
            (new_id("tpl"), name, category, content, now, now),
        )


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
