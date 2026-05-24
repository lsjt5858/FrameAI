from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import init_db
from app.routers import assets, projects, prompt_templates, settings as settings_router, shots, tasks
from app.services.storage import ensure_storage_dirs
from app.services.worker import run_worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_storage_dirs()
    worker_task = asyncio.create_task(run_worker_loop())
    try:
        yield
    finally:
        worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker_task


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI 视频制作工作流中台后端 API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(prompt_templates.router, prefix="/api")
app.include_router(shots.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

app.mount("/storage", StaticFiles(directory=settings.storage_dir), name="storage")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

