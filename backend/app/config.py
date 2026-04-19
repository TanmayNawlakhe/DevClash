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

    # LLM provider selection: "groq" or "openrouter"
    llm_provider: str = os.getenv("LLM_PROVIDER", "groq")

    # Groq settings
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_api_url: str = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
    groq_timeout_seconds: int = int(os.getenv("GROQ_TIMEOUT_SECONDS", "60"))
    # Model for high-quality summaries/flow diagrams
    groq_model_summaries: str = os.getenv("GROQ_MODEL_SUMMARIES", "llama-3.3-70b-versatile")
    # Fast model for bulk per-file summaries
    groq_model_file_reasons: str = os.getenv("GROQ_MODEL_FILE_REASONS", "llama-3.1-8b-instant")

    # OpenRouter settings (fallback)
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_api_url: str = os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    openrouter_timeout_seconds: int = int(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "60"))
    openrouter_site_url: str = os.getenv("OPENROUTER_SITE_URL", "")
    openrouter_app_name: str = os.getenv("OPENROUTER_APP_NAME", "DevClash")

    # Tavily keyword-reference settings
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")
    tavily_cache_prefix: str = os.getenv("TAVILY_CACHE_PREFIX", "kwref:v1")
    tavily_cache_ttl_seconds: int = int(os.getenv("TAVILY_CACHE_TTL_SECONDS", "1209600"))
    tavily_lock_ttl_seconds: int = int(os.getenv("TAVILY_LOCK_TTL_SECONDS", "15"))
    tavily_lock_wait_ms: int = int(os.getenv("TAVILY_LOCK_WAIT_MS", "2000"))


settings = Settings()
