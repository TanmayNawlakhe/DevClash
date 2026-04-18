from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongodb() -> AsyncIOMotorDatabase:
    global _client, _database

    if _database is not None:
        return _database

    if not settings.mongodb_url:
        raise ValueError("MONGODB_URL is missing. Set it in your environment.")

    _client = AsyncIOMotorClient(settings.mongodb_url)
    _database = _client[settings.mongodb_db_name]

    await _client.admin.command("ping")
    logger.info("Connected to MongoDB Atlas")

    return _database


def get_database() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongodb first.")
    return _database


async def close_mongodb_connection() -> None:
    global _client, _database

    if _client is not None:
        _client.close()
        logger.info("MongoDB connection closed")

    _client = None
    _database = None
