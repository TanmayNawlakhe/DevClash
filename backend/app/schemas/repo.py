from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RepoCreateRequest(BaseModel):
    github_url: str = Field(..., description="Public GitHub repository URL")


class RepoSubmitResponse(BaseModel):
    repo_id: str
    github_url: str
    status: str


class RepoProgress(BaseModel):
    stage: str
    percent: int
    current_file: str | None = None
    updated_at: datetime | None = None


class RepoStatusResponse(BaseModel):
    repo_id: str
    github_url: str
    status: str
    created_at: datetime
    completed_at: datetime | None = None
    error_msg: str | None = None
    node_count: int | None = None
    edge_count: int | None = None
    progress: RepoProgress | None = None


class RepoListResponse(BaseModel):
    items: list[RepoStatusResponse]


class RepoGraphResponse(BaseModel):
    repo_id: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    meta: dict[str, Any]


class RepoActionResponse(BaseModel):
    repo_id: str
    status: str
    message: str


class RepoFileDetailResponse(BaseModel):
    repo_id: str
    file_path: str
    language: str
    in_degree: int
    out_degree: int
    is_entry: bool
    is_orphan: bool
    imports: list[str]
    dependents: list[str]


class RepoFileSummary(BaseModel):
    path: str
    summary: str


class RepoSummariesResponse(BaseModel):
    repo_id: str
    total_files: int
    summarized_files: int
    summaries: list[RepoFileSummary]
