"""Unit tests for Neo4j row-building (pure — no server needed)."""
from app.services.neo4j_sync import _build_rows


def test_build_rows_shapes_and_splits():
    rid = "REPO1"
    nodes = [
        {"id": "api/login.py", "data": {
            "language": "python", "classification": "api", "summary": "login",
            "isEntry": True, "lineCount": 40,
            "functions": [{"name": "login"}, {"name": "<anonymous>"}],
        }},
        {"id": "core/auth.py", "data": {
            "language": "python", "classification": "business_logic",
            "functions": [{"name": "verify"}],
        }},
    ]
    edges = [
        {"source": "api/login.py", "target": "core/auth.py", "data": {"kind": "import"}},
        {"source": "core/auth.py", "target": "core/session.py", "data": {"kind": "call"}},
    ]
    call_graph = [
        {"caller_file": "api/login.py", "caller": "login",
         "callee_file": "core/auth.py", "callee": "verify"},
        {"caller_file": "core/auth.py", "caller": "<module>",  # must be skipped
         "callee_file": "core/auth.py", "callee": "verify"},
    ]
    emb_by_path = {"api/login.py": [0.1, 0.2]}

    rows = _build_rows(rid, nodes, edges, call_graph, emb_by_path)

    # Files
    assert [f["uid"] for f in rows["files"]] == ["REPO1:api/login.py", "REPO1:core/auth.py"]
    login = rows["files"][0]
    assert login["layer"] == "api" and login["isEntry"] is True
    assert login["embedding"] == [0.1, 0.2]
    assert rows["files"][1]["embedding"] is None

    # Functions — <anonymous> dropped
    assert {f["uid"] for f in rows["funcs"]} == {"REPO1:api/login.py:login", "REPO1:core/auth.py:verify"}

    # Edge kind split
    assert rows["imports"] == [{"a": "REPO1:api/login.py", "b": "REPO1:core/auth.py"}]
    assert rows["calls"] == [{"a": "REPO1:core/auth.py", "b": "REPO1:core/session.py"}]

    # Function calls — <module> caller skipped
    assert rows["fncalls"] == [{"a": "REPO1:api/login.py:login", "b": "REPO1:core/auth.py:verify"}]


def test_build_rows_empty():
    rows = _build_rows("R", [], [], [], {})
    assert all(v == [] for v in rows.values())
