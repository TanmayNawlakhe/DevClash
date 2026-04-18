from __future__ import annotations

import asyncio

from bson import ObjectId

from app.config import settings
from app.db.mongodb import close_mongodb_connection, connect_to_mongodb
from app.db.redis_client import close_redis_connection, connect_to_redis, get_redis
from app.services.repo_job_processor import process_repo_job
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)


async def run_worker() -> None:
    await connect_to_mongodb()
    await connect_to_redis()
    redis = get_redis()

    logger.info("Worker started. Listening on Redis queue: %s", settings.analysis_queue_key)

    try:
        while True:
            queue_item = await redis.brpop(settings.analysis_queue_key, timeout=5)
            if queue_item is None:
                continue

            _, repo_id = queue_item
            try:
                repo_object_id = ObjectId(repo_id)
            except Exception:
                logger.warning("Skipping invalid repo id in queue: %s", repo_id)
                continue

            await process_repo_job(repo_object_id)

    finally:
        await close_redis_connection()
        await close_mongodb_connection()


if __name__ == "__main__":
    asyncio.run(run_worker())
