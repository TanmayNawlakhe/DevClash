"""Neo4j client tests — the disabled/unavailable path must never break the app.

These run without a Neo4j server (async driven via asyncio.run, so no
pytest-asyncio dependency needed).
"""
import asyncio

from app.db import neo4j_client as n


def test_disabled_path_is_safe_noop(monkeypatch):
    # Force the disabled state regardless of the environment.
    monkeypatch.setattr(n.settings, "neo4j_enabled", False, raising=False)

    async def scenario():
        assert await n.connect_to_neo4j() is None
        assert n.get_neo4j() is None
        assert n.is_available() is False
        # Query helpers degrade to [] instead of raising.
        assert await n.run_read("MATCH (x) RETURN x") == []
        assert await n.run_write("CREATE (x:Test)") == []
        await n.close_neo4j()  # must be safe on a null driver

    asyncio.run(scenario())


def test_vector_index_ddl_uses_configured_dimension(monkeypatch):
    monkeypatch.setattr(n.settings, "neo4j_vector_dim", 384, raising=False)
    ddl = n._vector_index_cypher()
    assert "`vector.dimensions`: 384" in ddl
    assert "'cosine'" in ddl
    assert "CREATE VECTOR INDEX file_embedding IF NOT EXISTS" in ddl


def test_schema_statements_are_idempotent():
    for stmt in n._CONSTRAINTS:
        assert "IF NOT EXISTS" in stmt
