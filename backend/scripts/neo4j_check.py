"""Quick Neo4j connectivity + schema check.

Run after `docker-compose up -d neo4j` and setting NEO4J_ENABLED=true in .env:

    python -m scripts.neo4j_check      # from backend/

Reports: connection, server version, GDS/APOC availability, and whether the
vector index was created. Purely diagnostic — makes no changes beyond schema.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.db import neo4j_client as n  # noqa: E402


async def main() -> int:
    if not settings.neo4j_enabled:
        print("NEO4J_ENABLED is false — set it to true in backend/.env first.")
        return 1

    print(f"Connecting to {settings.neo4j_uri} as {settings.neo4j_user} …")
    driver = await n.connect_to_neo4j()
    if driver is None:
        print("❌ Could not connect. Is the container up? `docker-compose up -d neo4j`")
        return 1

    try:
        ver = await n.run_read(
            "CALL dbms.components() YIELD name, versions, edition "
            "RETURN name, versions[0] AS version, edition"
        )
        if ver:
            c = ver[0]
            print(f"✅ Connected — {c['name']} {c['version']} ({c['edition']})")

        gds = await n.run_read(
            "SHOW PROCEDURES YIELD name WHERE name STARTS WITH 'gds.' "
            "RETURN count(*) AS c"
        )
        apoc = await n.run_read(
            "SHOW PROCEDURES YIELD name WHERE name STARTS WITH 'apoc.' "
            "RETURN count(*) AS c"
        )
        print(f"   GDS procedures : {gds[0]['c'] if gds else 0}")
        print(f"   APOC procedures: {apoc[0]['c'] if apoc else 0}")

        idx = await n.run_read(
            "SHOW INDEXES YIELD name, type WHERE name = 'file_embedding' "
            "RETURN name, type"
        )
        print(f"   Vector index   : {'present' if idx else 'MISSING (needs Neo4j >= 5.11)'}")
        print("\nAll set — ready for Phase 2 (write path).")
        return 0
    finally:
        await n.close_neo4j()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
