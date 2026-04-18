from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId

from app.config import settings
from app.db.mongodb import get_database
from app.db.redis_client import get_redis
from app.services.repo_analyzer import analyze_repository_graph
from app.services.openrouter_ai import generate_file_summaries_from_disk
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

    # clone_path is returned by the analyzer; WE are responsible for cleanup
    clone_path: Path | None = None

    try:
        logger.info("[job] Cloning & analysing repo: %s", github_url)
        graph_payload, clone_path = await analyze_repository_graph(
            github_url=github_url,
            clone_base_dir=settings.repo_clone_base_dir,
            clone_timeout_seconds=settings.clone_timeout_seconds,
            progress_callback=progress_callback,
        )

        nodes: list[dict] = graph_payload["nodes"]
        edges: list[dict] = graph_payload["edges"]
        node_count: int = graph_payload["meta"].get("nodeCount", 0)
        edge_count: int = graph_payload["meta"].get("edgeCount", 0)

        logger.info(
            "[job] Graph built for %s — %d nodes, %d edges. Clone still on disk at %s",
            github_url,
            node_count,
            edge_count,
            clone_path,
        )

        # ------------------------------------------------------------------ #
        # AI file summarisation — files are still on disk, batch size = 6    #
        # ------------------------------------------------------------------ #
        await repos_collection.update_one(
            {"_id": repo_object_id},
            {"$set": {"progress": _progress_payload("summarising", 96)}},
        )
        logger.info(
            "[job] Starting AI summarisation for %d files in batches of 6",
            node_count,
        )

        summaries_by_path = await generate_file_summaries_from_disk(
            repo_url=github_url,
            nodes=nodes,
            edges=edges,
            clone_path=clone_path,
            chunk_size=6,
        )

        logger.info(
            "[job] AI summarisation complete — %d/%d files got a summary",
            len(summaries_by_path),
            node_count,
        )

        # ------------------------------------------------------------------ #
        # Persist graph + summaries to DB                                     #
        # ------------------------------------------------------------------ #
        now = _utcnow()

        file_paths: list[str] = [str(n.get("id", "")) for n in nodes if n.get("id")]

        # Convert {path: summary} → [{path, summary}] for storage
        summaries_list = [
            {"path": p, "summary": s} for p, s in summaries_by_path.items()
        ]

        logger.info(
            "[job] Persisting graph + %d summaries to DB for %s",
            len(summaries_list),
            github_url,
        )

        await graphs_collection.replace_one(
            {"repo_id": repo_object_id},
            {
                "repo_id": repo_object_id,
                "nodes": nodes,
                "edges": edges,
                "meta": graph_payload["meta"],
                # Flat path list kept for quick look-ups without loading full nodes
                "file_paths": file_paths,
                # Retain clone path so file detail endpoint can read source previews.
                "clone_path": str(clone_path) if clone_path is not None else None,
                # Pre-computed AI summaries — served by GET /api/repos/{id}/summaries
                "summaries": summaries_list,
                "updated_at": now,
            },
            upsert=True,
        )
        logger.info("[job] Graph document saved to DB for %s", github_url)

        await repos_collection.update_one(
            {"_id": repo_object_id},
            {
                "$set": {
                    "status": "complete",
                    "completed_at": now,
                    "error_msg": None,
                    "cancel_requested": False,
                    "node_count": node_count,
                    "edge_count": edge_count,
                    "progress": _progress_payload("complete", 100),
                }
            },
        )
        logger.info(
            "[job] Repo %s marked complete — nodes=%d edges=%d summaries=%d",
            github_url,
            node_count,
            edge_count,
            len(summaries_list),
        )

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
        logger.info("[job] Repo analysis cancelled for %s", github_url)

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
        logger.exception("[job] Repo analysis failed for %s", github_url)

    finally:
        # Always remove the cloned repo from disk, regardless of outcome
        if clone_path is not None:
            # shutil.rmtree(clone_path, ignore_errors=True)
            logger.info("[job] Cleaned up clone directory: %s", clone_path)
