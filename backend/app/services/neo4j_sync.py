"""Mirror a repo's graph from MongoDB into Neo4j (dual-write).

MongoDB stays the system of record (job status, summaries, React-Flow payload);
Neo4j is the graph + retrieval brain. This reads the already-built graph +
embeddings from Mongo and writes the property graph:

    (:File)-[:IMPORTS|CALLS]->(:File)
    (:File)-[:CONTAINS]->(:Function)-[:CALLS]->(:Function)

``File.embedding`` (CodeBERT, 768-dim) is stored for the native vector index.
Every write is idempotent (MERGE), and the repo's existing subgraph is cleared
first so re-analysis produces a clean graph. A no-op when Neo4j is unavailable.
"""
from __future__ import annotations

from typing import Any, Iterable

from bson import ObjectId

from app.db.mongodb import get_database
from app.db.neo4j_client import is_available, run_write
from app.utils.logger import get_logger

logger = get_logger(__name__)

_FILE_BATCH = 1000
_EDGE_BATCH = 2000


def _chunks(seq: list, size: int) -> Iterable[list]:
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _build_rows(rid: str, nodes: list[dict], edges: list[dict],
                call_graph: list[dict], emb_by_path: dict[str, list]) -> dict[str, list]:
    files, funcs, imports, calls, fncalls = [], [], [], [], []

    for node in nodes:
        path = str(node.get("id", ""))
        if not path:
            continue
        data = node.get("data", {}) or {}
        uid = f"{rid}:{path}"
        files.append({
            "uid": uid,
            "repo_id": rid,
            "path": path,
            "language": str(data.get("language", "") or ""),
            "layer": str(data.get("classification", data.get("layer", "")) or ""),
            "summary": str(data.get("summary", "") or ""),
            "isEntry": bool(data.get("isEntry", False)),
            "lineCount": int(data.get("lineCount", 0) or 0),
            "embedding": emb_by_path.get(path),  # list[float] | None
        })
        for fn in data.get("functions", []) or []:
            name = fn.get("name")
            if not name or name == "<anonymous>":
                continue
            funcs.append({
                "uid": f"{rid}:{path}:{name}",
                "repo_id": rid, "name": name, "file": path, "file_uid": uid,
            })

    for e in edges:
        src, tgt = str(e.get("source", "")), str(e.get("target", ""))
        if not src or not tgt:
            continue
        rec = {"a": f"{rid}:{src}", "b": f"{rid}:{tgt}"}
        (calls if (e.get("data", {}) or {}).get("kind") == "call" else imports).append(rec)

    for e in call_graph:
        caller, callee = e.get("caller"), e.get("callee")
        if not caller or not callee or caller == "<module>":
            continue
        fncalls.append({
            "a": f"{rid}:{e.get('caller_file')}:{caller}",
            "b": f"{rid}:{e.get('callee_file')}:{callee}",
        })

    return {"files": files, "funcs": funcs, "imports": imports,
            "calls": calls, "fncalls": fncalls}


async def sync_repo(repo_id: Any) -> dict:
    """Read repo graph + embeddings from Mongo, write the property graph to Neo4j."""
    if not is_available():
        return {"synced": False, "reason": "neo4j unavailable"}

    db = get_database()
    oid = ObjectId(str(repo_id))
    rid = str(oid)

    graph_doc = await db["graphs"].find_one(
        {"repo_id": oid}, projection={"nodes": 1, "edges": 1, "callGraph": 1}
    )
    if not graph_doc:
        return {"synced": False, "reason": "no graph document"}

    emb_doc = await db["embeddings"].find_one(
        {"repo_id": oid}, projection={"file_embeddings": 1}
    )
    # Index the MiniLM *summary* embedding (384-dim), not CodeBERT (768): file
    # cosines under CodeBERT are nearly uniform (~0.97) and make poor dense
    # seeds, whereas the summary embedding spreads widely and discriminates.
    emb_by_path: dict[str, list] = {}
    for fe in (emb_doc or {}).get("file_embeddings", []):
        vec = fe.get("summary_embedding")
        if vec:
            emb_by_path[fe.get("path")] = vec

    rows = _build_rows(
        rid,
        graph_doc.get("nodes", []),
        graph_doc.get("edges", []),
        graph_doc.get("callGraph", []),
        emb_by_path,
    )

    # Clear the repo's existing subgraph for a clean re-sync.
    await run_write("MATCH (n {repo_id: $rid}) DETACH DELETE n", rid=rid)

    for batch in _chunks(rows["files"], _FILE_BATCH):
        await run_write(
            "UNWIND $rows AS f "
            "MERGE (n:File {uid: f.uid}) "
            "SET n.repo_id=f.repo_id, n.path=f.path, n.language=f.language, "
            "    n.layer=f.layer, n.summary=f.summary, n.isEntry=f.isEntry, "
            "    n.lineCount=f.lineCount, n.embedding=f.embedding",
            rows=batch,
        )
    for batch in _chunks(rows["funcs"], _EDGE_BATCH):
        await run_write(
            "UNWIND $rows AS fn "
            "MERGE (n:Function {uid: fn.uid}) "
            "SET n.repo_id=fn.repo_id, n.name=fn.name, n.file=fn.file "
            "WITH n, fn MATCH (file:File {uid: fn.file_uid}) "
            "MERGE (file)-[:CONTAINS]->(n)",
            rows=batch,
        )
    for batch in _chunks(rows["imports"], _EDGE_BATCH):
        await run_write(
            "UNWIND $rows AS e MATCH (a:File {uid: e.a}), (b:File {uid: e.b}) "
            "MERGE (a)-[:IMPORTS]->(b)",
            rows=batch,
        )
    for batch in _chunks(rows["calls"], _EDGE_BATCH):
        await run_write(
            "UNWIND $rows AS e MATCH (a:File {uid: e.a}), (b:File {uid: e.b}) "
            "MERGE (a)-[:CALLS]->(b)",
            rows=batch,
        )
    for batch in _chunks(rows["fncalls"], _EDGE_BATCH):
        await run_write(
            "UNWIND $rows AS e MATCH (a:Function {uid: e.a}), (b:Function {uid: e.b}) "
            "MERGE (a)-[:CALLS]->(b)",
            rows=batch,
        )

    stats = {
        "synced": True, "repo_id": rid,
        "files": len(rows["files"]), "functions": len(rows["funcs"]),
        "imports": len(rows["imports"]), "calls": len(rows["calls"]),
        "function_calls": len(rows["fncalls"]),
        "files_with_embedding": sum(1 for f in rows["files"] if f["embedding"]),
    }
    logger.info("[neo4j] synced repo %s: %s", rid, stats)
    return stats
