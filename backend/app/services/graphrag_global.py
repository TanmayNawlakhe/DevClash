"""GraphRAG global search — the "like Microsoft" layer, adapted to code.

Two stages:

  1. **Community summarization** (build-time, once): each Louvain community
     (a subsystem discovered from graph topology) is summarized by the LLM using
     its member files' summaries, ranked by PageRank. Reports are stored on
     ``:Community`` nodes in Neo4j.

  2. **Global search** (query-time): whole-repo / architectural questions that
     live across subsystems — "what are the main parts?", "how would I add X?" —
     are answered by MAP-REDUCE over the community reports rather than by
     retrieving individual files (which local search already handles).

No-op when Neo4j is unavailable.
"""
from __future__ import annotations

import asyncio
from typing import Any

from bson import ObjectId

from app.db.neo4j_client import is_available, run_read, run_write
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ── Stage 1: summarize communities ──────────────────────────────────────────────

async def _summarize_one(cid: Any, size: int, files: list[dict]) -> dict:
    from app.services.openrouter_ai import _call_ai_provider

    lines = [
        f"- {f['path']} [{f.get('layer') or '?'}]: {(f.get('summary') or '').strip()[:200]}"
        for f in files
    ]
    prompt = (
        f"A subsystem of a codebase was detected via graph clustering "
        f"({size} files). Its most important files (by PageRank):\n"
        + "\n".join(lines)
        + "\n\nReturn STRICT JSON only:\n"
        '{"name": "<short subsystem name, 2-4 words>", '
        '"summary": "<2-4 sentences: what this subsystem does, its '
        'responsibilities, and the key files>"}'
    )
    messages = [
        {"role": "system", "content": (
            "You are a software architect. Summarize one subsystem of a codebase "
            "from its files. Return strict JSON with keys 'name' and 'summary' only."
        )},
        {"role": "user", "content": prompt},
    ]
    try:
        parsed = await _call_ai_provider(messages=messages, max_tokens=400, task="file_summary")
        return {
            "name": (str(parsed.get("name", "")).strip() or f"Community {cid}"),
            "summary": str(parsed.get("summary", "")).strip(),
        }
    except Exception as exc:
        logger.warning("[graphrag] community %s summary failed: %s", cid, exc)
        return {"name": f"Community {cid}", "summary": ""}


async def summarize_communities(
    repo_id: Any, *, min_size: int = 2, max_communities: int = 12, top_files_per: int = 12,
) -> dict:
    """LLM-summarize each sizable community; store reports on :Community nodes."""
    if not is_available():
        return {"summarized": False, "reason": "neo4j unavailable"}

    rid = str(ObjectId(str(repo_id)))
    rows = await run_read(
        "MATCH (f:File {repo_id: $rid}) WHERE f.community IS NOT NULL "
        "RETURN f.community AS cid, count(*) AS size, "
        "       collect({path: f.path, summary: f.summary, "
        "                pagerank: coalesce(f.pagerank, 0.0), layer: f.layer})[..25] AS files "
        "ORDER BY size DESC",
        rid=rid,
    )

    reports: list[dict] = []
    for row in rows:
        if row["size"] < min_size or len(reports) >= max_communities:
            continue
        files = sorted(row["files"], key=lambda x: -(x.get("pagerank") or 0.0))[:top_files_per]
        report = await _summarize_one(row["cid"], row["size"], files)

        await run_write(
            "MERGE (c:Community {uid: $uid}) "
            "SET c.repo_id=$rid, c.cid=$cid, c.name=$name, c.summary=$summary, c.size=$size "
            "WITH c MATCH (f:File {repo_id: $rid, community: $cid}) "
            "MERGE (f)-[:IN_COMMUNITY]->(c)",
            uid=f"{rid}:{row['cid']}", rid=rid, cid=row["cid"],
            name=report["name"], summary=report["summary"], size=row["size"],
        )
        reports.append({"cid": row["cid"], "size": row["size"], **report})

    logger.info("[graphrag] summarized %d communities for repo %s", len(reports), rid)
    return {"summarized": True, "communities": len(reports), "reports": reports}


# ── Stage 2: global search (map-reduce over community reports) ───────────────────

async def _map_community(query: str, c: dict) -> dict:
    from app.services.openrouter_ai import _call_ai_provider

    prompt = (
        f"Question: {query}\n\n"
        f"Subsystem '{c['name']}': {c['summary']}\n\n"
        'Return STRICT JSON: {"relevant": true/false, "contribution": '
        '"<1-2 sentences on what this subsystem contributes to the answer, '
        'or empty string if not relevant>"}'
    )
    messages = [
        {"role": "system", "content": (
            "Decide whether a subsystem is relevant to a question about a "
            "codebase, and what it contributes. Strict JSON only."
        )},
        {"role": "user", "content": prompt},
    ]
    try:
        p = await _call_ai_provider(messages=messages, max_tokens=250, task="file_summary")
        return {
            "name": c["name"],
            "relevant": bool(p.get("relevant")),
            "contribution": str(p.get("contribution", "")).strip(),
        }
    except Exception:
        # On failure, keep the subsystem in play with its raw summary.
        return {"name": c["name"], "relevant": True, "contribution": c["summary"][:200]}


async def global_search(repo_id: Any, query: str, *, top_communities: int = 8) -> dict:
    """Answer a whole-repo question by map-reduce over community reports."""
    if not is_available():
        return {"mode": "global", "query": query,
                "answer": "Neo4j is not available for global search.", "subsystems": []}

    from app.services.openrouter_ai import _call_ai_provider

    rid = str(ObjectId(str(repo_id)))
    comms = await run_read(
        "MATCH (c:Community {repo_id: $rid}) "
        "WHERE c.summary IS NOT NULL AND c.summary <> '' "
        "RETURN c.cid AS cid, c.name AS name, c.summary AS summary, c.size AS size "
        "ORDER BY c.size DESC LIMIT $lim",
        rid=rid, lim=int(top_communities),
    )
    if not comms:
        return {"mode": "global", "query": query, "subsystems": [],
                "answer": "No subsystem summaries yet. Run community summarization first "
                          "(POST /communities/summarize)."}

    # MAP — each community, concurrently, decides its contribution.
    mapped = await asyncio.gather(*[_map_community(query, c) for c in comms])
    relevant = [m for m in mapped if m["relevant"] and m["contribution"]]
    if not relevant:
        relevant = [{"name": c["name"], "contribution": c["summary"]} for c in comms[:3]]

    # REDUCE — synthesize one answer from the relevant contributions.
    findings = "\n".join(f"- {m['name']}: {m['contribution']}" for m in relevant)
    prompt = (
        f"Question: {query}\n\n"
        f"Relevant subsystems and what each contributes:\n{findings}\n\n"
        "Write a clear 3-6 sentence answer that names the subsystems and explains "
        'how they relate. Return STRICT JSON: {"answer": "..."}'
    )
    messages = [
        {"role": "system", "content": (
            "Synthesize a whole-repository answer from subsystem findings. "
            "Strict JSON with key 'answer' only."
        )},
        {"role": "user", "content": prompt},
    ]
    try:
        p = await _call_ai_provider(messages=messages, max_tokens=800, task="flow_query")
        answer = str(p.get("answer", "")).strip() or "Could not synthesize an answer."
    except Exception as exc:
        logger.warning("[graphrag] global reduce failed: %s", exc)
        answer = "Could not synthesize a global answer."

    return {
        "mode": "global",
        "query": query,
        "answer": answer,
        "subsystems": [m["name"] for m in relevant],
        "communities": [
            {"name": c["name"], "summary": c["summary"], "size": c["size"]} for c in comms
        ],
    }
