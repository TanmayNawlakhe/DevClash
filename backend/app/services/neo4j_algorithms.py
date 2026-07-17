"""Graph Data Science over the repo graph: communities + importance.

Runs inside Neo4j via the GDS plugin:

    * **Louvain** community detection → ``File.community`` (subsystems discovered
      from graph topology; feeds GraphRAG global search).
    * **PageRank** → ``File.pagerank`` (structural importance; "read these first").

Both operate on an in-memory GDS projection of *this repo's* File nodes and
their IMPORTS/CALLS relationships (projected undirected). The projection is
dropped afterwards. No-op when Neo4j/GDS is unavailable.
"""
from __future__ import annotations

from typing import Any

from bson import ObjectId

from app.db.neo4j_client import is_available, run_read, run_write
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def run_graph_algorithms(repo_id: Any) -> dict:
    """Project → Louvain + PageRank (write back) → drop. Returns a summary."""
    if not is_available():
        return {"ran": False, "reason": "neo4j unavailable"}

    rid = str(ObjectId(str(repo_id)))
    graph = f"gitsuri_{rid}"

    # Drop any stale projection from a prior run (failFast=false → ok if absent).
    await run_write("CALL gds.graph.drop($g, false) YIELD graphName", g=graph)

    # Cypher projection scoped to this repo; the undirected `-[:...]-` match
    # yields both directions, so Louvain/PageRank see an undirected graph.
    try:
        proj = await run_write(
            "CALL gds.graph.project.cypher($g, "
            "  'MATCH (f:File {repo_id: $rid}) RETURN id(f) AS id', "
            "  'MATCH (a:File {repo_id: $rid})-[:IMPORTS|CALLS]-(b:File {repo_id: $rid}) "
            "   RETURN id(a) AS source, id(b) AS target', "
            "  {parameters: {rid: $rid}}) "
            "YIELD graphName, nodeCount, relationshipCount",
            g=graph, rid=rid,
        )
    except Exception as exc:
        logger.warning("[gds] projection failed for %s: %s", rid, exc)
        return {"ran": False, "reason": f"projection failed: {exc}"}

    node_count = proj[0]["nodeCount"] if proj else 0
    rel_count = proj[0]["relationshipCount"] if proj else 0

    result: dict = {"ran": True, "repo_id": rid, "nodes": node_count, "relationships": rel_count}
    try:
        louvain = await run_write(
            "CALL gds.louvain.write($g, {writeProperty: 'community'}) "
            "YIELD communityCount, modularity",
            g=graph,
        )
        if louvain:
            result["communities"] = louvain[0]["communityCount"]
            result["modularity"] = round(louvain[0]["modularity"], 4)

        await run_write(
            "CALL gds.pageRank.write($g, {writeProperty: 'pagerank'}) YIELD ranIterations",
            g=graph,
        )
        result["pagerank"] = "written"
    except Exception as exc:
        logger.warning("[gds] algorithm failed for %s: %s", rid, exc)
        result["ran"] = False
        result["reason"] = str(exc)
    finally:
        await run_write("CALL gds.graph.drop($g, false) YIELD graphName", g=graph)

    logger.info("[gds] repo %s: %s", rid, result)
    return result


async def top_by_pagerank(repo_id: Any, limit: int = 10) -> list[dict]:
    """Most structurally important files (highest PageRank)."""
    if not is_available():
        return []
    rid = str(ObjectId(str(repo_id)))
    return await run_read(
        "MATCH (f:File {repo_id: $rid}) WHERE f.pagerank IS NOT NULL "
        "RETURN f.path AS path, round(f.pagerank, 4) AS pagerank, "
        "       f.community AS community "
        "ORDER BY f.pagerank DESC LIMIT $limit",
        rid=rid, limit=int(limit),
    )


async def communities(repo_id: Any) -> list[dict]:
    """Community id → member files, largest first (subsystems)."""
    if not is_available():
        return []
    rid = str(ObjectId(str(repo_id)))
    return await run_read(
        "MATCH (f:File {repo_id: $rid}) WHERE f.community IS NOT NULL "
        "RETURN f.community AS community, count(*) AS size, "
        "       collect(f.path)[..12] AS files "
        "ORDER BY size DESC",
        rid=rid,
    )
