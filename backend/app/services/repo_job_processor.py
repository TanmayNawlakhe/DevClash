from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.config import settings
from app.db.mongodb import get_database
from app.db.redis_client import get_redis
from app.services.repo_analyzer import analyze_repository_graph
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)


class RepoJobCancelled(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _progress_payload(stage: str, percent: int, current_file: str | None = None) -> dict[str, Any]:
    return {
        "stage": stage,
        "percent": max(0, min(percent, 100)),
        "current_file": current_file,
        "updated_at": _utcnow(),
    }


async def enqueue_repo_job(repo_id: str) -> None:
    redis = get_redis()
    await redis.lpush(settings.analysis_queue_key, repo_id)


async def remove_repo_job_from_queue(repo_id: str) -> int:
    redis = get_redis()
    return await redis.lrem(settings.analysis_queue_key, 0, repo_id)


async def process_repo_job(repo_object_id: ObjectId) -> None:
    db = get_database()
    repos_collection = db["repos"]
    graphs_collection = db["graphs"]

    repo_doc = await repos_collection.find_one({"_id": repo_object_id})
    if not repo_doc:
        logger.warning("Repo job %s not found", repo_object_id)
        return

    if repo_doc.get("status") == "cancelled":
        logger.info("Skipping cancelled repo job %s", repo_object_id)
        return

    github_url = repo_doc.get("github_url")
    if not github_url:
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": _utcnow(),
                    "error_msg": "Missing github_url",
                }
            },
        )
        return

    await repos_collection.update_one(
        {"_id": repo_object_id},
        {
            "$set": {
                "status": "analyzing",
                "cancel_requested": False,
                "started_at": _utcnow(),
                "completed_at": None,
                "error_msg": None,
                "progress": _progress_payload("cloning", 5),
            }
        },
    )

    async def progress_callback(stage: str, percent: int, current_file: str | None = None) -> None:
        doc = await repos_collection.find_one(
            {"_id": repo_object_id},
            projection={"cancel_requested": 1, "status": 1},
        )

        if doc and (doc.get("cancel_requested") or doc.get("status") == "cancelled"):
            raise RepoJobCancelled()

        await repos_collection.update_one(
            {"_id": repo_object_id},
            {"$set": {"progress": _progress_payload(stage, percent, current_file)}},
        )

    try:
        graph_payload = await analyze_repository_graph(
            github_url=github_url,
            clone_base_dir=settings.repo_clone_base_dir,
            clone_timeout_seconds=settings.clone_timeout_seconds,
            progress_callback=progress_callback,
        )

        now = _utcnow()
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
                    "cancel_requested": False,
                    "node_count": graph_payload["meta"].get("nodeCount", 0),
                    "edge_count": graph_payload["meta"].get("edgeCount", 0),
                    "progress": _progress_payload("complete", 100),
                }
            },
        )
        logger.info("Repository graph analysis complete for %s", github_url)

    except RepoJobCancelled:
        now = _utcnow()
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "cancelled",
                    "completed_at": now,
                    "cancel_requested": False,
                    "error_msg": "Cancelled by user",
                    "progress": _progress_payload("cancelled", 100),
                }
            },
        )
        logger.info("Repository graph analysis cancelled for %s", github_url)

    except Exception as exc:
        now = _utcnow()
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": now,
                    "cancel_requested": False,
                    "error_msg": str(exc),
                    "progress": _progress_payload("failed", 100),
                }
            },
        )
        logger.exception("Repository graph analysis failed for %s", github_url)
