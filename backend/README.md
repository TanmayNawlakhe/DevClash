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
- `TAVILY_API_KEY`: API key for keyword reference lookups
- `TAVILY_CACHE_TTL_SECONDS`: redis cache TTL for keyword references (optional)

## 3) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

## 3.1) Run Worker (required for analysis jobs)

In a separate terminal:

```bash
python -m app.worker
```

## 3.2) Optional local services with Docker

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

This MVP backend provides the graph pipeline needed for React Flow with a durable
Redis-backed background worker. No AI summarization yet.

### List recent analysis jobs

`GET /api/repos?limit=20`

Returns recent repos with status and progress.

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
	"status": "pending"
}
```

### Check status

`GET /api/repos/{repo_id}`

Returns status (`pending`, `analyzing`, `cancelling`, `cancelled`, `complete`, `failed`)
plus counts/error/progress if available.

### Cancel job

`POST /api/repos/{repo_id}/cancel`

Cancels pending jobs immediately or requests cancellation for running jobs.

### Retry job

`POST /api/repos/{repo_id}/retry`

Re-queues a completed/failed/cancelled job for fresh analysis.

### Fetch graph

`GET /api/repos/{repo_id}/graph`

Optional query filters:
- `language=<language>`
- `path_prefix=<repo/relative/prefix>`

Returns React Flow-ready payload:
- `nodes[]` with `id`, `position`, `data`
- `edges[]` with `id`, `source`, `target`
- `meta` with counts, entry points, orphan nodes

If analysis is not complete yet, this endpoint returns HTTP 409.

### File detail endpoint

`GET /api/repos/{repo_id}/files/{file_path}`

Returns per-file graph details:
- language
- in/out degree
- isEntry/isOrphan
- imports (outgoing targets)
- dependents (incoming sources)

### File keyword references endpoint

`GET /api/repos/{repo_id}/file-references?file_path=<repo-relative-path>`

Returns per-keyword links for the selected file:
- `normal_reference_url`: top Tavily result for `<keyword>`
- `youtube_reference_url`: top Tavily result for `<keyword> youtube tutorial`
- `youtube_search_url`: direct YouTube search URL

Keyword references are cached globally in Redis by normalized keyword to avoid duplicate Tavily calls across files.

## Current MVP Analysis Scope

- Clone public GitHub repository (shallow clone)
- Parse dependencies/import-like references from:
	- Python: `.py`
	- JavaScript/TypeScript: `.js`, `.jsx`, `.ts`, `.tsx`
	- C/C++: `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hh`, `.hpp`, `.hxx`
	- Go: `.go`
	- Rust: `.rs`
	- HTML: `.html`, `.htm`
	- CSS: `.css`
- Build dependency edges where target files exist inside repo
- Compute basic node metadata:
	- `isEntry`
	- `isOrphan`
	- `inDegree` / `outDegree`

This is enough for a first React Flow graph view.

## Parser Tests (Language Fixtures)

Language-specific fixtures are under `tests/fixtures/` and validate parser extraction
for Python, JS/TS, C/C++, Go, Rust, HTML, and CSS.

Run tests:

```bash
pytest -q
```
