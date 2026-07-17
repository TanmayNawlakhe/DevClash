"""Unit tests for the Neo4j retrieval query builder + flow mapping (no server)."""
from app.services.neo4j_retrieval import _hybrid_cypher
from app.services.search_service import _flow_from_neo4j_rows


def test_hybrid_cypher_structure():
    cy = _hybrid_cypher(max_hops=2)
    assert "db.index.vector.queryNodes('file_embedding'" in cy   # vector seeds
    assert "IMPORTS|CALLS*0..2" in cy                            # graph expansion
    assert "vector.similarity.cosine" in cy                      # per-candidate cosine
    assert "boostRaw / seedMass" in cy                           # normalized boost
    assert "ORDER BY relevance_score DESC" in cy and "LIMIT $topN" in cy


def test_hybrid_cypher_hops_inlined_and_clamped():
    assert "*0..3" in _hybrid_cypher(3)
    assert "*0..1" in _hybrid_cypher(0)   # clamped to >= 1


def test_flow_from_neo4j_rows_topo_orders_and_maps():
    # b imports c; a is standalone. Topo order puts importers before imports.
    rows = [
        {"file_path": "c.py", "relevance_score": 0.9, "cosine_score": 0.9,
         "graph_boost": 0.1, "layer": "data", "language": "python",
         "is_entry": False, "summary": "c", "retrieved_via": "vector"},
        {"file_path": "b.py", "relevance_score": 0.8, "cosine_score": 0.6,
         "graph_boost": 0.3, "layer": "api", "language": "python",
         "is_entry": True, "summary": "b", "retrieved_via": "graph"},
    ]
    edges = [{"source": "b.py", "target": "c.py", "data": {"kind": "import"}}]
    flow = _flow_from_neo4j_rows(rows, edges, node_meta={})

    assert [f["file_path"] for f in flow] == ["b.py", "c.py"]     # b before c (topo)
    assert [f["rank"] for f in flow] == [1, 2]
    b = flow[0]
    assert b["is_entry"] is True and b["retrieved_via"] == "graph"
    assert b["score_breakdown"] == {"cosine": 0.6, "graph_boost": 0.3}
    assert b["matched_functions"] == []


def test_flow_from_neo4j_rows_falls_back_to_node_meta():
    rows = [{"file_path": "x.py", "relevance_score": 0.5, "cosine_score": 0.5,
             "graph_boost": 0.0}]
    meta = {"x.py": {"language": "python", "classification": "utility",
                     "summary": "from meta", "isEntry": True}}
    flow = _flow_from_neo4j_rows(rows, [], meta)
    assert flow[0]["summary"] == "from meta"
    assert flow[0]["layer"] == "utility"
    assert flow[0]["is_entry"] is True
