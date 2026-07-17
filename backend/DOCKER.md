# Running GitSuri with Docker

All commands run from `backend/`. Docker Compose **profiles** keep the default
startup minimal so nothing disrupts an existing Atlas / local-dev setup.

## Quick reference

| Command | Brings up |
|---|---|
| `docker compose up -d` | **redis + neo4j** (the always-on infra) |
| `docker compose --profile local-db up -d` | + local **MongoDB** + mongo-express UI |
| `docker compose --profile app up -d --build` | + **api + worker + frontend** |
| `docker compose --profile app --profile local-db up -d --build` | everything |

Stop: `docker compose down` (add `--profile app --profile local-db` to stop those too).
Wipe data: `docker compose down -v` (deletes volumes — Neo4j graph, Mongo, caches).

## Service URLs

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| Frontend | http://localhost:5173 |
| Neo4j browser | http://localhost:7474 (user `neo4j`, pass `devclash-password`) |
| Mongo UI (local-db) | http://localhost:8081 |

## Just want the databases (recommended for now)

You currently run the API/worker locally in a venv and use **Mongo Atlas**, so
you only need the infra:

```bash
docker compose up -d          # redis + neo4j
```

Keep your `.env` as-is (Atlas `MONGODB_URL`, `REDIS_URL=redis://localhost:6379/0`,
`NEO4J_URI=bolt://localhost:7687`, `NEO4J_ENABLED=true`).

## Going fully containerized

`--profile app` builds the backend image (Python + torch/transformers — the
**first build is large and slow**, later builds are cached) and the frontend.
Inside the app containers, service hostnames (`redis`, `neo4j`, `mongo`) are set
automatically; API keys and `MONGODB_URL` are read from `backend/.env`.

- **Stay on Atlas:** leave `MONGODB_URL` pointing at Atlas — the app containers use it.
- **Go fully local:** add `--profile local-db` and set `MONGODB_URL=mongodb://mongo:27017/repomap` in `.env`.

Notes:
- `api` and `worker` share one image and a `repo_cache` volume (so the API can
  read source that the worker cloned) and an `hf_cache` volume (so embedding
  models download once).
- Change the Neo4j password in **both** `docker-compose.yml` and `.env`.
