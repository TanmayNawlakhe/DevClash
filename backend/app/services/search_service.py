"""Semantic search + LLM query answering over pre-computed embeddings.

Pipeline:
    1. Embed query at 768-dim (CodeBERT) + 384-dim (MiniLM).
    2. Cosine-score every file in the repo against both embeddings.
    3. Boost file score if any of its functions also matched.
    4. Take top-N files, topologically sort by dependency edges
       (entry points first — gives a natural reading / flow order).
    5. Send ranked files + dependency context to the LLM.
    6. LLM returns: plain-English answer + Mermaid flowchart.
    7. Validate Mermaid; fall back to deterministic diagram on failure.

Guard: steps 1-7 only run if embeddings are in status="complete".
"""
from __future__ import annotations

import asyncio
import math
import re
from pathlib import Path
from typing import Any

from bson import ObjectId

from app.db.mongodb import get_database
from app.utils.logger import get_logger

logger = get_logger(__name__)

_W_CODEBERT   = 0.55
_W_SUMMARY    = 0.45
_FN_BOOST_CAP = 0.90


# ── Cosine similarity ──────────────────────────────────────────────────────────

def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    denom = mag_a * mag_b
    return dot / denom if denom else 0.0


# ── Query embedding ────────────────────────────────────────────────────────────

def _embed_768_sync(text: str) -> list[float]:
    from app.services.embedding_service import _embed_text_codebert, _load_codebert
    _load_codebert()
    return _embed_text_codebert(text)


def _embed_384_sync(text: str) -> list[float]:
    from app.services.embedding_service import _embed_text_minilm, _load_minilm
    _load_minilm()
    return _embed_text_minilm(text)


async def _embed_query(query: str) -> tuple[list[float], list[float]]:
    """Return (codebert_768, minilm_384) for the query.

    Sequential on first call to avoid huggingface_hub circular-import race
    condition when both models initialise in parallel threads.
    Parallel on subsequent calls once both are in the module-level cache.
    """
    from app.services.embedding_service import _codebert_model, _minilm_model

    if _codebert_model is not None and _minilm_model is not None:
        q768, q384 = await asyncio.gather(
            asyncio.to_thread(_embed_768_sync, query),
            asyncio.to_thread(_embed_384_sync, query),
        )
    else:
        q768 = await asyncio.to_thread(_embed_768_sync, query)
        q384 = await asyncio.to_thread(_embed_384_sync, query)

    return q768, q384


# ── Scoring ────────────────────────────────────────────────────────────────────

def _score_files_sync(
    file_embeddings: list[dict],
    node_meta: dict[str, dict],
    q768: list[float],
    q384: list[float],
    top_files: int,
    top_functions: int,
    min_score: float,
) -> list[dict]:
    results: list[dict] = []

    for fe in file_embeddings:
        path = fe.get("path", "")
        if not path:
            continue

        cb_emb  = fe.get("codebert_embedding", [])
        sum_emb = fe.get("summary_embedding", [])
        fn_embs = fe.get("function_embeddings", [])

        score_cb  = _cosine(q768, cb_emb)  if cb_emb  else 0.0
        score_sum = _cosine(q384, sum_emb) if sum_emb else 0.0

        fn_scored: list[dict] = []
        for fn in fn_embs:
            fn_score = _cosine(q384, fn.get("embedding", []))
            if fn_score >= min_score:
                fn_scored.append({"name": fn["name"], "score": round(fn_score, 4)})
        fn_scored.sort(key=lambda x: -x["score"])

        top_fn_score = fn_scored[0]["score"] if fn_scored else 0.0

        composite = _W_CODEBERT * score_cb + _W_SUMMARY * score_sum
        if top_fn_score:
            composite = max(composite, min(top_fn_score, _FN_BOOST_CAP))

        if composite < min_score and not fn_scored:
            continue

        meta = node_meta.get(path, {})
        results.append({
            "path":              path,
            "score":             round(composite, 4),
            "score_codebert":    round(score_cb, 4),
            "score_summary":     round(score_sum, 4),
            "score_function":    round(top_fn_score, 4),
            "layer":             meta.get("layer", "unknown"),
            "language":          str(meta.get("language", "")),
            "is_entry":          bool(meta.get("isEntry", False)),
            "summary":           str(meta.get("summary", "")),
            "matched_functions": fn_scored[:top_functions],
        })

    results.sort(key=lambda x: -x["score"])
    return results[:top_files]


# ── Topological sort ───────────────────────────────────────────────────────────

def _topo_sort(paths: list[str], edges: list[dict[str, Any]]) -> list[str]:
    path_set = set(paths)
    in_degree: dict[str, int] = {p: 0 for p in paths}
    adj: dict[str, list[str]] = {p: [] for p in paths}

    for edge in edges:
        src = str(edge.get("source", ""))
        tgt = str(edge.get("target", ""))
        if src in path_set and tgt in path_set and src != tgt:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    queue = [p for p in paths if in_degree[p] == 0]
    ordered: list[str] = []

    while queue:
        node = queue.pop(0)
        ordered.append(node)
        for neighbor in adj[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    seen = set(ordered)
    ordered.extend(p for p in paths if p not in seen)
    return ordered


# ── Mermaid helpers ────────────────────────────────────────────────────────────

def _safe_id(path: str) -> str:
    """Stable alphanumeric Mermaid node ID from a file path."""
    name = path.split("/")[-1]
    return re.sub(r"[^\w]", "_", name) or "node"


def _fallback_mermaid(flow: list[dict], edges: list[dict]) -> str:
    """Deterministic Mermaid diagram — used when LLM output is invalid."""
    if not flow:
        return 'flowchart TD\n    A["No files matched"]'

    matched = {e["file_path"] for e in flow}
    node_ids: dict[str, str] = {}
    lines = ["flowchart TD"]

    for entry in flow:
        path = entry["file_path"]
        nid  = _safe_id(path)
        # Make IDs unique when two files share the same name
        if nid in node_ids.values():
            nid = f"{nid}_{entry['rank']}"
        node_ids[path] = nid
        label = path.split("/")[-1]
        lines.append(f'    {nid}["{label}"]')
        if entry.get("is_entry"):
            lines.append(f"    style {nid} fill:#6366f1,color:#fff,stroke:#4f46e5")

    for edge in edges:
        src = str(edge.get("source", ""))
        tgt = str(edge.get("target", ""))
        if src in matched and tgt in matched:
            lines.append(f"    {node_ids[src]} --> {node_ids[tgt]}")

    return "\n".join(lines)


def _validate_mermaid(source: str) -> str | None:
    """Return an error description if the diagram looks invalid, else None."""
    stripped = source.strip()
    if not stripped.startswith("flowchart"):
        return "does not start with 'flowchart'"
    if len(stripped) < 25:
        return "too short — likely empty body"
    if "[]" in stripped:
        return "contains empty node labels"
    return None


# ── File content reader ───────────────────────────────────────────────────────

def _read_file_excerpt(
    clone_root: str,
    rel_path: str,
    matched_fn_names: list[str],
    max_chars: int = 2500,
) -> str:
    """Read actual source from disk, preferring matched function regions."""
    try:
        full_path = Path(clone_root) / rel_path
        if not full_path.is_file():
            return "(file not found on disk)"
        source = full_path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return f"(could not read file: {exc})"

    if not matched_fn_names:
        excerpt = source[:max_chars]
        return excerpt + "\n... (truncated)" if len(source) > max_chars else excerpt

    # Extract regions around each matched function name via simple regex
    fn_pattern = "|".join(re.escape(n) for n in matched_fn_names)
    lines = source.splitlines(keepends=True)
    captured: list[str] = []
    total = 0

    i = 0
    while i < len(lines) and total < max_chars:
        line = lines[i]
        if re.search(fn_pattern, line):
            # Collect the function block: take up to 60 lines or until unindented
            block_lines: list[str] = []
            indent = len(line) - len(line.lstrip())
            for j in range(i, min(i + 80, len(lines))):
                l = lines[j]
                stripped = l.lstrip()
                if j > i and stripped and (len(l) - len(stripped)) <= indent and not stripped.startswith(("#", "@")):
                    break
                block_lines.append(l)
            block = "".join(block_lines)
            if block not in captured:
                captured.append(block)
                total += len(block)
        i += 1

    if not captured:
        excerpt = source[:max_chars]
        return excerpt + "\n... (truncated)" if len(source) > max_chars else excerpt

    result = "\n".join(captured)
    if total > max_chars:
        result = result[:max_chars] + "\n... (truncated)"
    return result


# ── LLM prompt builder ────────────────────────────────────────────────────────

def _build_llm_prompt(
    query: str,
    flow: list[dict],
    edges: list[dict],
    clone_path: str | None = None,
) -> str:
    matched_paths = {e["file_path"] for e in flow}

    file_blocks: list[str] = []
    for entry in flow:
        path = entry["file_path"]
        fns  = entry.get("matched_functions", [])
        fn_names = [f["name"] for f in fns[:5]]
        fn_str = ", ".join(fn_names) if fn_names else "—"

        imports_in_result = [
            e["target"].split("/")[-1]
            for e in edges
            if str(e.get("source")) == path and str(e.get("target")) in matched_paths
        ]
        used_by_in_result = [
            e["source"].split("/")[-1]
            for e in edges
            if str(e.get("target")) == path and str(e.get("source")) in matched_paths
        ]

        if clone_path:
            code = _read_file_excerpt(clone_path, path, fn_names)
        else:
            code = "(source unavailable — clone path not set)"

        file_blocks.append(
            f"[{entry['rank']}] {path}\n"
            f"    Layer      : {entry['layer']} | Lang: {entry['language']} | Entry: {entry['is_entry']}\n"
            f"    Summary    : {entry['summary'] or 'unavailable'}\n"
            f"    Functions  : {fn_str}\n"
            f"    Imports    : {', '.join(imports_in_result) or 'none within results'}\n"
            f"    Used by    : {', '.join(used_by_in_result) or 'none within results'}\n"
            f"    CODE:\n"
            + "\n".join(f"        {line}" for line in code.splitlines())
        )

    node_ids_map = {e["file_path"]: _safe_id(e["file_path"]) for e in flow}
    allowed_ids  = list(node_ids_map.values())
    entry_ids    = [node_ids_map[e["file_path"]] for e in flow if e.get("is_entry")]

    edge_lines: list[str] = []
    for edge in edges:
        src = str(edge.get("source", ""))
        tgt = str(edge.get("target", ""))
        if src in matched_paths and tgt in matched_paths:
            edge_lines.append(f"    {node_ids_map[src]} --> {node_ids_map[tgt]}")

    return f"""User query: "{query}"

Relevant files (ranked by dependency order — entry points first):
{chr(10).join(file_blocks)}

TASK
────
1. Answer the user query in 3-5 sentences using ONLY the information above.
   Name specific files and functions. Explain how they connect.

2. Generate a Mermaid flowchart showing the dependency flow.
   Strict rules:
   - First line must be exactly: flowchart TD
   - ONLY use these node IDs (no others): {allowed_ids}
   - Node labels use the filename only (e.g. middleware["middleware.py"])
   - Draw ONLY these edges (extracted from actual imports):
{chr(10).join(edge_lines) if edge_lines else "     (no edges between matched files)"}
   - Style entry-point nodes with: style <id> fill:#6366f1,color:#fff
     Entry node IDs: {entry_ids if entry_ids else "none"}
   - Do NOT invent any nodes or edges not listed above

Return ONLY this JSON (no markdown fences, no text outside the braces):
{{
  "answer": "<3-5 sentence explanation>",
  "mermaid": "<complete mermaid diagram starting with flowchart TD>"
}}"""


# ── LLM call ──────────────────────────────────────────────────────────────────

async def _generate_answer_and_diagram(
    query: str,
    flow: list[dict],
    edges: list[dict],
    clone_path: str | None = None,
) -> tuple[str, str]:
    """Return (answer, mermaid). Falls back gracefully on any LLM error."""
    from app.services.openrouter_ai import OpenRouterError, _call_ai_provider

    fallback_answer = (
        f"Found {len(flow)} files related to '{query}'. "
        "See the flow diagram for their dependency structure."
    )

    if not flow:
        return "No relevant files were found for this query.", _fallback_mermaid([], [])

    prompt = _build_llm_prompt(query, flow, edges, clone_path)
    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior software architect. "
                "Answer questions about code flow using only the provided file information. "
                "Return strict JSON with keys 'answer' and 'mermaid' only. "
                "The mermaid value must be a complete Mermaid flowchart starting with 'flowchart TD'. "
                "No markdown fences. No prose outside the JSON object."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        parsed = await _call_ai_provider(
            messages=messages,
            max_tokens=2400,
            task="flow_query",  # routes to groq_model_summaries (llama-3.3-70b)
        )

        answer  = str(parsed.get("answer", "")).strip() or fallback_answer
        mermaid = str(parsed.get("mermaid", "")).strip()

        err = _validate_mermaid(mermaid)
        if err:
            logger.warning("[search/llm] Mermaid invalid (%s) — using fallback diagram", err)
            mermaid = _fallback_mermaid(flow, edges)

        return answer, mermaid

    except (OpenRouterError, Exception) as exc:
        logger.warning("[search/llm] LLM call failed: %s — returning fallback", exc)
        return fallback_answer, _fallback_mermaid(flow, edges)


# ── Public API ─────────────────────────────────────────────────────────────────

async def semantic_search(
    repo_id: str,
    query: str,
    top_files: int = 8,
    top_functions: int = 5,
    min_score: float = 0.30,
) -> dict[str, Any]:
    """Full pipeline: embed → score → rank → LLM answer → Mermaid diagram.

    Raises ValueError if embeddings are not in status='complete'.
    """
    db  = get_database()
    oid = ObjectId(repo_id)

    # ── Guard: embeddings must be ready ───────────────────────────────────────
    emb_doc = await db["embeddings"].find_one({"repo_id": oid})
    if not emb_doc:
        raise ValueError("Embeddings not found — run the embedding job first")
    if emb_doc.get("status") != "complete":
        raise ValueError(
            f"Embeddings not ready (status: {emb_doc.get('status', 'unknown')}). "
            "Wait for the embedding job to finish before querying."
        )

    # ── Load graph (metadata + edges for flow ordering) ───────────────────────
    graph_doc = await db["graphs"].find_one(
        {"repo_id": oid},
        projection={"edges": 1, "nodes": 1, "clone_path": 1},
    )
    edges: list[dict] = graph_doc.get("edges", []) if graph_doc else []
    nodes: list[dict] = graph_doc.get("nodes", []) if graph_doc else []
    clone_path: str | None = graph_doc.get("clone_path") if graph_doc else None

    node_meta: dict[str, dict] = {
        str(n.get("id", "")): n.get("data", {})
        for n in nodes
        if n.get("id")
    }

    file_embeddings: list[dict] = emb_doc.get("file_embeddings", [])
    if not file_embeddings:
        return {
            "query": query, "repo_id": repo_id,
            "total_matched": 0, "flow": [],
            "answer": "No embeddings found for this repository.",
            "mermaid": _fallback_mermaid([], []),
        }

    logger.info("[search] repo=%s query=%r scoring %d files", repo_id, query, len(file_embeddings))

    # ── Embed query + score all files ─────────────────────────────────────────
    q768, q384 = await _embed_query(query)

    scored = await asyncio.to_thread(
        _score_files_sync,
        file_embeddings, node_meta, q768, q384,
        top_files, top_functions, min_score,
    )

    if not scored:
        logger.info("[search] No results above min_score=%.2f", min_score)
        no_match_answer = f"No files matched your query '{query}' above the relevance threshold."
        return {
            "query": query, "repo_id": repo_id,
            "total_matched": 0, "flow": [],
            "answer": no_match_answer,
            "mermaid": _fallback_mermaid([], []),
        }

    # ── Topological sort → flow order ─────────────────────────────────────────
    ordered_paths = _topo_sort([r["path"] for r in scored], edges)
    path_to_result = {r["path"]: r for r in scored}

    flow: list[dict] = []
    for rank, path in enumerate(ordered_paths, start=1):
        r = path_to_result.get(path)
        if not r:
            continue
        flow.append({
            "rank":            rank,
            "file_path":       r["path"],
            "relevance_score": r["score"],
            "score_breakdown": {
                "codebert":       r["score_codebert"],
                "summary":        r["score_summary"],
                "function_boost": r["score_function"],
            },
            "layer":    r["layer"],
            "language": r["language"],
            "is_entry": r["is_entry"],
            "summary":  r["summary"],
            "matched_functions": r["matched_functions"],
        })

    logger.info("[search] %d files matched — calling LLM for answer + diagram", len(flow))

    # ── LLM: generate answer + Mermaid ────────────────────────────────────────
    answer, mermaid = await _generate_answer_and_diagram(query, flow, edges, clone_path)

    logger.info("[search] Done for query %r", query)
    return {
        "query":         query,
        "repo_id":       repo_id,
        "total_matched": len(flow),
        "flow":          flow,
        "answer":        answer,
        "mermaid":       mermaid,
    }
