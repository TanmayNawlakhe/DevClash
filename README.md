# GitSuri

> AI-powered repository analysis and interactive codebase visualization.

GitSuri clones any public GitHub repository, parses its source with Tree-sitter, builds a file-level dependency graph plus a function-level call graph, and lets you explore the architecture on an interactive canvas — with AI-generated summaries and classifications, Graph-RAG semantic search, and community detection over the dependency graph.

Built for DevClash 2026.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Analysis Pipeline](#analysis-pipeline)
- [Retrieval: Graph-RAG](#retrieval-graph-rag)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
  - [MongoDB](#mongodb)
  - [Neo4j](#neo4j-optional)
  - [Redis](#redis)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [File Classification Labels](#file-classification-labels)
- [Testing & Evaluation](#testing--evaluation)
- [Known Gaps](#known-gaps)
- [License](#license)

---

## Features

- **Interactive dependency graph** — nodes are files, edges are imports and cross-file calls. Pan, zoom, click any node to inspect.
- **Collapsed pipeline view** — files grouped by AI-assigned classification into a left-to-right dependency flow.
- **AI file classification** — each file gets one of 11 roles (`entry_point`, `api`, `business_logic`, …), with a deterministic path-based fallback when the LLM returns something invalid.
- **AI summaries** — per-file and per-function summaries, plus extracted technical keywords.
- **Graph-RAG code search** — dense-vector seeds expanded along the dependency graph via spreading activation, so structurally-related files surface even without lexical overlap. Ask *"where is auth handled?"* and get the guard/middleware files too, not just the ones containing the word "auth".
- **AST call graph** — Tree-sitter resolves every call site to the function it targets (same-file → import-linked → unique-name), producing a caller→callee graph. Cross-file call edges merge into the retrieval graph, catching dependencies that import parsing alone misses.
- **Community detection** — optional Neo4j GDS layer runs Louvain + PageRank, then LLM-summarizes each community into a named subsystem for global "what does this repo do?" queries.
- **Keyword references** — Tavily-backed doc and tutorial links per keyword, Redis-cached.
- **Multi-language** — Python, TS/JS, Go, Rust, C/C++, HTML, CSS.

---

## Architecture

```
┌──────────────────────────────┐      ┌───────────────────────────────────┐
│          Frontend            │      │             Backend               │
│  React 19 · TypeScript · Vite│─────▶│  FastAPI  ·  Motor (async Mongo)  │
│  XYFlow · Framer Motion      │ HTTP │  Redis queue  ·  Worker process   │
│  Zustand · TanStack Query    │ poll │  Tree-sitter  ·  Groq/OpenRouter  │
│  Monaco · Mermaid · three.js │      │  CodeBERT + MiniLM  ·  Tavily     │
└──────────────────────────────┘      └───────────────────────────────────┘
                                                     │
                        ┌────────────────────────────┼────────────────────────────┐
                        ▼                            ▼                            ▼
              ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
              │     MongoDB      │        │      Redis       │        │  Neo4j (opt-in)  │
              │  system of record│        │  job queue +     │        │  graph brain:    │
              │  repos · graphs  │        │  Tavily cache    │        │  GDS · vector idx│
              │  embeddings      │        │                  │        │  communities     │
              └──────────────────┘        └──────────────────┘        └──────────────────┘
```

**Two processes.** The API (`uvicorn app.main:app`) serves HTTP; a separate worker (`python -m app.worker`) drains the Redis queue with `BRPOP` and runs one analysis job at a time. Embedding jobs are the exception — they run in the API process via FastAPI `BackgroundTasks`.

**MongoDB is the system of record.** Neo4j is an optional dual-write mirror used purely as a retrieval/graph-algorithm engine. Everything degrades to a no-op when `NEO4J_ENABLED=false` — the in-memory Graph-RAG path takes over.

**Progress is polled, not pushed.** The frontend polls `GET /api/repos/{id}` every 2s. There is no WebSocket server despite a `socketService.ts` on the client (see [Known Gaps](#known-gaps)).

---

## Analysis Pipeline

1. `POST /api/repos` validates and normalizes the URL, upserts a `repos` doc as `pending`, and `LPUSH`es the id onto the Redis queue.
2. The worker `BRPOP`s the id and clones the repo (`--depth 1 --single-branch`, 120s timeout).
3. Tree-sitter parses each file → functions, call sites, dependency refs:
   - **Python** → stdlib `ast`
   - **JS/JSX/TS/TSX, C/C++, HTML, CSS** → Tree-sitter
   - **Go, Rust** → regex
   - Function/call extraction is Tree-sitter for all of the above except HTML/CSS.
4. Call sites resolve to definitions (same-file wins → unique repo-wide def → import-linked def → else dropped), producing the function-level call graph.
5. The LLM classifies and summarizes each file in batches of 6, with a 12s inter-batch sleep to stay inside Groq free-tier limits.
6. Graph + summaries are written to `graphs`; the repo flips to `complete`. **The clone is intentionally left on disk** — `clone_path` is stored so embedding and file-preview endpoints can read source.
7. `POST /api/repos/{id}/embeddings` encodes files with CodeBERT (768-dim) and MiniLM (384-dim), then — if Neo4j is on — mirrors the graph, runs GDS, and summarizes communities.

---

## Retrieval: Graph-RAG

A query is embedded and cosine-scored against every file. Top hits become **seeds** whose relevance diffuses across the dependency graph (import + call edges, treated as undirected) with `decay^hops` per hop. Graph-adjacent files are retrieved even at zero lexical overlap.

There are **two implementations** of this, and they score differently:

| | In-memory (`graph_rag.py`) | Neo4j Cypher (`neo4j_retrieval.py`) |
|---|---|---|
| Cosine | `0.55·CodeBERT + 0.45·MiniLM`, overridden by best function match (capped 0.90) | MiniLM summary embedding only |
| Graph boost | un-normalized sum | normalized by seed mass |
| Formula | `cosine + α·Σ cos(s)·decay^d` | `cosine + α·[Σ cos(s)·decay^d] / Σ cos(s)` |
| Functions | `matched_functions` populated | always `[]` |

`search_service.retrieve()` prefers Neo4j and falls back to in-memory if it's disabled or returns no rows. Shared defaults (`graph_rag.py`):

```python
DEFAULT_SEED_COUNT = 5    # top vector hits that seed diffusion
DEFAULT_MAX_HOPS   = 2    # graph radius per seed
DEFAULT_DECAY      = 0.5  # boost multiplier per hop
DEFAULT_ALPHA      = 0.6  # graph signal weight vs cosine
```

A/B against vector-only retrieval with a `recall@k`/MRR harness — see [`backend/eval/`](backend/eval/).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19.2, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS 4 (CSS-first, no config file) |
| Graph canvas | XYFlow 12 (React Flow), D3 force |
| 3D / animation | three.js + React Three Fiber, Framer Motion |
| State | Zustand 5 |
| Data fetching | TanStack Query 5, Axios |
| Code display | Monaco Editor |
| Diagrams | Mermaid 11 |
| Auth (client) | Firebase Auth 12 |
| Backend framework | FastAPI 0.115, Uvicorn |
| Database | MongoDB (Motor async driver) |
| Queue / cache | Redis 7 |
| Graph store | Neo4j 5.26 + GDS + APOC (optional) |
| AST parsing | Tree-sitter 0.25 (pinned grammar set) |
| LLM | Groq (Llama 3.3-70b / 3.1-8b) or OpenRouter |
| Embeddings | CodeBERT (768-dim) + MiniLM (384-dim) via sentence-transformers |
| Web search | Tavily |

> Tree-sitter versions are **pinned as a coherent set** — the core and grammars share a native ABI, and mixing an unpinned core with older grammars can segfault the parser.

---

## Database Schema

### MongoDB

Database: `repomap` (configurable via `MONGODB_DB_NAME`). Three collections, no ODM — documents are written as plain dicts.

#### `repos` — job status and lifecycle

One document per analyzed repository. This is what the dashboard and polling read.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | the `repo_id` used everywhere |
| `github_url` | string | normalized; **unique index** |
| `status` | string | `pending` \| `analyzing` \| `cancelling` \| `cancelled` \| `complete` \| `failed` |
| `cancel_requested` | bool | cooperative cancel flag polled by the worker |
| `created_at` | datetime | **indexed** (list sort) |
| `started_at` | datetime \| null | |
| `completed_at` | datetime \| null | |
| `error_msg` | string \| null | |
| `node_count` | int | |
| `edge_count` | int | |
| `progress` | object | `{stage, percent, current_file, updated_at}` |

`progress.stage` moves through `queued → cloning → parsing → summarising → complete`, with `cancelled` / `failed` as terminal states. `percent` is clamped 0–100.

**Indexes:** `github_url` (unique), `created_at`, `status`.

#### `graphs` — the analysis payload

One document per repo (**unique index on `repo_id`**), written with `replace_one(upsert=True)`.

| Field | Type | Notes |
|---|---|---|
| `repo_id` | ObjectId | FK → `repos._id`; **unique index** |
| `nodes` | array\<Node\> | see below |
| `edges` | array\<Edge\> | see below |
| `callGraph` | array\<CallEdge\> | function-level, top-level (not inside `meta`) |
| `meta` | object | counts + entry/orphan lists |
| `file_paths` | array\<string\> | flat path list for cheap lookups |
| `clone_path` | string \| null | on-disk clone, read by embedding + file preview |
| `summaries` | array\<Summary\> | flat list served by `/summaries` |
| `updated_at` | datetime | |

**Node** — React Flow shaped. Keys under `data` are camelCase; `id` is the repo-relative POSIX path and is the natural key.

```jsonc
{
  "id": "app/services/repo_analyzer.py",
  "position": { "x": 260, "y": 120 },        // deterministic grid: (i%6)*260, (i/6)*120
  "data": {
    "label": "repo_analyzer.py",             // basename
    "path": "app/services/repo_analyzer.py", // duplicate of id
    "language": "python",                    // enum, see below
    "isEntry": false,                        // basename in the entry-point set
    "isOrphan": false,                       // inDegree == 0 && outDegree == 0
    "inDegree": 3,                           // incoming IMPORT edges only
    "outDegree": 5,                          // outgoing IMPORT edges only
    "callsIn": 2,                            // cross-file callGraph entries targeting this file
    "callsOut": 7,
    "lineCount": 1122,                       // 0 only if unreadable
    "functionCount": 14,
    "functions": [ /* Function[] */ ],
    // ── added post-analysis by the LLM merge step ──
    "summary": "Clones the repo and builds…", // 5-6 short lines, \n separated
    "classification": "business_logic",       // one of the 11 labels
    "keywords": ["tree-sitter", "AST", "git"] // 3-8 technical terms
  }
}
```

`data.language` ∈ `dockerfile · env · python · typescript · javascript · cpp_c · go · rust · html · css · json · yaml · toml · config · unknown`. Note `cpp_c` is one bucket for all C/C++ extensions.

**Function** (inside `data.functions`) — snake_case, six keys. The `body` used for chunking is stripped before persistence.

```jsonc
{
  "name": "analyze_repository_graph",
  "type": "async_function",   // function | async_function | arrow_function | method
                              // | class | struct | enum | trait | impl
  "line": 412,                // 1-indexed; Python decorated defs point at the decorator
  "line_count": 88,
  "params": ["github_url", "clone_base_dir"],  // self/cls dropped; may hold *args/**kwargs/...rest
  "returns": "dict",          // null for classes, C/C++, and JS arrow/variable fns
  "summary": "Clones then parses…"  // merged in post-analysis; absent until then
}
```

**Edge** — two kinds share one array. `importType` exists only on import edges.

```jsonc
{ "id": "e-12", "source": "app/main.py", "target": "app/config.py",
  "data": { "importType": "direct", "kind": "import" } }

{ "id": "c-3",  "source": "app/api/repos.py", "target": "app/services/search_service.py",
  "data": { "kind": "call" } }   // cross-file call the import graph missed
```

Ids restart at 0 per kind, so uniqueness comes from the `e-`/`c-` prefix. Self-edges are excluded; call-only edges exclude pairs already present as imports.

**CallEdge** (inside `callGraph`) — snake_case, all strings. Includes intra-file calls, which are excluded from `callsIn`/`callsOut` and from `c-*` edges.

```jsonc
{ "caller_file": "app/api/repos.py", "caller": "submit_repo",
  "callee_file": "app/services/repo_job_processor.py", "callee": "enqueue_repo_job" }
```

`caller` may be the literal `"<module>"` for top-level calls. Direct recursion is not recorded. Names not defined anywhere in the repo (stdlib/third-party) are dropped.

**meta**

| Field | Type | Notes |
|---|---|---|
| `nodeCount` | int | |
| `edgeCount` | int | `importEdgeCount + callEdgeCount` |
| `importEdgeCount` | int | |
| `callEdgeCount` | int | file-level call-only edges |
| `callGraphEdgeCount` | int | function-level entries; includes intra-file |
| `entryPoints` | array\<string\> | node ids where `data.isEntry` |
| `orphans` | array\<string\> | node ids where `data.isOrphan` |

`GET /graph` injects `filtered`, `originalNodeCount`, `originalEdgeCount` into `meta` when filters are applied.

**Summary** (inside `summaries`)

```jsonc
{
  "path": "app/main.py",
  "summary": "Boots the FastAPI app…",
  "classification": "entry_point",
  "keywords": ["FastAPI", "CORS", "lifespan"],
  "function_summaries": [{ "name": "lifespan", "summary": "Opens Mongo/Redis/Neo4j…" }]
}
```

#### `embeddings` — vectors

One document per repo, `replace_one(upsert=True)`. **No index is declared on `repo_id`** despite every query filtering on it.

| Field | Type | Notes |
|---|---|---|
| `repo_id` | ObjectId | FK → `repos._id` |
| `status` | string | `processing` \| `complete` \| `failed` (absent doc ⇒ API reports `not_started`) |
| `started_at` | datetime | |
| `completed_at` | datetime \| null | |
| `error_msg` | string \| null | |
| `file_count` | int | 0 until complete |
| `file_embeddings` | array\<FileEmbedding\> | projected out of status responses |

```jsonc
{
  "path": "app/main.py",
  "codebert_embedding": [ /* 768 floats */ ],
  "summary_embedding":  [ /* 384 floats */ ],
  "function_embeddings": [ { "name": "lifespan", "embedding": [ /* 384 floats */ ] } ]
}
```

> **Sizing caveat.** Vectors are stored inline in a single document. MongoDB's 16 MB document cap means a large repo can overflow — roughly 1,200+ files at ~13 KB/file. This is the main scaling limit of the current design.

#### Relationships

```
repos._id ──1:1──▶ graphs.repo_id       (unique)
repos._id ──1:1──▶ embeddings.repo_id   (no index)
graphs.nodes[].id ──▶ graphs.edges[].source / .target
                  └──▶ graphs.summaries[].path
                  └──▶ graphs.callGraph[].caller_file / .callee_file
                  └──▶ embeddings.file_embeddings[].path
```

There is **no users collection** — repos are not owned by anyone (see [Known Gaps](#known-gaps)).

---

### Neo4j (optional)

Enabled with `NEO4J_ENABLED=true`. A dual-write mirror of the Mongo graph, used for GDS algorithms and native vector+graph retrieval. `sync_repo()` runs right after the embedding job completes, and wipes the repo's subgraph first (`MATCH (n {repo_id: $rid}) DETACH DELETE n`) before re-MERGEing — so it's fully idempotent, and community summaries are always regenerated afterward.

**`:File`**

| Property | Type | Written by |
|---|---|---|
| `uid` | string | sync — `"{repo_id}:{path}"`, **unique constraint** |
| `repo_id` | string | sync — scopes every query |
| `path` | string | sync |
| `language` | string | sync |
| `layer` | string | sync — from `data.classification` |
| `summary` | string | sync |
| `isEntry` | bool | sync |
| `lineCount` | int | sync |
| `embedding` | list\<float\>(384) \| null | sync — **MiniLM summary embedding, not CodeBERT** |
| `pagerank` | float | GDS |
| `community` | int | GDS Louvain |

> The 384-dim choice is deliberate: CodeBERT file cosines cluster around ~0.97 and make poor dense seeds, whereas summary embeddings spread out and discriminate.

**`:Function`** — `uid` (`"{repo_id}:{path}:{name}"`, unique), `repo_id`, `name`, `file`. Functions named `<anonymous>` are skipped.

**`:Community`** — `uid` (`"{repo_id}:{cid}"`, unique), `repo_id`, `cid`, `name` (LLM, 2–4 words), `summary` (LLM, 2–4 sentences), `size`.

**Relationships** (none carry properties):

| Pattern | Source |
|---|---|
| `(:File)-[:IMPORTS]->(:File)` | Mongo edges where `data.kind != "call"` |
| `(:File)-[:CALLS]->(:File)` | Mongo edges where `data.kind == "call"` |
| `(:File)-[:CONTAINS]->(:Function)` | node `data.functions` |
| `(:Function)-[:CALLS]->(:Function)` | `graphs.callGraph`; skips `caller == "<module>"` |
| `(:File)-[:IN_COMMUNITY]->(:Community)` | community summarization |

Direction convention: **source depends on target**.

**Constraints & indexes**

```cypher
CREATE CONSTRAINT file_uid      FOR (f:File)      REQUIRE f.uid IS UNIQUE
CREATE CONSTRAINT function_uid  FOR (fn:Function) REQUIRE fn.uid IS UNIQUE
CREATE CONSTRAINT community_uid FOR (c:Community) REQUIRE c.uid IS UNIQUE

CREATE VECTOR INDEX file_embedding FOR (f:File) ON (f.embedding)
OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: 'cosine'}}
```

`ensure_schema()` self-heals the vector index: it reads the live dimension via `SHOW INDEXES` and drops/recreates if it doesn't match. Requires Neo4j ≥ 5.11; failure is a warning, not fatal. **No index on `repo_id`** despite universal filtering — a known perf gap.

**GDS** — projection `gitsuri_{repo_id}`, File nodes only, `-[:IMPORTS|CALLS]-` matched undirected. Louvain → `File.community` (reports `communityCount`, `modularity`); PageRank → `File.pagerank`. All defaults, projection dropped in a `finally`.

---

### Redis

| Purpose | Key | TTL |
|---|---|---|
| Analysis job queue | `analysis_jobs` (`ANALYSIS_QUEUE_KEY`) | — |
| Tavily keyword cache | `kwref:v1:{normalized_keyword}` | 14 days |
| Tavily stampede lock | `kwref:v1:lock:{normalized_keyword}` | 15s |

The queue is a plain list: `LPUSH` to enqueue, `BRPOP` (5s timeout) to consume — FIFO, one job at a time. Keyword lookups use a lock + 2s poll to avoid a thundering herd on cache misses.

---

## Project Structure

```
DevClash/
├── backend/
│   ├── app/
│   │   ├── api/          # repos.py (14 routes), search.py — both prefix /api/repos
│   │   ├── db/           # mongodb.py, redis_client.py, neo4j_client.py
│   │   ├── services/
│   │   │   ├── repo_analyzer.py        # clone, walk, import edges, graph assembly
│   │   │   ├── tree_sitter_extractor.py# functions, call sites, static refs
│   │   │   ├── repo_job_processor.py   # the worker job: analyse → summarise → persist
│   │   │   ├── openrouter_ai.py        # Groq/OpenRouter, classification, summaries
│   │   │   ├── embedding_service.py    # CodeBERT + MiniLM
│   │   │   ├── search_service.py       # retrieval orchestration + answer/mermaid
│   │   │   ├── graph_rag.py            # in-memory spreading activation
│   │   │   ├── neo4j_sync.py           # Mongo → Neo4j mirror
│   │   │   ├── neo4j_algorithms.py     # GDS Louvain + PageRank
│   │   │   ├── neo4j_retrieval.py      # native Cypher hybrid retrieval
│   │   │   ├── graphrag_global.py      # community summaries + map-reduce search
│   │   │   └── keyword_references.py   # Tavily + Redis cache
│   │   ├── schemas/      # Pydantic request/response models
│   │   ├── config.py     # settings, read once at import
│   │   ├── main.py       # app, CORS, lifespan
│   │   └── worker.py     # BRPOP loop
│   ├── eval/             # retrieval A/B harness
│   ├── tests/            # pytest + fixtures per language
│   ├── docker-compose.yml
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/          # router, layout
    │   ├── pages/        # Dashboard, RepoAnalysis, RepoHistory, auth, public
    │   ├── components/   # features/{graph,panels,repo,auth,…} + ui primitives
    │   ├── store/        # Zustand: graph, repo, auth, ui, ownership, priority
    │   ├── services/     # API layer
    │   ├── hooks/        # useGraph, useBlastRadius, useNLQuery, …
    │   └── lib/          # graphUtils, mermaidRenderer, firebase, mockData
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (for Redis / Neo4j / optional Mongo)
- MongoDB Atlas account, or use the bundled local Mongo profile
- Groq API key — [console.groq.com](https://console.groq.com)

### Option A — Docker (full stack)

Compose uses profiles to keep the default `up` minimal:

```bash
cd backend
cp .env.example .env          # set MONGODB_URL + GROQ_API_KEY

docker-compose up -d                                     # redis + neo4j only
docker-compose --profile local-db up -d                  # + mongo + mongo-express
docker-compose --profile app up -d --build               # + api + worker + frontend
docker-compose --profile app --profile local-db up -d --build   # everything
```

| Service | URL |
|---|---|
| API | http://localhost:8000 (docs at `/docs`) |
| Frontend | http://localhost:5173 |
| Neo4j Browser | http://localhost:7474 |
| Mongo Express | http://localhost:8081 (`local-db` profile) |

The `app` profile sets `NEO4J_ENABLED=true` automatically. `api` and `worker` share a `repo_cache` volume — the API reads clones the worker wrote — and an `hf_cache` volume so HuggingFace models aren't re-downloaded.

### Option B — Local

```bash
# ── Backend ──
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate

# torch first, CPU-only — ~200MB vs ~3GB for the CUDA build
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

cp .env.example .env                 # set MONGODB_URL + GROQ_API_KEY

docker-compose up -d                 # redis (+ neo4j)

uvicorn app.main:app --reload --port 8000   # terminal 1
python -m app.worker                        # terminal 2 — REQUIRED, or jobs sit in the queue
```

```bash
# ── Frontend ──
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

> The worker is a **separate process**. Without it, submitted repos stay `pending` forever.

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URL` | **Yes** | `""` | Mongo connection string; fails at connect, not startup |
| `MONGODB_DB_NAME` | No | `repomap` | |
| `REDIS_URL` | No | `redis://localhost:6379/0` | |
| `LOG_LEVEL` | No | `INFO` | |
| `LLM_PROVIDER` | No | `groq` | `groq` or `openrouter` |
| `GROQ_API_KEY` | Yes* | `""` | |
| `GROQ_API_URL` | No | `https://api.groq.com/openai/v1/chat/completions` | |
| `GROQ_TIMEOUT_SECONDS` | No | `60` | |
| `GROQ_MODEL_SUMMARIES` | No | `llama-3.3-70b-versatile` | used for **search answers**, not summaries |
| `GROQ_MODEL_FILE_REASONS` | No | `llama-3.1-8b-instant` | used for **all summary tasks** |
| `OPENROUTER_API_KEY` | Yes* | `""` | |
| `OPENROUTER_API_URL` | No | `https://openrouter.ai/api/v1/chat/completions` | |
| `OPENROUTER_MODEL` | No | `openai/gpt-4o-mini` | |
| `OPENROUTER_TIMEOUT_SECONDS` | No | `60` | |
| `OPENROUTER_SITE_URL` | No | `""` | `HTTP-Referer` header |
| `OPENROUTER_APP_NAME` | No | `DevClash` | `X-Title` header |
| `NEO4J_ENABLED` | No | `false` | truthy: `1`/`true`/`yes` |
| `NEO4J_URI` | No | `bolt://localhost:7687` | |
| `NEO4J_USER` | No | `neo4j` | |
| `NEO4J_PASSWORD` | No | `""` | must match `NEO4J_AUTH` in compose |
| `NEO4J_DATABASE` | No | `neo4j` | |
| `TAVILY_API_KEY` | No | `""` | enables keyword references |
| `TAVILY_CACHE_PREFIX` | No | `kwref:v1` | |
| `TAVILY_CACHE_TTL_SECONDS` | No | `1209600` | 14 days |
| `TAVILY_LOCK_TTL_SECONDS` | No | `15` | |
| `TAVILY_LOCK_WAIT_MS` | No | `2000` | |
| `REPO_CLONE_BASE_DIR` | No | `.repo_cache` | |
| `CLONE_TIMEOUT_SECONDS` | No | `120` | |
| `ANALYSIS_QUEUE_KEY` | No | `analysis_jobs` | |
| `FRONTEND_ORIGINS` | No | `localhost:5173,127.0.0.1:5173,localhost:4173,127.0.0.1:4173` | CSV CORS origins |

\* One of `GROQ_API_KEY` / `OPENROUTER_API_KEY` is required.

Notes:
- `NEO4J_VECTOR_DIM` is **not** env-readable — hardcoded to `384` in `config.py`. Any value in `.env` is ignored.
- The model setting names are inverted relative to use: `GROQ_MODEL_SUMMARIES` (70b) serves search answers, `GROQ_MODEL_FILE_REASONS` (8b) serves summaries.
- `config.py` resolves values **at import time**, so changing `.env` requires a restart.

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (preferred) |
| `VITE_API_BASE_URL` | Fallback alias |

Neither is required in dev — the client falls back to `http://localhost:8000`. There's no `.env.example`; Firebase config is hardcoded in `src/lib/firebase.ts` rather than env-driven.

---

## API Reference

Both routers mount at `/api/repos`. No authentication is enforced on any endpoint.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | `{"status": "ok"}` |
| `GET` | `/api/repos` | List repos, newest first (`?limit=1..100`, default 20) |
| `POST` | `/api/repos` | Submit a repo. Returns the existing job if one is already `pending`/`analyzing`/`complete` |
| `GET` | `/api/repos/{id}` | Job status + progress — **this is the polling endpoint** |
| `GET` | `/api/repos/{id}/graph` | Nodes, edges, callGraph, meta. `?language=` `?path_prefix=`. 409 unless complete |
| `GET` | `/api/repos/{id}/summaries` | Pre-computed AI summaries + classifications |
| `GET` | `/api/repos/{id}/files/{path}` | File detail: source, functions, imports, dependents |
| `GET` | `/api/repos/{id}/file-references` | Tavily doc/tutorial links. `?file_path=` **required** |
| `POST` | `/api/repos/{id}/search` | Graph-RAG search → ranked flow, LLM answer, Mermaid |
| `POST` | `/api/repos/{id}/embeddings` | Kick off embedding (runs in-process, not on the worker) |
| `GET` | `/api/repos/{id}/embeddings/status` | Embedding status; `not_started` (200) if never run |
| `POST` | `/api/repos/{id}/cancel` | Dequeue if pending, else cooperative cancel |
| `POST` | `/api/repos/{id}/retry` | Reset to pending, drop the graph, re-enqueue |
| `GET` | `/api/repos/{id}/insights` | GDS communities + PageRank top 15. **409 without Neo4j** |
| `POST` | `/api/repos/{id}/communities/summarize` | Re-run LLM community summarization. **409 without Neo4j** |
| `POST` | `/api/repos/{id}/global-search` | GraphRAG global map-reduce over communities. **409 without Neo4j** |

**Search request:**

```jsonc
{
  "query": "where is authentication handled?",  // 1..500 chars
  "top_files": 8,        // 1..20
  "top_functions": 5,    // 1..10
  "min_score": 0.30,     // 0..1
  "use_graph": true      // false = pure vector top-k
}
```

Response: `{query, repo_id, total_matched, flow[], answer, mermaid, retrieval}`. Each `flow` entry carries `rank`, `file_path`, `relevance_score`, `score_breakdown`, `layer`, `matched_functions[]`, and — in hybrid mode — provenance: `retrieved_via` (`vector`/`graph`), `hop_distance` (0 = seed), `graph_boost`, `cosine_score`. `retrieval.mode` is `neo4j_hybrid`, `hybrid_graph`, or `vector_only`.

`/global-search` accepts the same body but **only reads `query`** — the other fields are ignored.

Two GETs mutate state: `/graph` backfills missing `lineCount`, and `/files/{path}` may trigger a `git clone` if the cached clone is gone.

---

## File Classification Labels

The LLM assigns each file exactly one label. Invalid or missing values fall back to a deterministic path heuristic (`/tests/` → `test`, `/routes/` → `api`, …), and finally to `business_logic`. This value becomes `File.layer` in Neo4j and drives node grouping in the collapsed view.

| Label | Description |
|---|---|
| `entry_point` | Application entry, bootstrapping |
| `api` | Routes, controllers, request handlers |
| `middleware` | Request/response pipeline, interceptors |
| `business_logic` | Core domain services and use-cases |
| `integration` | Third-party API clients, external services |
| `data_access` | Database queries, repositories, ORMs |
| `ui` | Frontend components and views |
| `utility` | Shared helpers |
| `background_jobs` | Async workers, scheduled tasks, queues |
| `config` | Configuration, environment, constants |
| `test` | Test suites, fixtures, mocks |

---

## Testing & Evaluation

```bash
cd backend
pytest                    # parser, call-graph, Neo4j, and GraphRAG unit tests
```

Fixtures under `tests/fixtures/` cover each supported language.

**Retrieval eval** — A/B of vector-only vs hybrid Graph-RAG on `recall@k`, `precision@k`, MRR, and `hit@1`. It reads Mongo directly and **never calls the LLM**, so it's fast and free to run while tuning `DEFAULT_SEED_COUNT` / `MAX_HOPS` / `DECAY` / `ALPHA`.

```bash
cd backend
cp eval/dataset.example.json eval/dataset.json   # fill in real repo_ids
python -m eval.run_eval --k 10
```

Dataset format:

```json
[
  {
    "repo_id": "6a1f…",
    "query": "where is authentication handled?",
    "expected": ["app/api/auth.py", "app/middleware/auth_guard.py"]
  }
]
```

Aim for 10–20 queries, and pick ones where the right file *doesn't* share vocabulary with the question — that's where Graph-RAG earns its keep. Note the harness never calls `connect_to_neo4j()`, so its `hybrid_graph` arm always exercises the **in-memory** path regardless of `NEO4J_ENABLED`.

---

## Known Gaps

Documented honestly rather than discovered later.

**Security**
- **The backend validates nothing.** The client attaches a Firebase ID token on every request, but there's no `firebase-admin`, no auth middleware, and no dependency checking it. Every `/api/repos/*` endpoint is fully open — route guards are cosmetic.
- **Repos have no owner.** No users collection, no per-user scoping, so there's no data isolation to enforce even if auth were added.

**Frontend/backend contract**
- `socketService.ts` targets a Socket.IO server that doesn't exist. All seven listeners are unreferenced; live progress is TanStack Query polling. `socket.io-client` is removable.
- Several client services call endpoints with no backend counterpart: `/api/auth/*`, `/heatmap`, `/flow`, `/ownership*`, `/priority*`. Conversely `/insights`, `/communities/summarize`, and `/global-search` exist but are never called.
- `mockData.ts` seeds **live store state** — Dashboard and RepoHistory read the store without fetching, so they can show demo repos to a real user.
- Auth fallbacks are unsafe in dev: `loginUser` catches any Firebase error and can return a hardcoded `demo.jwt.token` for any credentials. `registerUser` never touches Firebase. Password reset never calls Firebase. The persisted token is never refreshed and goes stale after ~1h.

**Backend**
- `file_embeddings` inline in one doc will hit Mongo's 16 MB cap on large repos (~1,200+ files).
- No index on `embeddings.repo_id` or Neo4j `File.repo_id`, though both filter on it universally.
- `/file-references` fetches Tavily serially per keyword with no bound — slow for keyword-heavy files.
- The worker's `while True` has no exception guard around `process_repo_job`, so an unhandled error kills the loop.
- The two Graph-RAG implementations score differently (normalized vs not, MiniLM-only vs composite), so results aren't directly comparable across modes.
- `.env.example` sets `GROQ_MODEL_FILE_REASONS` to a Llama-4 Scout model while `config.py` defaults to `llama-3.1-8b-instant`.
- No file-count or file-size limits in the analyzer — a very large repo will simply take a long time.

---

## License

MIT
