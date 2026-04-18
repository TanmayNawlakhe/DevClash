# Backend Setup

## 1) Install dependencies

```bash
pip install -r requirements.txt
```

## 2) Configure environment

Copy `.env.example` to `.env` and set real values:

- `MONGODB_URL`: your MongoDB Atlas connection string
- `MONGODB_DB_NAME`: database name
- `REDIS_URL`: redis connection string (local or cloud)
- `LOG_LEVEL`: INFO, DEBUG, etc.

## 3) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

## 3.1) Optional local services with Docker

```bash
docker compose up -d
```

This starts:
- Redis on `localhost:6379`

MongoDB is expected to be MongoDB Atlas via `MONGODB_URL` in `.env`.

## 4) Health check

Open:

- `http://localhost:8000/health`

If startup succeeds, the app will connect to MongoDB and Redis automatically.

## MVP API (React Flow Ready)

This MVP backend provides only the graph pipeline needed for React Flow.
No AI, no Celery, no ownership/priority yet.

### Submit repo for analysis

`POST /api/repos`

Request body:

```json
{
	"github_url": "https://github.com/owner/repo"
}
```

Response:

```json
{
	"repo_id": "...",
	"github_url": "https://github.com/owner/repo",
	"status": "analyzing"
}
```

### Check status

`GET /api/repos/{repo_id}`

Returns status (`analyzing`, `complete`, `failed`) plus counts/error if available.

### Fetch graph

`GET /api/repos/{repo_id}/graph`

Returns React Flow-ready payload:
- `nodes[]` with `id`, `position`, `data`
- `edges[]` with `id`, `source`, `target`
- `meta` with counts, entry points, orphan nodes

If analysis is not complete yet, this endpoint returns HTTP 409.

## Current MVP Analysis Scope

- Clone public GitHub repository (shallow clone)
- Parse imports from:
	- Python: `.py`
	- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`
- Build dependency edges where target files exist inside repo
- Compute basic node metadata:
	- `isEntry`
	- `isOrphan`
	- `inDegree` / `outDegree`

This is enough for a first React Flow graph view.
