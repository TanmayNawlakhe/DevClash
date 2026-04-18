import asyncio
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.db.mongodb import get_database
from app.schemas.repo import (
    RepoCreateRequest,
    RepoGraphResponse,
    RepoStatusResponse,
    RepoSubmitResponse,
)
from app.services.repo_analyzer import (
    analyze_repository_graph,
    is_supported_github_url,
    normalize_github_url,
)
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)
router = APIRouter(prefix="/api/repos", tags=["repos"])

_ANALYSIS_TASKS: set[asyncio.Task[Any]] = set()


async def ensure_repo_indexes() -> None:
    db = get_database()
    await db["repos"].create_index("github_url", unique=True)
    await db["graphs"].create_index("repo_id", unique=True)


def _track_task(task: asyncio.Task[Any]) -> None:
    _ANALYSIS_TASKS.add(task)
    task.add_done_callback(_ANALYSIS_TASKS.discard)


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
    )


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
    if existing and existing.get("status") in {"pending", "analyzing", "complete"}:
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
                    "status": "analyzing",
                    "created_at": now,
                    "completed_at": None,
                    "error_msg": None,
                }
            },
        )
    else:
        insert_result = await repos_collection.insert_one(
            {
                "github_url": github_url,
                "status": "analyzing",
                "created_at": now,
                "completed_at": None,
                "error_msg": None,
            }
        )
        repo_object_id = insert_result.inserted_id

    task = asyncio.create_task(_analyze_and_store(repo_object_id, github_url))
    _track_task(task)

    return RepoSubmitResponse(
        repo_id=str(repo_object_id),
        github_url=github_url,
        status="analyzing",
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
async def get_repo_graph(repo_id: str) -> RepoGraphResponse:
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

    return RepoGraphResponse(
        repo_id=repo_id,
        nodes=graph_doc.get("nodes", []),
        edges=graph_doc.get("edges", []),
        meta=graph_doc.get("meta", {}),
    )


async def _analyze_and_store(repo_object_id: ObjectId, github_url: str) -> None:
    db = get_database()
    repos_collection = db["repos"]
    graphs_collection = db["graphs"]

    try:
        graph_payload = await analyze_repository_graph(
            github_url=github_url,
            clone_base_dir=settings.repo_clone_base_dir,
            clone_timeout_seconds=settings.clone_timeout_seconds,
        )

        now = datetime.now(timezone.utc)

        await graphs_collection.replace_one(
            {"repo_id": repo_object_id},
            {
                "repo_id": repo_object_id,
                "nodes": graph_payload["nodes"],
                "edges": graph_payload["edges"],
                "meta": graph_payload["meta"],
                "updated_at": now,
            },
            upsert=True,
        )

        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "complete",
                    "completed_at": now,
                    "error_msg": None,
                    "node_count": graph_payload["meta"].get("nodeCount", 0),
                    "edge_count": graph_payload["meta"].get("edgeCount", 0),
                }
            },
        )
        logger.info("Repository graph analysis complete for %s", github_url)

    except Exception as exc:
        now = datetime.now(timezone.utc)
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": now,
                    "error_msg": str(exc),
                }
            },
        )
        logger.exception("Repository graph analysis failed for %s", github_url)
