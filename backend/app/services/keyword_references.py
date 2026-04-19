from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

from app.config import settings
from app.db.redis_client import get_redis
from app.utils.logger import get_logger

try:
    from tavily import TavilyClient  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - handled at runtime if dependency is missing
    TavilyClient = None  # type: ignore[assignment]


logger = get_logger(__name__, level=settings.log_level)

_tavily_client: Any | None = None


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_keyword(keyword: str) -> str:
    return " ".join(keyword.strip().lower().replace("-", " ").split())


def _cache_key(keyword_normalized: str) -> str:
    return f"{settings.tavily_cache_prefix}:{keyword_normalized}"


def _lock_key(keyword_normalized: str) -> str:
    return f"{settings.tavily_cache_prefix}:lock:{keyword_normalized}"


def _youtube_search_url(keyword: str) -> str:
    return f"https://www.youtube.com/results?search_query={quote_plus(keyword + ' youtube tutorial')}"


def _get_tavily_client() -> Any:
    global _tavily_client

    if TavilyClient is None:
        raise RuntimeError("tavily-python is not installed. Add it to requirements and reinstall dependencies.")

    if not settings.tavily_api_key:
        raise RuntimeError("TAVILY_API_KEY is missing. Set it in your environment.")

    if _tavily_client is None:
        _tavily_client = TavilyClient(api_key=settings.tavily_api_key)

    return _tavily_client


async def _tavily_first_url(query: str) -> str | None:
    client = _get_tavily_client()

    def _search() -> dict[str, Any]:
        return client.search(query)

    payload = await asyncio.to_thread(_search)
    results = payload.get("results", [])
    if not isinstance(results, list) or not results:
        return None

    first_item = results[0]
    if not isinstance(first_item, dict):
        return None

    url = first_item.get("url")
    if not url:
        return None

    return str(url).strip() or None


async def _fetch_keyword_reference_urls(keyword_original: str, keyword_normalized: str) -> dict[str, Any]:
    normal_reference_url = await _tavily_first_url(keyword_original)
    youtube_reference_url = await _tavily_first_url(f"{keyword_original} youtube tutorial")

    return {
        "keyword": keyword_original,
        "normalized_keyword": keyword_normalized,
        "normal_reference_url": normal_reference_url,
        "youtube_reference_url": youtube_reference_url,
        "youtube_search_url": _youtube_search_url(keyword_original),
        "fetched_at": _utcnow_iso(),
    }


async def get_or_fetch_keyword_reference_urls(keyword: str) -> dict[str, Any]:
    keyword_original = keyword.strip()
    keyword_normalized = _normalize_keyword(keyword_original)

    if not keyword_normalized:
        return {
            "keyword": keyword_original,
            "normal_reference_url": None,
            "youtube_reference_url": None,
            "youtube_search_url": _youtube_search_url(keyword_original),
            "cache_hit": False,
        }

    redis = get_redis()
    cache_key = _cache_key(keyword_normalized)
    lock_key = _lock_key(keyword_normalized)

    cached_payload = await redis.get(cache_key)
    if cached_payload:
        try:
            decoded = json.loads(cached_payload)
            decoded["cache_hit"] = True
            decoded["keyword"] = keyword_original
            return decoded
        except json.JSONDecodeError:
            logger.warning("[keyword-refs] Invalid cache JSON for %s. Refreshing entry.", keyword_normalized)

    lock_acquired = await redis.set(lock_key, "1", ex=settings.tavily_lock_ttl_seconds, nx=True)

    if lock_acquired:
        try:
            fresh = await _fetch_keyword_reference_urls(keyword_original, keyword_normalized)
            await redis.set(
                cache_key,
                json.dumps(fresh, ensure_ascii=True),
                ex=settings.tavily_cache_ttl_seconds,
            )
            fresh["cache_hit"] = False
            return fresh
        finally:
            await redis.delete(lock_key)

    wait_seconds = max(settings.tavily_lock_wait_ms, 0) / 1000.0
    deadline = asyncio.get_running_loop().time() + wait_seconds
    while asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(0.1)
        cached_payload = await redis.get(cache_key)
        if not cached_payload:
            continue
        try:
            decoded = json.loads(cached_payload)
            decoded["cache_hit"] = True
            decoded["keyword"] = keyword_original
            return decoded
        except json.JSONDecodeError:
            break

    # Fallback if lock-holder failed to populate cache in time.
    fresh = await _fetch_keyword_reference_urls(keyword_original, keyword_normalized)
    await redis.set(
        cache_key,
        json.dumps(fresh, ensure_ascii=True),
        ex=settings.tavily_cache_ttl_seconds,
    )
    fresh["cache_hit"] = False
    return fresh
