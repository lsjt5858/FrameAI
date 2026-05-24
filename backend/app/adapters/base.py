from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class GenerationArtifact:
    name: str
    asset_type: str
    filename: str
    mime_type: str
    content: bytes
    metadata: dict[str, Any] = field(default_factory=dict)


class GenerationAdapter(Protocol):
    provider: str

    async def generate_image(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        ...

    async def generate_video(self, task: dict[str, Any]) -> list[GenerationArtifact]:
        ...

    async def get_task_status(self, external_task_id: str) -> dict[str, Any]:
        ...

    async def download_result(self, result_url: str) -> bytes:
        ...

