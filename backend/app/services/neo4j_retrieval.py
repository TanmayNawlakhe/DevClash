"""Graph-RAG retrieval executed *inside* Neo4j (the headline differentiator).

A single Cypher query does what the in-memory path did in Python:

    1. Seed with the native vector index (``db.index.vector.queryNodes``) —
       dense top-K files by MiniLM summary-embedding cosine. The query vector
       must be the MiniLM (384-dim) embedding of the query text.
    2. Spread from each seed along IMPORTS/CALLS up to ``max_hops`` hops,
       accumulating a decayed graph boost (personalized-PageRank-style).
    3. Score every candidate with its *own* cosine (``vector.similarity.cosine``)
       plus ``alpha * graph_boost`` and rank.

So dense retrieval + graph expansion + scoring all run in the database. Returns
[] when Neo4j is unavailable so callers can fall back to the in-memory path.
"""
from __future__ import annotations

from typing import Any

from bson import ObjectId

from app.db.neo4j_client import is_available, run_read
from app.services.graph_rag import (
    DEFAULT_ALPHA,
    DEFAULT_DECAY,
    DEFAULT_MAX_HOPS,
    DEFAULT_SEED_COUNT,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _hybrid_cypher(max_hops: int) -> str:
    # Variable-length bounds cannot be parameters, so the (validated int)
    # max_hops is inlined; everything else is passed as a parameter.
    hops = max(1, int(max_hops))
    return f"""
    CALL db.index.vector.queryNodes('file_embedding', $seedK, $qvec)
        YIELD node AS seed, score AS seedCos
    WITH seed, seedCos WHERE seed.repo_id = $rid
    // Total seed relevance — used to normalise the graph boost onto cosine's
    // [0,1] scale so cosine leads and the graph re-ranks (rather than dominates).
    WITH collect({{s: seed, c: seedCos}}) AS seeds, sum(seedCos) AS seedMass
    UNWIND seeds AS sd
    WITH sd.s AS seed, sd.c AS seedCos, seedMass
    MATCH pth = (seed)-[:IMPORTS|CALLS*0..{hops}]-(cand:File)
        WHERE cand.repo_id = $rid
    WITH cand, seedMass, seed, seedCos, min(length(pth)) AS hops
    WITH cand, seedMass, sum(CASE WHEN hops = 0 THEN 0.0
                                  ELSE seedCos * ($decay ^ hops) END) AS boostRaw
    WITH cand, CASE WHEN seedMass > 0 THEN boostRaw / seedMass ELSE 0.0 END AS graphBoost
    WITH cand, graphBoost,
         CASE WHEN cand.embedding IS NULL THEN 0.0
              ELSE vector.similarity.cosine(cand.embedding, $qvec) END AS cosine
    RETURN cand.path              AS file_path,
           cand.summary           AS summary,
           cand.layer             AS layer,
           cand.language          AS language,
           coalesce(cand.isEntry, false) AS is_entry,
           round(cosine, 4)       AS cosine_score,
           round(graphBoost, 4)   AS graph_boost,
           round(cosine + $alpha * graphBoost, 4) AS relevance_score
    ORDER BY relevance_score DESC
    LIMIT $topN
    """


async def retrieve(
    repo_id: Any,
    query_vector: list[float],
    *,
    top_files: int = 8,
    seed_k: int = DEFAULT_SEED_COUNT,
    max_hops: int = DEFAULT_MAX_HOPS,
    decay: float = DEFAULT_DECAY,
    alpha: float = DEFAULT_ALPHA,
) -> list[dict]:
    """Return ranked files (best-first) for a query embedding, via Cypher.

    Each row: file_path, summary, layer, language, is_entry, cosine_score,
    graph_boost, relevance_score. ``retrieved_via`` is derived so callers can
    show provenance consistent with the in-memory path.
    """
    if not is_available() or not query_vector:
        return []

    rid = str(ObjectId(str(repo_id)))
    rows = await run_read(
        _hybrid_cypher(max_hops),
        rid=rid,
        qvec=[float(x) for x in query_vector],
        seedK=int(seed_k),
        topN=int(top_files),
        decay=float(decay),
        alpha=float(alpha),
    )
    for r in rows:
        # A file the graph surfaced (little/no direct vector match) vs a seed.
        r["retrieved_via"] = "graph" if (r.get("graph_boost", 0) or 0) > 0 and (
            r.get("cosine_score", 0) or 0) < 0.30 else "vector"
    logger.info("[neo4j] hybrid retrieval: repo=%s -> %d files", rid, len(rows))
    return rows
