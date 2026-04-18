from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings
from app.db.mongodb import get_database
from app.schemas.repo import (
    RepoActionResponse,
    RepoCreateRequest,
    RepoFileDetailResponse,
    RepoGraphResponse,
    RepoListResponse,
    RepoStatusResponse,
    RepoSubmitResponse,
)
from app.services.repo_analyzer import is_supported_github_url, normalize_github_url
from app.services.repo_job_processor import enqueue_repo_job, remove_repo_job_from_queue
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)
router = APIRouter(prefix="/api/repos", tags=["repos"])


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
    return RepoFileDetailResponse(
        repo_id=repo_id,
        file_path=file_path,
        language=str(data.get("language", "unknown")),
        in_degree=int(data.get("inDegree", 0)),
        out_degree=int(data.get("outDegree", 0)),
        is_entry=bool(data.get("isEntry", False)),
        is_orphan=bool(data.get("isOrphan", False)),
        imports=imports,
        dependents=dependents,
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
