"""Neo4j graph store — the property-graph + retrieval brain for GitSuri.

Model:
    (:File {uid, repo_id, path, language, layer, summary, embedding,
            pagerank, community})
    (:Function {uid, repo_id, name, file})
    (:Community {uid, repo_id, cid, summary})

    (:File)-[:IMPORTS]->(:File)          # module dependency
    (:File)-[:CALLS]->(:File)            # projected call edge
    (:File)-[:CONTAINS]->(:Function)     # file owns function
    (:Function)-[:CALLS]->(:Function)    # call graph (function level)
    (:File)-[:IN_COMMUNITY]->(:Community)

Design notes:
    * Feature-flagged via ``settings.neo4j_enabled``. Neo4j is the graph +
      retrieval brain; MongoDB stays the system of record for job status,
      summaries, and the frontend's React-Flow payload (dual-write).
    * When Neo4j is disabled OR unreachable, every helper degrades to a no-op
      (returns ``None`` / ``[]``) so the existing in-memory path keeps working.
    * ``File.embedding`` (MiniLM *summary* embedding, 384-dim) is indexed with a
      native vector index so dense seeds + graph expansion run in one Cypher
      query. (CodeBERT file cosines are nearly uniform ~0.97 → poor seeds; the
      summary embedding spreads widely and discriminates well.)
"""
from __future__ import annotations

from typing import Any, Optional

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)

_driver: Optional[Any] = None


# ── Schema (constraints + native vector index) ──────────────────────────────────

_CONSTRAINTS = [
    "CREATE CONSTRAINT file_uid IF NOT EXISTS FOR (f:File) REQUIRE f.uid IS UNIQUE",
    "CREATE CONSTRAINT function_uid IF NOT EXISTS FOR (fn:Function) REQUIRE fn.uid IS UNIQUE",
    "CREATE CONSTRAINT community_uid IF NOT EXISTS FOR (c:Community) REQUIRE c.uid IS UNIQUE",
]


def _vector_index_cypher() -> str:
    # Dimension must be inlined — Neo4j does not accept parameters in index DDL.
    return (
        "CREATE VECTOR INDEX file_embedding IF NOT EXISTS "
        "FOR (f:File) ON (f.embedding) "
        "OPTIONS {indexConfig: {"
        f"`vector.dimensions`: {int(settings.neo4j_vector_dim)}, "
        "`vector.similarity_function`: 'cosine'}}"
    )


async def _existing_vector_dim() -> int | None:
    """Dimension of the current file_embedding vector index, or None."""
    try:
        rows = await run_read(
            "SHOW INDEXES YIELD name, options "
            "WHERE name = 'file_embedding' RETURN options AS opt"
        )
    except Exception:
        return None
    if not rows:
        return None
    cfg = (rows[0].get("opt") or {}).get("indexConfig") or {}
    dim = cfg.get("vector.dimensions")
    return int(dim) if dim is not None else None


async def ensure_schema() -> None:
    """Create uniqueness constraints and the file-embedding vector index.

    Constraints are idempotent. The vector index is *self-healing*: if one
    already exists with a different dimension (e.g. after switching from the
    768-dim CodeBERT to the 384-dim summary embedding), it is dropped and
    recreated at the configured dimension.
    """
    if _driver is None:
        return
    for stmt in _CONSTRAINTS:
        try:
            await run_write(stmt)
        except Exception as exc:  # pragma: no cover - server-dependent
            logger.warning("[neo4j] constraint failed (%s): %s", stmt.split()[2], exc)

    want_dim = int(settings.neo4j_vector_dim)
    try:
        current = await _existing_vector_dim()
        if current is not None and current != want_dim:
            logger.info(
                "[neo4j] vector index dim %s != %s — recreating", current, want_dim
            )
            await run_write("DROP INDEX file_embedding IF EXISTS")
        await run_write(_vector_index_cypher())
        logger.info("[neo4j] schema ready (constraints + %d-dim vector index)", want_dim)
    except Exception as exc:  # pragma: no cover - server-dependent
        logger.warning(
            "[neo4j] vector index unavailable (needs Neo4j >= 5.11): %s", exc
        )


# ── Connection lifecycle ────────────────────────────────────────────────────────

async def connect_to_neo4j() -> Optional[Any]:
    """Connect if enabled and reachable; otherwise return None (non-fatal)."""
    global _driver

    if not settings.neo4j_enabled:
        logger.info("[neo4j] disabled (set NEO4J_ENABLED=true to enable)")
        return None
    if _driver is not None:
        return _driver

    try:
        from neo4j import AsyncGraphDatabase
    except ImportError:
        logger.warning("[neo4j] driver not installed — `pip install neo4j`")
        return None

    try:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        await _driver.verify_connectivity()
        logger.info("[neo4j] connected at %s", settings.neo4j_uri)
        await ensure_schema()
    except Exception as exc:
        logger.warning("[neo4j] connection failed (%s) — continuing without it", exc)
        if _driver is not None:
            try:
                await _driver.close()
            except Exception:
                pass
        _driver = None

    return _driver


def get_neo4j() -> Optional[Any]:
    """Return the driver, or None when Neo4j is disabled/unavailable."""
    return _driver


def is_available() -> bool:
    return _driver is not None


async def close_neo4j() -> None:
    global _driver
    if _driver is not None:
        await _driver.close()
        logger.info("[neo4j] connection closed")
    _driver = None


# ── Query helpers ───────────────────────────────────────────────────────────────

async def _tx_collect(tx: Any, cypher: str, params: dict) -> list[dict]:
    result = await tx.run(cypher, **params)
    return [record.data() async for record in result]


async def run_read(cypher: str, **params: Any) -> list[dict]:
    """Run a read query; returns [] if Neo4j is unavailable."""
    if _driver is None:
        return []
    async with _driver.session(database=settings.neo4j_database) as session:
        return await session.execute_read(_tx_collect, cypher, params)


async def run_write(cypher: str, **params: Any) -> list[dict]:
    """Run a write query; returns [] if Neo4j is unavailable."""
    if _driver is None:
        return []
    async with _driver.session(database=settings.neo4j_database) as session:
        return await session.execute_write(_tx_collect, cypher, params)
