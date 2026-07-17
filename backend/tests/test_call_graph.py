"""Unit tests for call-graph resolution and edge merging (pure functions)."""
from app.services.repo_analyzer import _resolve_call_graph, _build_graph_payload


def test_resolution_disambiguation_branches():
    functions_by_file = {
        "api/login.py":  [{"name": "login"}],
        "core/auth.py":  [{"name": "verify"}, {"name": "shared"}],
        "core/token.py": [{"name": "verify"}],   # name collides with core/auth.py
        "util/misc.py":  [{"name": "shared"}],    # collides with core/auth.py
    }
    calls_by_file = {
        # import-linked disambiguation: login imports core/auth only
        "api/login.py":  [{"caller": "login", "callee": "verify"},
                          {"caller": "login", "callee": "os_open"}],   # library → drop
        # same-file resolution (no cross-file edge)
        "core/auth.py":  [{"caller": "verify", "callee": "shared"}],
        # ambiguous (auth & misc) + no import → skip
        "core/token.py": [{"caller": "verify", "callee": "shared"}],
    }
    import_edges = {("api/login.py", "core/auth.py")}

    fn_edges, file_edges = _resolve_call_graph(functions_by_file, calls_by_file, import_edges)
    names = {(e["caller_file"], e["callee_file"], e["callee"]) for e in fn_edges}

    assert ("api/login.py", "core/auth.py", "verify") in names   # import-linked
    assert ("core/auth.py", "core/auth.py", "shared") in names   # same-file
    assert not any(e["callee"] == "os_open" for e in fn_edges)    # library dropped
    assert not any(e["caller_file"] == "core/token.py" for e in fn_edges)  # ambiguous skipped
    assert file_edges == {("api/login.py", "core/auth.py")}       # only cross-file, linked


def test_unique_name_resolves_without_import():
    functions_by_file = {
        "pkg/helpers.py": [{"name": "compute_total"}],
        "pkg/service.py": [{"name": "run"}],
    }
    calls_by_file = {
        "pkg/service.py": [{"caller": "run", "callee": "compute_total"}],
    }
    # No import edges at all — resolution must still connect a unique name.
    fn_edges, file_edges = _resolve_call_graph(functions_by_file, calls_by_file, set())
    assert ("pkg/service.py", "pkg/helpers.py") in file_edges


def test_build_graph_payload_merges_and_tags_edges():
    files = ["api/login.py", "core/auth.py", "core/token.py"]
    import_edges = {("api/login.py", "core/auth.py")}
    call_file_edges = {("api/login.py", "core/auth.py"),   # duplicate of an import
                       ("core/auth.py", "core/token.py")}  # call-only
    fn_edges = [{"caller_file": "core/auth.py", "caller": "verify",
                 "callee_file": "core/token.py", "callee": "check"}]

    payload = _build_graph_payload(
        files, import_edges, {}, {},
        call_file_edges=call_file_edges, call_edges_fn=fn_edges,
    )
    kinds = {(e["source"], e["target"], e["data"].get("kind")) for e in payload["edges"]}

    assert ("api/login.py", "core/auth.py", "import") in kinds
    assert ("core/auth.py", "core/token.py", "call") in kinds
    # The import edge must not be duplicated by the identical call edge.
    dupes = [e for e in payload["edges"]
             if (e["source"], e["target"]) == ("api/login.py", "core/auth.py")]
    assert len(dupes) == 1
    assert payload["meta"]["importEdgeCount"] == 1
    assert payload["meta"]["callEdgeCount"] == 1
    assert payload["callGraph"] == fn_edges


def test_call_counts_on_nodes():
    files = ["a.py", "b.py"]
    fn_edges = [{"caller_file": "a.py", "caller": "f",
                 "callee_file": "b.py", "callee": "g"}]
    payload = _build_graph_payload(
        files, set(), {}, {},
        call_file_edges={("a.py", "b.py")}, call_edges_fn=fn_edges,
    )
    data = {n["id"]: n["data"] for n in payload["nodes"]}
    assert data["a.py"]["callsOut"] == 1
    assert data["b.py"]["callsIn"] == 1
