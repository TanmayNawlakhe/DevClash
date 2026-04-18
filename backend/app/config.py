import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    mongodb_url: str = os.getenv("MONGODB_URL", "")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "repomap")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
