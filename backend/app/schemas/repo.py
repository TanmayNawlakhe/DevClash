from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RepoCreateRequest(BaseModel):
    github_url: str = Field(..., description="Public GitHub repository URL")


class RepoSubmitResponse(BaseModel):
    repo_id: str
    github_url: str
    status: str


class RepoStatusResponse(BaseModel):
    repo_id: str
    github_url: str
    status: str
    created_at: datetime
    completed_at: datetime | None = None
    error_msg: str | None = None
    node_count: int | None = None
    edge_count: int | None = None


class RepoGraphResponse(BaseModel):
    repo_id: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    meta: dict[str, Any]
