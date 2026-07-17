"""GraphRAG global-search helpers — safe degradation when Neo4j is down."""
import asyncio

from app.db import neo4j_client as n
from app.services import graphrag_global as g


def test_global_helpers_noop_when_unavailable(monkeypatch):
    monkeypatch.setattr(n, "_driver", None, raising=False)

    async def scenario():
        summ = await g.summarize_communities("6a59434055752b5291fd9285")
        assert summ == {"summarized": False, "reason": "neo4j unavailable"}

        res = await g.global_search("6a59434055752b5291fd9285", "what are the main parts?")
        assert res["mode"] == "global"
        assert res["subsystems"] == []
        assert "not available" in res["answer"].lower()

    asyncio.run(scenario())
