from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
from typing import Any
from urllib.parse import quote_plus

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.config import settings
from app.db.mongodb import get_database
from app.schemas.repo import (
    EmbeddingStatusResponse,
    RepoActionResponse,
    RepoCreateRequest,
    RepoFileDetailResponse,
    RepoFileKeywordReferencesResponse,
    RepoFileSummary,
    RepoFunctionInfo,
    RepoFunctionSummary,
    RepoGraphResponse,
    RepoKeywordReference,
    RepoListResponse,
    RepoStatusResponse,
    RepoSubmitResponse,
    RepoSummariesResponse,
)
from app.services.keyword_references import get_or_fetch_keyword_reference_urls
from app.services.repo_analyzer import is_supported_github_url, normalize_github_url
from app.services.repo_job_processor import enqueue_repo_job, remove_repo_job_from_queue
from app.services.embedding_service import run_embedding_job
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)
router = APIRouter(prefix="/api/repos", tags=["repos"])

MAX_SOURCE_PREVIEW_CHARS = 80_000


def _youtube_search_url(keyword: str) -> str:
    return f"https://www.youtube.com/results?search_query={quote_plus(keyword + ' youtube tutorial')}"


async def ensure_repo_indexes() -> None:
    db = get_database()
    await db["repos"].create_index("github_url", unique=True)
    await db["repos"].create_index("created_at")
    await db["repos"].create_index("status")
    await db["graphs"].create_index("repo_id", unique=True)


def _to_object_id(repo_id: str) -> ObjectId:
    try:
        return ObjectId(repo_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid repo id format",
        ) from exc


def _serialize_repo_status(doc: dict[str, Any]) -> RepoStatusResponse:
    return RepoStatusResponse(
        repo_id=str(doc["_id"]),
        github_url=doc["github_url"],
        status=doc.get("status", "unknown"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        completed_at=doc.get("completed_at"),
        error_msg=doc.get("error_msg"),
        node_count=doc.get("node_count"),
        edge_count=doc.get("edge_count"),
        progress=doc.get("progress"),
    )


def _progress_payload(stage: str, percent: int, current_file: str | None = None) -> dict[str, Any]:
    return {
        "stage": stage,
        "percent": max(0, min(percent, 100)),
        "current_file": current_file,
        "updated_at": datetime.now(timezone.utc),
    }


def _read_source_preview(clone_path: Path, file_path: str) -> str | None:
    try:
        base = clone_path.resolve()
        candidate = (base / Path(file_path)).resolve()
        candidate.relative_to(base)
        if not candidate.is_file():
            return None

        content = candidate.read_text(encoding="utf-8", errors="ignore")
        if len(content) <= MAX_SOURCE_PREVIEW_CHARS:
            return content

        return (
            content[:MAX_SOURCE_PREVIEW_CHARS]
            + "\n\n[preview truncated due to file size]"
        )
    except Exception:
        return None


def _count_lines_from_clone(clone_path: Path, file_path: str) -> int | None:
    try:
        base = clone_path.resolve()
        candidate = (base / Path(file_path)).resolve()
        candidate.relative_to(base)
        if not candidate.is_file():
            return None

        content = candidate.read_text(encoding="utf-8", errors="ignore")
        normalized = content.replace("\r\n", "\n").replace("\r", "\n")
        return max(1, len(normalized.split("\n")))
    except Exception:
        return None


def _node_line_count(node: dict[str, Any]) -> int:
    try:
        return int(node.get("data", {}).get("lineCount") or 0)
    except Exception:
        return 0


def _ensure_preview_clone(repo_id: str, github_url: str) -> Path | None:
    try:
        clone_base = Path(settings.repo_clone_base_dir)
        clone_base.mkdir(parents=True, exist_ok=True)
        preview_path = clone_base / f"preview_{repo_id}"

        # Replace broken or partial clone directories.
        if preview_path.exists() and not (preview_path / ".git").exists():
            shutil.rmtree(preview_path, ignore_errors=True)

        if not preview_path.exists():
            result = subprocess.run(
                [
                    "git",
                    "clone",
                    "--depth",
                    "1",
                    "--single-branch",
                    github_url,
                    str(preview_path),
                ],
                capture_output=True,
                text=True,
                timeout=settings.clone_timeout_seconds,
                check=False,
            )
            if result.returncode != 0:
                logger.warning(
                    "[file-detail] Preview clone failed for repo %s: %s",
                    repo_id,
                    (result.stderr or result.stdout or "unknown error").strip(),
                )
                return None

        return preview_path
    except Exception:
        logger.exception("[file-detail] Failed to ensure preview clone for repo %s", repo_id)
        return None


def _filter_graph_payload(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    language: str | None,
    path_prefix: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not language and not path_prefix:
        return nodes, edges

    language_norm = language.strip().lower() if language else None
    prefix_norm = path_prefix.strip() if path_prefix else None

    filtered_nodes: list[dict[str, Any]] = []
    for node in nodes:
        data = node.get("data", {})
        node_language = str(data.get("language", "")).lower()
        node_path = str(data.get("path", ""))

        if language_norm and node_language != language_norm:
            continue
        if prefix_norm and not node_path.startswith(prefix_norm):
            continue
        filtered_nodes.append(node)

    allowed_node_ids = {node.get("id") for node in filtered_nodes}
    filtered_edges = [
        edge
        for edge in edges
        if edge.get("source") in allowed_node_ids and edge.get("target") in allowed_node_ids
    ]
    return filtered_nodes, filtered_edges


@router.get("", response_model=RepoListResponse)
async def list_recent_repos(
    limit: int = Query(default=20, ge=1, le=100),
) -> RepoListResponse:
    db = get_database()
    cursor = db["repos"].find().sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    items = [_serialize_repo_status(doc) for doc in docs]
    return RepoListResponse(items=items)


@router.post("", response_model=RepoSubmitResponse)
async def submit_repo(request: RepoCreateRequest) -> RepoSubmitResponse:
    if not is_supported_github_url(request.github_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only GitHub repository URLs are supported in this MVP",
        )

    github_url = normalize_github_url(request.github_url)
    db = get_database()
    repos_collection = db["repos"]

    existing = await repos_collection.find_one({"github_url": github_url})
    if existing and existing.get("status") in {"pending", "analyzing", "cancelling", "complete"}:
        return RepoSubmitResponse(
            repo_id=str(existing["_id"]),
            github_url=existing["github_url"],
            status=existing.get("status", "unknown"),
        )

    now = datetime.now(timezone.utc)

    if existing:
        repo_object_id = existing["_id"]
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "pending",
                    "created_at": now,
                    "completed_at": None,
                    "error_msg": None,
                    "cancel_requested": False,
                    "progress": _progress_payload("queued", 0),
                }
            },
        )
    else:
        insert_result = await repos_collection.insert_one(
            {
                "github_url": github_url,
                "status": "pending",
                "created_at": now,
                "completed_at": None,
                "error_msg": None,
                "cancel_requested": False,
                "progress": _progress_payload("queued", 0),
            }
        )
        repo_object_id = insert_result.inserted_id

    await enqueue_repo_job(str(repo_object_id))

    return RepoSubmitResponse(
        repo_id=str(repo_object_id),
        github_url=github_url,
        status="pending",
    )


@router.get("/{repo_id}", response_model=RepoStatusResponse)
async def get_repo_status(repo_id: str) -> RepoStatusResponse:
    repo_object_id = _to_object_id(repo_id)

    db = get_database()
    doc = await db["repos"].find_one({"_id": repo_object_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    return _serialize_repo_status(doc)


@router.get("/{repo_id}/graph", response_model=RepoGraphResponse)
async def get_repo_graph(
    repo_id: str,
    language: str | None = Query(default=None),
    path_prefix: str | None = Query(default=None),
) -> RepoGraphResponse:
    repo_object_id = _to_object_id(repo_id)
    db = get_database()

    repo_doc = await db["repos"].find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    if repo_doc.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository graph is not ready yet (status: {repo_doc.get('status')})",
        )

    graph_doc = await db["graphs"].find_one({"repo_id": repo_object_id})
    if not graph_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph document was not found for this repository",
        )

    nodes = graph_doc.get("nodes", [])
    edges = graph_doc.get("edges", [])

    clone_path_raw = graph_doc.get("clone_path")
    if clone_path_raw and any(_node_line_count(node) <= 0 for node in nodes):
        clone_path = Path(str(clone_path_raw))
        did_update = False
        for node in nodes:
            if _node_line_count(node) > 0:
                continue

            file_id = str(node.get("id", ""))
            line_count = _count_lines_from_clone(clone_path, file_id)
            if line_count is None:
                continue

            node.setdefault("data", {})["lineCount"] = line_count
            did_update = True

        if did_update:
            await db["graphs"].update_one(
                {"repo_id": repo_object_id},
                {"$set": {"nodes": nodes}},
            )

    filtered_nodes, filtered_edges = _filter_graph_payload(
        nodes=nodes,
        edges=edges,
        language=language,
        path_prefix=path_prefix,
    )

    meta = dict(graph_doc.get("meta", {}))
    if language or path_prefix:
        meta["filtered"] = True
        meta["originalNodeCount"] = len(nodes)
        meta["originalEdgeCount"] = len(edges)
        meta["nodeCount"] = len(filtered_nodes)
        meta["edgeCount"] = len(filtered_edges)

    return RepoGraphResponse(
        repo_id=repo_id,
        nodes=filtered_nodes,
        edges=filtered_edges,
        meta=meta,
    )


@router.get("/{repo_id}/summaries", response_model=RepoSummariesResponse)
async def get_repo_summaries(repo_id: str) -> RepoSummariesResponse:
    """Return the pre-computed AI file summaries for a completed repository.

    Summaries are generated during the analysis job (while the repo is still
    cloned on disk) and stored in the graph document.  This endpoint simply
    reads them back — no AI calls are made at request time.
    """
    repo_object_id = _to_object_id(repo_id)
    db = get_database()

    logger.info("[summaries] Request received for repo_id=%s", repo_id)

    repo_doc = await db["repos"].find_one({"_id": repo_object_id})
    if not repo_doc:
        logger.warning("[summaries] Repo %s not found", repo_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    if repo_doc.get("status") != "complete":
        logger.warning(
            "[summaries] Repo %s not complete yet (status=%s)",
            repo_id,
            repo_doc.get("status"),
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository graph is not ready yet (status: {repo_doc.get('status')})",
        )

    graph_doc = await db["graphs"].find_one({"repo_id": repo_object_id})
    if not graph_doc:
        logger.warning("[summaries] Graph document missing for repo %s", repo_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph document was not found for this repository",
        )

    # Summaries were computed during the analysis job and stored in the graph doc
    raw_summaries: list[dict] = graph_doc.get("summaries", [])
    total_files: int = len(graph_doc.get("nodes", []))

    logger.info(
        "[summaries] Returning %d pre-computed summaries for repo %s (total files: %d)",
        len(raw_summaries),
        repo_id,
        total_files,
    )

    summary_list = [
        RepoFileSummary(
            path=str(item.get("path", "")),
            summary=str(item.get("summary", "")),
            keywords=[str(k) for k in item.get("keywords", []) if k],
            function_summaries=[
                RepoFunctionSummary(
                    name=str(fs.get("name", "")),
                    summary=str(fs.get("summary", "")),
                )
                for fs in item.get("function_summaries", [])
                if fs.get("name") and fs.get("summary")
            ],
        )
        for item in raw_summaries
        if item.get("path") and item.get("summary")
    ]

    return RepoSummariesResponse(
        repo_id=repo_id,
        total_files=total_files,
        summarized_files=len(summary_list),
        summaries=summary_list,
    )


@router.get("/{repo_id}/file-references", response_model=RepoFileKeywordReferencesResponse)
async def get_repo_file_references(
    repo_id: str,
    file_path: str = Query(..., description="Repository-relative file path"),
) -> RepoFileKeywordReferencesResponse:
    repo_object_id = _to_object_id(repo_id)
    db = get_database()

    repo_doc = await db["repos"].find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    if repo_doc.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository graph is not ready yet (status: {repo_doc.get('status')})",
        )

    graph_doc = await db["graphs"].find_one({"repo_id": repo_object_id})
    if not graph_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph document was not found for this repository",
        )

    nodes: list[dict[str, Any]] = graph_doc.get("nodes", [])
    node_map = {str(node.get("id")): node for node in nodes}
    selected_node = node_map.get(file_path)
    if not selected_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File path not found in graph",
        )

    data = selected_node.get("data", {})
    raw_keywords = data.get("keywords", [])
    ordered_keywords: list[str] = []
    seen: set[str] = set()
    for kw in raw_keywords if isinstance(raw_keywords, list) else []:
        cleaned = str(kw).strip()
        dedupe_key = cleaned.lower()
        if not cleaned or dedupe_key in seen:
            continue
        ordered_keywords.append(cleaned)
        seen.add(dedupe_key)

    references: list[RepoKeywordReference] = []
    for keyword in ordered_keywords:
        try:
            payload = await get_or_fetch_keyword_reference_urls(keyword)
        except RuntimeError as exc:
            logger.warning(
                "[file-references] Tavily unavailable for keyword '%s' in repo %s: %s",
                keyword,
                repo_id,
                exc,
            )
            references.append(
                RepoKeywordReference(
                    keyword=keyword,
                    normal_reference_url=None,
                    youtube_reference_url=None,
                    youtube_search_url=_youtube_search_url(keyword),
                    cache_hit=False,
                )
            )
            continue
        references.append(
            RepoKeywordReference(
                keyword=keyword,
                normal_reference_url=payload.get("normal_reference_url"),
                youtube_reference_url=payload.get("youtube_reference_url"),
                youtube_search_url=str(payload.get("youtube_search_url", "")),
                cache_hit=bool(payload.get("cache_hit", False)),
            )
        )

    return RepoFileKeywordReferencesResponse(
        repo_id=repo_id,
        file_path=file_path,
        keyword_count=len(ordered_keywords),
        references=references,
    )


@router.get("/{repo_id}/files/{file_path:path}", response_model=RepoFileDetailResponse)
async def get_repo_file_detail(repo_id: str, file_path: str) -> RepoFileDetailResponse:
    db = get_database()
    repos_collection = db["repos"]
    graph_collection = db["graphs"]
    repo_object_id = _to_object_id(repo_id)

    repo_doc = await repos_collection.find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    if repo_doc.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository graph is not ready yet (status: {repo_doc.get('status')})",
        )

    graph_doc = await graph_collection.find_one({"repo_id": repo_object_id})
    if not graph_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Graph document was not found for this repository",
        )

    nodes: list[dict[str, Any]] = graph_doc.get("nodes", [])
    edges: list[dict[str, Any]] = graph_doc.get("edges", [])

    node_map = {str(node.get("id")): node for node in nodes}
    selected_node = node_map.get(file_path)

    if not selected_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File path not found in graph",
        )

    imports = sorted(
        str(edge.get("target")) for edge in edges if str(edge.get("source")) == file_path
    )
    dependents = sorted(
        str(edge.get("source")) for edge in edges if str(edge.get("target")) == file_path
    )

    data = selected_node.get("data", {})

    source_code: str | None = None

    clone_path_raw = graph_doc.get("clone_path")
    if clone_path_raw:
        source_code = _read_source_preview(Path(str(clone_path_raw)), file_path)

    if source_code is None:
        preview_path = _ensure_preview_clone(repo_id=repo_id, github_url=repo_doc["github_url"])
        if preview_path is not None:
            source_code = _read_source_preview(preview_path, file_path)
            await graph_collection.update_one(
                {"repo_id": repo_object_id},
                {"$set": {"clone_path": str(preview_path)}},
            )

    # Extract pre-computed function list from node data
    raw_funcs: list[dict] = data.get("functions", [])
    function_list = [
        RepoFunctionInfo(
            name=str(f.get("name", "")),
            type=str(f.get("type", "function")),
            line=int(f.get("line", 0)),
        )
        for f in raw_funcs
        if f.get("name")
    ]

    return RepoFileDetailResponse(
        repo_id=repo_id,
        file_path=file_path,
        language=str(data.get("language", "unknown")),
        in_degree=int(data.get("inDegree", 0)),
        out_degree=int(data.get("outDegree", 0)),
        is_entry=bool(data.get("isEntry", False)),
        is_orphan=bool(data.get("isOrphan", False)),
        source_code=source_code,
        imports=imports,
        dependents=dependents,
        functions=function_list,
        function_count=len(raw_funcs),
    )


@router.post("/{repo_id}/cancel", response_model=RepoActionResponse)
async def cancel_repo_job(repo_id: str) -> RepoActionResponse:
    repo_object_id = _to_object_id(repo_id)
    db = get_database()
    repos_collection = db["repos"]

    repo_doc = await repos_collection.find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    status_value = repo_doc.get("status")

    if status_value == "pending":
        await remove_repo_job_from_queue(str(repo_object_id))
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "cancelled",
                    "completed_at": datetime.now(timezone.utc),
                    "cancel_requested": False,
                    "error_msg": "Cancelled by user",
                    "progress": _progress_payload("cancelled", 100),
                }
            },
        )
        return RepoActionResponse(
            repo_id=repo_id,
            status="cancelled",
            message="Pending job cancelled",
        )

    if status_value in {"analyzing", "cancelling"}:
        current_progress = repo_doc.get("progress") or {}
        percent = int(current_progress.get("percent", 0))
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "cancelling",
                    "cancel_requested": True,
                    "progress": _progress_payload("cancelling", percent),
                }
            },
        )
        return RepoActionResponse(
            repo_id=repo_id,
            status="cancelling",
            message="Cancellation requested",
        )

    return RepoActionResponse(
        repo_id=repo_id,
        status=status_value or "unknown",
        message="Job is not running; nothing to cancel",
    )


@router.post("/{repo_id}/retry", response_model=RepoActionResponse)
async def retry_repo_job(repo_id: str) -> RepoActionResponse:
    repo_object_id = _to_object_id(repo_id)
    db = get_database()
    repos_collection = db["repos"]
    graph_collection = db["graphs"]

    repo_doc = await repos_collection.find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository analysis job not found",
        )

    status_value = repo_doc.get("status")
    if status_value in {"pending", "analyzing", "cancelling"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot retry while job is active (status: {status_value})",
        )

    await repos_collection.update_one(
        {"_id": repo_object_id},
        {
            "$set": {
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "completed_at": None,
                "error_msg": None,
                "cancel_requested": False,
                "node_count": None,
                "edge_count": None,
                "progress": _progress_payload("queued", 0),
            }
        },
    )

    await graph_collection.delete_one({"repo_id": repo_object_id})
    await enqueue_repo_job(str(repo_object_id))

    return RepoActionResponse(
        repo_id=repo_id,
        status="pending",
        message="Retry scheduled",
    )


# ── Embedding endpoints ────────────────────────────────────────────────────────

@router.post("/{repo_id}/embeddings", response_model=EmbeddingStatusResponse)
async def start_repo_embeddings(
    repo_id: str,
    background_tasks: BackgroundTasks,
) -> EmbeddingStatusResponse:
    """Start vector embedding generation for a completed repository.

    Triggers three embeddings per file (CodeBERT on code, MiniLM on file
    summary, MiniLM per-function) and persists them to the ``embeddings``
    collection.  Returns immediately; poll ``GET /embeddings/status`` for
    progress.

    **Requires** the analysis job to be ``complete`` first.
    """
    repo_object_id = _to_object_id(repo_id)
    db = get_database()

    repo_doc = await db["repos"].find_one({"_id": repo_object_id})
    if not repo_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )
    if repo_doc.get("status") != "complete":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository analysis must be complete before embedding (status: {repo_doc.get('status')})",
        )

    # Check if already running
    existing = await db["embeddings"].find_one({"repo_id": repo_object_id})
    if existing and existing.get("status") == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Embedding job is already in progress",
        )

    logger.info("[embeddings] Queuing embedding job for repo %s", repo_id)
    background_tasks.add_task(run_embedding_job, repo_object_id)

    return EmbeddingStatusResponse(
        repo_id=repo_id,
        status="processing",
        message="Embedding generation started in background. Poll GET /embeddings/status for progress.",
    )


@router.get("/{repo_id}/embeddings/status", response_model=EmbeddingStatusResponse)
async def get_embedding_status(repo_id: str) -> EmbeddingStatusResponse:
    """Return the current status of the embedding job for a repository."""
    repo_object_id = _to_object_id(repo_id)
    db = get_database()

    doc = await db["embeddings"].find_one(
        {"repo_id": repo_object_id},
        projection={"file_embeddings": 0},  # exclude large vectors from status
    )
    if not doc:
        return EmbeddingStatusResponse(
            repo_id=repo_id,
            status="not_started",
            message="No embedding job found. POST to /embeddings to start.",
        )

    return EmbeddingStatusResponse(
        repo_id=repo_id,
        status=str(doc.get("status", "unknown")),
        started_at=doc.get("started_at"),
        completed_at=doc.get("completed_at"),
        error_msg=doc.get("error_msg"),
        file_count=int(doc.get("file_count", 0)),
        message=(
            f"{doc.get('file_count', 0)} files embedded"
            if doc.get("status") == "complete"
            else doc.get("error_msg", "")
        ) or "",
    )
