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


class RepoFunctionInfo(BaseModel):
    name: str
    type: str   # function | async_function | class | method | arrow_function | struct | enum | trait | impl
    line: int
    line_count: int = 0          # number of lines in the body (0 = unknown)
    params: list[str] = []       # simplified parameter names
    returns: str | None = None   # return type if detectable
    summary: str | None = None   # AI-generated summary (populated after analysis)


class RepoFunctionSummary(BaseModel):
    name: str
    summary: str


class RepoFileDetailResponse(BaseModel):
    repo_id: str
    file_path: str
    language: str
    in_degree: int
    out_degree: int
    is_entry: bool
    is_orphan: bool
    source_code: str | None = None
    imports: list[str]
    dependents: list[str]
    functions: list[RepoFunctionInfo] = []
    function_count: int = 0


class RepoFileSummary(BaseModel):
    path: str
    summary: str
    keywords: list[str] = []                         # AI-extracted technical keywords
    function_summaries: list[RepoFunctionSummary] = []


class RepoSummariesResponse(BaseModel):
    repo_id: str
    total_files: int
    summarized_files: int
    summaries: list[RepoFileSummary]


class EmbeddingStatusResponse(BaseModel):
    repo_id: str
    status: str          # processing | complete | failed | not_started
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_msg: str | None = None
    file_count: int = 0  # number of files embedded (0 until complete)
    message: str = ""


class RepoKeywordReference(BaseModel):
    keyword: str
    normal_reference_url: str | None = None
    youtube_reference_url: str | None = None
    youtube_search_url: str
    cache_hit: bool = False


class RepoFileKeywordReferencesResponse(BaseModel):
    repo_id: str
    file_path: str
    keyword_count: int
    references: list[RepoKeywordReference] = []
