from typing import Optional

from redis.asyncio import Redis

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)

_redis_client: Optional[Redis] = None


async def connect_to_redis() -> Redis:
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    await _redis_client.ping()
    logger.info("Connected to Redis")

    return _redis_client


def get_redis() -> Redis:
    if _redis_client is None:
        raise RuntimeError("Redis is not connected. Call connect_to_redis first.")
    return _redis_client


async def close_redis_connection() -> None:
    global _redis_client

    if _redis_client is not None:
        await _redis_client.close()
        logger.info("Redis connection closed")

    _redis_client = None
