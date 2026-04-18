from contextlib import asynccontextmanager
import os
import sys

from fastapi import FastAPI

# Allow running from backend/app (uvicorn main:app) by ensuring backend is on sys.path.
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.db.mongodb import close_mongodb_connection, connect_to_mongodb
from app.db.redis_client import close_redis_connection, connect_to_redis
from app.utils.logger import get_logger
from app.config import settings

logger = get_logger(__name__, level=settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongodb()
    await connect_to_redis()
    logger.info("Application startup complete")

    try:
        yield
    finally:
        await close_redis_connection()
        await close_mongodb_connection()
        logger.info("Application shutdown complete")


app = FastAPI(title="DevClash Backend", lifespan=lifespan)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
