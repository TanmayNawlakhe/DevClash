"""Retrieval eval: vector-only vs. hybrid graph-RAG, on a labeled query set.

Produces the before/after numbers that make graph-RAG a resume bullet instead
of a buzzword: recall@k, precision@k, MRR, and hit@1, averaged over a set of
queries whose expected answer files you label by hand.

    Vector-only  = current behaviour (dense cosine top-k).
    Hybrid graph = dense seeds expanded along the import graph.

Usage
-----
    # 1. Analyse a repo through the app and note its id (GET /api/repos).
    # 2. Copy dataset.example.json -> dataset.json and fill in real repo_ids,
    #    queries, and the file paths you'd expect each query to surface.
    # 3. From backend/:  python -m eval.run_eval --k 10
    #    (or:            python eval/run_eval.py --dataset eval/dataset.json --k 10)

The script only reads MongoDB (embeddings + graph). It never calls the LLM, so
it is fast and free to run repeatedly while you tune alpha / hops / decay.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Make `app` importable when run as a plain script (python eval/run_eval.py).
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.db.mongodb import (  # noqa: E402
    close_mongodb_connection,
    connect_to_mongodb,
)
from app.services.search_service import retrieve  # noqa: E402


# ── Matching ────────────────────────────────────────────────────────────────────

def _norm(path: str) -> str:
    return path.strip().replace("\\", "/").lstrip("./").lower()


def _matches(retrieved: str, expected: str) -> bool:
    """Lenient path match: exact, or one is a path-suffix of the other.

    Lets you label expected files as ``auth/middleware.py`` or just
    ``middleware.py`` without worrying about the repo's full prefix.
    """
    r, e = _norm(retrieved), _norm(expected)
    if r == e:
        return True
    return r.endswith("/" + e) or e.endswith("/" + r)


# ── Metrics for a single query ──────────────────────────────────────────────────

def _score_query(ranked_paths: list[str], expected: list[str], k: int) -> dict:
    """ranked_paths: retrieved file paths, best-first. expected: ground truth."""
    topk = ranked_paths[:k]

    def _hit(exp: str, pool: list[str]) -> bool:
        return any(_matches(r, exp) for r in pool)

    found = sum(1 for exp in expected if _hit(exp, topk))
    recall = found / len(expected) if expected else 0.0
    precision = found / len(topk) if topk else 0.0

    # Reciprocal rank of the first retrieved file that matches any expected file.
    rr = 0.0
    for idx, r in enumerate(topk, start=1):
        if any(_matches(r, exp) for exp in expected):
            rr = 1.0 / idx
            break

    hit1 = 1.0 if (topk and any(_matches(topk[0], exp) for exp in expected)) else 0.0
    return {"recall": recall, "precision": precision, "mrr": rr, "hit1": hit1}


def _ranked_paths(result: dict) -> list[str]:
    """Flow is topo-sorted; re-rank by relevance for ranking metrics."""
    flow = sorted(result["flow"], key=lambda e: -e["relevance_score"])
    return [e["file_path"] for e in flow]


# ── Runner ──────────────────────────────────────────────────────────────────────

async def _evaluate(dataset: list[dict], k: int) -> None:
    modes = {"vector_only": False, "hybrid_graph": True}
    agg: dict[str, dict[str, float]] = {
        m: {"recall": 0.0, "precision": 0.0, "mrr": 0.0, "hit1": 0.0} for m in modes
    }
    n = len(dataset)

    print(f"\nEvaluating {n} queries at k={k}\n" + "=" * 78)

    for i, case in enumerate(dataset, start=1):
        repo_id = case["repo_id"]
        query = case["query"]
        expected = case["expected"]
        print(f"\n[{i}/{n}] {query!r}  (expects {len(expected)} file(s))")

        per_mode: dict[str, dict] = {}
        for mode, use_graph in modes.items():
            result = await retrieve(repo_id, query, top_files=k, use_graph=use_graph)
            ranked = _ranked_paths(result)
            metrics = _score_query(ranked, expected, k)
            per_mode[mode] = metrics
            for key in agg[mode]:
                agg[mode][key] += metrics[key]

            newly = ""
            if use_graph:
                graph_only = [
                    e["file_path"] for e in result["flow"]
                    if e.get("retrieved_via") == "graph"
                ]
                if graph_only:
                    newly = f"  (+{len(graph_only)} via graph)"
            print(
                f"    {mode:<13} recall={metrics['recall']:.2f} "
                f"prec={metrics['precision']:.2f} mrr={metrics['mrr']:.2f}{newly}"
            )

    # ── Aggregate report ─────────────────────────────────────────────────────
    for mode in agg:
        for key in agg[mode]:
            agg[mode][key] /= max(n, 1)

    v, h = agg["vector_only"], agg["hybrid_graph"]
    print("\n" + "=" * 78)
    print(f"AGGREGATE  (n={n}, k={k})")
    print("-" * 78)
    print(f"{'metric':<12}{'vector-only':>14}{'hybrid-graph':>15}{'delta':>12}")
    for key, label in [
        ("recall", f"recall@{k}"),
        ("precision", f"precision@{k}"),
        ("mrr", "MRR"),
        ("hit1", "hit@1"),
    ]:
        delta = h[key] - v[key]
        print(f"{label:<12}{v[key]:>14.3f}{h[key]:>15.3f}{delta:>+12.3f}")

    # Copy-paste-ready resume line.
    r_before, r_after = v["recall"] * 100, h["recall"] * 100
    print("\n" + "-" * 78)
    print("Resume line (verify the number is real before using it):")
    print(
        f"  Improved code-retrieval recall@{k} from {r_before:.0f}% to {r_after:.0f}% "
        f"by adding graph-RAG (spreading activation over the import dependency\n"
        f"  graph) on top of dense embeddings, across {n} labeled queries."
    )
    print("=" * 78 + "\n")


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Vector vs. graph-RAG retrieval eval")
    parser.add_argument(
        "--dataset",
        default=str(Path(__file__).parent / "dataset.json"),
        help="Path to labeled dataset JSON (default: eval/dataset.json)",
    )
    parser.add_argument("--k", type=int, default=10, help="Cutoff k for @k metrics")
    args = parser.parse_args()

    ds_path = Path(args.dataset)
    if not ds_path.is_file():
        raise SystemExit(
            f"Dataset not found: {ds_path}\n"
            f"Copy {ds_path.parent / 'dataset.example.json'} to {ds_path.name} and fill it in."
        )
    dataset = json.loads(ds_path.read_text(encoding="utf-8"))
    if not dataset:
        raise SystemExit("Dataset is empty — add at least one labeled query.")

    await connect_to_mongodb()
    try:
        await _evaluate(dataset, args.k)
    finally:
        await close_mongodb_connection()


if __name__ == "__main__":
    asyncio.run(_main())
