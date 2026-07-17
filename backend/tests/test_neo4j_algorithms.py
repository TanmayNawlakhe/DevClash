"""Neo4j GDS algorithm helpers — safe degradation when unavailable (no server)."""
import asyncio

from app.db import neo4j_client as n
from app.services import neo4j_algorithms as alg


def test_algorithms_noop_when_unavailable(monkeypatch):
    monkeypatch.setattr(n, "_driver", None, raising=False)

    async def scenario():
        res = await alg.run_graph_algorithms("6a59434055752b5291fd9285")
        assert res == {"ran": False, "reason": "neo4j unavailable"}
        assert await alg.top_by_pagerank("6a59434055752b5291fd9285") == []
        assert await alg.communities("6a59434055752b5291fd9285") == []

    asyncio.run(scenario())
