"""Sync repo graph(s) from MongoDB into Neo4j, and verify what landed.

Usage (from backend/, with NEO4J_ENABLED=true):

    python -m scripts.neo4j_sync --list          # list analyzed repos
    python -m scripts.neo4j_sync <repo_id>       # sync one repo
    python -m scripts.neo4j_sync --all           # sync every complete repo

After syncing it prints Neo4j node/relationship counts and a couple of sample
graph queries so you can confirm the property graph is real.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.db.mongodb import close_mongodb_connection, connect_to_mongodb, get_database  # noqa: E402
from app.db import neo4j_client as n  # noqa: E402
from app.services.neo4j_sync import sync_repo  # noqa: E402
from app.services.neo4j_algorithms import (  # noqa: E402
    run_graph_algorithms,
    top_by_pagerank,
)


async def _verify(rid: str) -> None:
    counts = await n.run_read(
        "MATCH (f:File {repo_id:$rid}) WITH count(f) AS files "
        "MATCH (fn:Function {repo_id:$rid}) WITH files, count(fn) AS funcs "
        "OPTIONAL MATCH (:File {repo_id:$rid})-[i:IMPORTS]->(:File) "
        "WITH files, funcs, count(i) AS imports "
        "OPTIONAL MATCH (:File {repo_id:$rid})-[c:CALLS]->(:File) "
        "RETURN files, funcs, imports, count(c) AS file_calls",
        rid=rid,
    )
    if counts:
        c = counts[0]
        print(f"   Neo4j now holds: {c['files']} File, {c['funcs']} Function, "
              f"{c['imports']} IMPORTS, {c['file_calls']} file-level CALLS")

    sample = await n.run_read(
        "MATCH (a:File {repo_id:$rid})-[:IMPORTS]->(b:File) "
        "RETURN a.path AS src, b.path AS dst LIMIT 5",
        rid=rid,
    )
    if sample:
        print("   Sample IMPORTS edges:")
        for r in sample:
            print(f"     {r['src']}  →  {r['dst']}")

    with_emb = await n.run_read(
        "MATCH (f:File {repo_id:$rid}) WHERE f.embedding IS NOT NULL "
        "RETURN count(f) AS c",
        rid=rid,
    )
    if with_emb:
        print(f"   Files with embedding (vector-searchable): {with_emb[0]['c']}")


async def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 0
    if not settings.neo4j_enabled:
        print("NEO4J_ENABLED is false — enable it in backend/.env first.")
        return 1

    await connect_to_mongodb()
    await n.connect_to_neo4j()
    if not n.is_available():
        print("Neo4j not reachable — is the container up?")
        await close_mongodb_connection()
        return 1

    db = get_database()
    try:
        if args[0] == "--list":
            docs = await db["repos"].find(
                {"status": "complete"}, projection={"github_url": 1}
            ).to_list(length=100)
            if not docs:
                print("No completed repos found.")
            for d in docs:
                print(f"  {d['_id']}   {d.get('github_url', '')}")
            return 0

        if args[0] == "--all":
            docs = await db["repos"].find(
                {"status": "complete"}, projection={"_id": 1}
            ).to_list(length=1000)
            targets = [str(d["_id"]) for d in docs]
        else:
            targets = [args[0]]

        for rid in targets:
            print(f"\nSyncing repo {rid} …")
            stats = await sync_repo(rid)
            if not stats.get("synced"):
                print(f"   skipped: {stats.get('reason')}")
                continue
            print(f"   wrote: {stats['files']} files, {stats['functions']} functions, "
                  f"{stats['imports']} imports, {stats['calls']} calls, "
                  f"{stats['function_calls']} function-calls "
                  f"({stats['files_with_embedding']} embedded)")
            await _verify(rid)

            alg = await run_graph_algorithms(rid)
            if alg.get("ran"):
                print(f"   GDS: {alg.get('communities')} communities "
                      f"(modularity {alg.get('modularity')}), PageRank written")
                tops = await top_by_pagerank(rid, 5)
                if tops:
                    print("   Most important files (PageRank):")
                    for t in tops:
                        print(f"     {t['pagerank']:.3f}  {t['path']}")
            else:
                print(f"   GDS skipped: {alg.get('reason')}")
        return 0
    finally:
        await n.close_neo4j()
        await close_mongodb_connection()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
