"""Unit tests for graph-RAG spreading-activation retrieval.

Pure functions — no DB, no models, no network.
"""
from app.services.graph_rag import expand_with_graph


def _repo():
    """A query strongly matches login.py; the real auth logic is 1-2 hops away
    with cosine below threshold — the case graph-RAG must fix."""
    scored = [
        {"path": "api/login.py",       "score": 0.82},  # seed
        {"path": "core/auth_guard.py", "score": 0.12},  # 1 hop, below min_score
        {"path": "core/session.py",    "score": 0.10},  # 2 hops
        {"path": "utils/format.py",    "score": 0.09},  # unconnected noise
        {"path": "api/health.py",      "score": 0.20},  # unconnected, mid cosine
    ]
    edges = [
        {"source": "api/login.py",       "target": "core/auth_guard.py"},
        {"source": "core/auth_guard.py", "target": "core/session.py"},
    ]
    return scored, edges


def test_graph_surfaces_subthreshold_neighbors():
    scored, edges = _repo()
    got = {r["path"] for r in expand_with_graph(scored, edges, top_files=8, min_score=0.30)}
    assert "core/auth_guard.py" in got   # 1-hop neighbor pulled in
    assert "core/session.py" in got      # 2-hop neighbor pulled in


def test_unconnected_low_cosine_excluded():
    scored, edges = _repo()
    got = {r["path"] for r in expand_with_graph(scored, edges, top_files=8, min_score=0.30)}
    assert "utils/format.py" not in got


def test_seed_keeps_top_rank_and_provenance():
    scored, edges = _repo()
    sel = expand_with_graph(scored, edges, top_files=8, min_score=0.30)
    assert sel[0]["path"] == "api/login.py"
    assert sel[0]["retrieved_via"] == "vector"
    assert sel[0]["hop_distance"] == 0
    neighbors = [r for r in sel if r["path"].startswith("core/")]
    assert neighbors and all(r["retrieved_via"] == "graph" for r in neighbors)
    assert all(r["graph_boost"] > 0 for r in neighbors)


def test_hop_distance_and_decay_ordering():
    scored, edges = _repo()
    sel = {r["path"]: r for r in expand_with_graph(scored, edges, top_files=8, min_score=0.30)}
    # Closer neighbor gets a bigger boost than the farther one.
    assert sel["core/auth_guard.py"]["hop_distance"] == 1
    assert sel["core/session.py"]["hop_distance"] == 2
    assert sel["core/auth_guard.py"]["graph_boost"] > sel["core/session.py"]["graph_boost"]


def test_no_edges_reduces_to_vector_hits():
    scored, _ = _repo()
    got = {r["path"] for r in expand_with_graph(scored, [], top_files=8, min_score=0.30)}
    # Without a graph, only files above min_score survive.
    assert got == {"api/login.py"}


def test_empty_input():
    assert expand_with_graph([], [], top_files=8, min_score=0.30) == []


def test_alpha_zero_removes_graph_from_scoring():
    scored, edges = _repo()
    sel = expand_with_graph(scored, edges, top_files=8, min_score=0.30, alpha=0.0)
    # With alpha=0 the neighbours may still backfill, but their score is pure
    # cosine, so the seed and the mid-cosine vector hit outrank them.
    ranked = [r["path"] for r in sel]
    assert ranked[0] == "api/login.py"
    assert all(r["final_score"] == r["cosine_score"] for r in sel)
