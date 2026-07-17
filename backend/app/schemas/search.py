from typing import Any, Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="Natural language query")
    top_files: int = Field(default=8, ge=1, le=20)
    top_functions: int = Field(default=5, ge=1, le=10)
    min_score: float = Field(default=0.30, ge=0.0, le=1.0)
    use_graph: bool = Field(
        default=True,
        description="Hybrid dense + import-graph retrieval. False = pure vector top-k.",
    )


class MatchedFunction(BaseModel):
    name: str
    score: float


class FlowEntry(BaseModel):
    rank: int
    file_path: str
    relevance_score: float
    score_breakdown: dict[str, float]
    layer: str
    language: str
    is_entry: bool
    summary: str
    matched_functions: list[MatchedFunction]
    # ── Graph-RAG provenance (hybrid mode only) ──────────────────────────────
    retrieved_via: Optional[str] = None      # "vector" | "graph"
    hop_distance: Optional[int] = None       # 0 = seed, else hops from nearest seed
    graph_boost: Optional[float] = None      # spreading-activation contribution
    cosine_score: Optional[float] = None      # pre-graph vector score


class SearchResponse(BaseModel):
    query: str
    repo_id: str
    total_matched: int
    flow: list[FlowEntry]
    answer: str          # LLM natural-language explanation of the flow
    mermaid: str         # Mermaid flowchart code ready to render
    retrieval: Optional[dict[str, Any]] = None   # mode + graph params used
