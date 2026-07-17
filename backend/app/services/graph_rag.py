"""Graph-RAG retrieval: expand dense-vector seeds along the dependency graph.

Plain vector search retrieves files whose *text* matches the query. For a
codebase that misses structurally-relevant files: ask "where is auth handled?"
and the guard/middleware file often shares no vocabulary with the query — but it
sits one import-hop away from the file that does match.

This module adds a second retrieval signal on top of the existing cosine scores:
**spreading activation** over the import graph (a lightweight, personalized-
PageRank-style diffusion).

    1. Take the top vector hits as *seeds*.
    2. Walk the import graph outward from each seed (both directions:
       what a seed imports, and what imports the seed) up to ``max_hops``.
    3. A node ``d`` hops from a seed of cosine ``c`` receives a boost of
       ``c * decay**d``, summed across all seeds that reach it.
    4. Final score = ``cosine + alpha * graph_boost``.

The seeds keep their high cosine; structurally-adjacent files get lifted even
when their own cosine is below threshold, so the graph can *surface* files pure
vector search would never return. Setting ``alpha=0`` removes the graph
contribution from *scoring* (graph neighbours can still backfill otherwise-empty
result slots). The clean vector-only baseline the eval A/Bs against is the
separate path ``search_service.retrieve(use_graph=False)``.

Edge convention (from ``repo_analyzer._build_graph_payload``):
``source`` depends on ``target`` — either an import edge (``source`` imports
``target``) or an AST call edge (a function in ``source`` calls one in
``target``). Both kinds are traversed identically here.
"""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

# Default hyper-parameters — overridable per call (and by the eval harness).
DEFAULT_SEED_COUNT = 5      # how many top vector hits seed the diffusion
DEFAULT_MAX_HOPS   = 2      # graph radius around each seed
DEFAULT_DECAY      = 0.5    # boost multiplier per hop away from a seed
DEFAULT_ALPHA      = 0.6    # weight of the graph signal relative to cosine


# ── Graph construction ──────────────────────────────────────────────────────────

def _build_adjacency(
    edges: list[dict[str, Any]],
    valid_paths: set[str],
) -> dict[str, set[str]]:
    """Undirected adjacency restricted to files that exist in the repo.

    We treat imports as bidirectional for retrieval: a caller is just as
    relevant to its callee as the reverse. Direction is preserved separately
    only for annotation (see ``_direction_map``).
    """
    adj: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        src = str(edge.get("source", ""))
        tgt = str(edge.get("target", ""))
        if src in valid_paths and tgt in valid_paths and src != tgt:
            adj[src].add(tgt)
            adj[tgt].add(src)
    return adj


def _hops_from_seed(
    seed: str,
    adj: dict[str, set[str]],
    max_hops: int,
) -> dict[str, int]:
    """BFS shortest-hop distances from ``seed`` (inclusive) up to ``max_hops``."""
    dist: dict[str, int] = {seed: 0}
    queue: deque[str] = deque([seed])
    while queue:
        node = queue.popleft()
        d = dist[node]
        if d >= max_hops:
            continue
        for neighbor in adj.get(node, ()):  # type: ignore[arg-type]
            if neighbor not in dist:
                dist[neighbor] = d + 1
                queue.append(neighbor)
    return dist


# ── Public API ──────────────────────────────────────────────────────────────────

def expand_with_graph(
    all_scored: list[dict],
    edges: list[dict[str, Any]],
    *,
    top_files: int,
    min_score: float,
    seed_count: int = DEFAULT_SEED_COUNT,
    max_hops: int = DEFAULT_MAX_HOPS,
    decay: float = DEFAULT_DECAY,
    alpha: float = DEFAULT_ALPHA,
) -> list[dict]:
    """Re-rank ``all_scored`` using cosine + graph spreading activation.

    ``all_scored`` must contain **every** scored file (not just the vector
    top-k), each dict carrying at least ``path`` and ``score`` (cosine
    composite). Files below ``min_score`` are still eligible to appear if the
    graph lifts them — that is the whole point.

    Returns at most ``top_files`` result dicts, each a copy of the input
    augmented with:
        ``cosine_score``, ``graph_boost``, ``final_score``,
        ``hop_distance`` (0 for seeds, else min hops to a seed),
        ``nearest_seed``, ``retrieved_via`` ("vector" | "graph").
    ``score`` is overwritten with ``final_score`` so downstream ranking /
    topo-sort operate on the hybrid score.
    """
    if not all_scored:
        return []

    by_path: dict[str, dict] = {r["path"]: r for r in all_scored}
    cosine: dict[str, float] = {r["path"]: float(r.get("score", 0.0)) for r in all_scored}
    valid_paths = set(cosine)

    adj = _build_adjacency(edges, valid_paths)

    # Seeds: strongest vector hits above threshold.
    seeds = sorted(
        (r for r in all_scored if r.get("score", 0.0) >= min_score),
        key=lambda r: -r["score"],
    )[:seed_count]
    seed_paths = {s["path"] for s in seeds}

    # Diffuse each seed's relevance outward, accumulating boost on neighbors.
    graph_boost: dict[str, float] = defaultdict(float)
    min_hop: dict[str, int] = {}
    nearest_seed: dict[str, str] = {}

    for seed in seeds:
        sp = seed["path"]
        sc = float(seed["score"])
        for path, hops in _hops_from_seed(sp, adj, max_hops).items():
            if hops == 0:
                continue  # a seed never boosts itself
            graph_boost[path] += sc * (decay ** hops)
            if path not in min_hop or hops < min_hop[path]:
                min_hop[path] = hops
                nearest_seed[path] = sp

    # Candidates: real vector hits, plus any file the graph reached.
    candidate_paths = {p for p, c in cosine.items() if c >= min_score} | set(graph_boost)

    results: list[dict] = []
    for path in candidate_paths:
        base = by_path.get(path)
        if base is None:
            continue
        cos = cosine.get(path, 0.0)
        boost = graph_boost.get(path, 0.0)
        final = cos + alpha * boost
        is_seed = path in seed_paths

        entry = dict(base)
        entry["cosine_score"] = round(cos, 4)
        entry["graph_boost"]  = round(boost, 4)
        entry["final_score"]  = round(final, 4)
        entry["score"]        = round(final, 4)  # downstream ranks on hybrid score
        entry["hop_distance"] = 0 if is_seed else min_hop.get(path)
        entry["nearest_seed"] = None if is_seed else nearest_seed.get(path)
        # "graph" = a file only the graph surfaced (cosine below threshold).
        entry["retrieved_via"] = "vector" if cos >= min_score else "graph"
        results.append(entry)

    results.sort(key=lambda r: -r["final_score"])
    return results[:top_files]
