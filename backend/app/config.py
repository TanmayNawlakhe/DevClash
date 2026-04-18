import os
from dotenv import load_dotenv

load_dotenv()


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw_value = os.getenv(name, default)
    return [item.strip() for item in raw_value.split(",") if item.strip()]


class Settings:
    mongodb_url: str = os.getenv("MONGODB_URL", "")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "repomap")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    repo_clone_base_dir: str = os.getenv("REPO_CLONE_BASE_DIR", ".repo_cache")
    clone_timeout_seconds: int = int(os.getenv("CLONE_TIMEOUT_SECONDS", "120"))
    analysis_queue_key: str = os.getenv("ANALYSIS_QUEUE_KEY", "analysis_jobs")
    frontend_origins: list[str] = _parse_csv_env(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    )


settings = Settings()
