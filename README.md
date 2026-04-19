# GitSuri

> AI-powered repository analysis and interactive codebase visualization.

GitSuri clones any public GitHub repository, parses its source files with Tree-sitter, builds a live dependency graph, and lets developers explore the architecture through an interactive canvas — with AI-generated file summaries, semantic code search, contributor ownership views, and a beginner-friendly collapsed pipeline mode.

Built for DevClash 2026.

---

## 🚀 Features

- **Interactive dependency graph** — nodes represent files, edges represent imports. Pan, zoom, click any node to inspect.
- **Collapsed pipeline view** — files grouped by AI-assigned classification into a horizontal left-to-right dependency flow.
- **AI file classification** — assigns roles like `entry_point`, `api`, `business_logic`, etc.
- **AI summaries** — per-file and per-function summaries using LLMs.
- **Semantic code search** — ask questions like *"where is auth handled?"*
- **Priority ranking** — highlights important files to start reading.
- **Ownership view** — contributor insights per file.
- **Keyword references** — links to docs and tutorials.
- **Real-time progress** — live pipeline tracking.
- **Multi-language support** — Python, TS/JS, Go, Rust, C/C++.

---

## 🏗️ Architecture


```
┌─────────────────────────────────┐     ┌──────────────────────────────────────┐
│           Frontend              │     │              Backend                  │
│  React 19 + TypeScript + Vite   │────▶│  FastAPI + Motor (async MongoDB)      │
│  XYFlow  ·  Framer Motion       │     │  Redis queue  ·  Background worker    │
│  Zustand ·  TanStack Query      │     │  Tree-sitter  ·  Groq / OpenRouter    │
│  D3 force layout                │     │  CodeBERT embeddings  ·  Tavily       │
└─────────────────────────────────┘     └──────────────────────────────────────┘
                                                        │
                                          ┌─────────────┴──────────────┐
                                          │         MongoDB             │
                                          │  repos · graphs · summaries │
                                          │  embeddings · job status    │
                                          └─────────────────────────────┘
```

**Analysis pipeline:**
1. Job submitted → pushed to Redis queue
2. Worker clones repo via git
3. Tree-sitter parses files → extracts functions, imports, dependency edges
4. Dependency graph written to MongoDB
5. LLM (Llama 3.3-70b) classifies and summarizes each file
6. CodeBERT encodes file chunks → stored as embeddings for search

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| Graph canvas | XYFlow (React Flow), D3 force simulation |
| Animations | Framer Motion |
| State | Zustand |
| Data fetching | TanStack Query, Axios |
| Code display | Monaco Editor |
| Backend framework | FastAPI, Uvicorn |
| Database | MongoDB (Motor async driver) |
| Queue / cache | Redis 7 |
| AST parsing | Tree-sitter (Python, JS/TS, Go, Rust, C/C++) |
| LLM | Groq (Llama 3.3-70b / Llama 3.1-8b) or OpenRouter |
| Embeddings | Sentence-Transformers (CodeBERT + MiniLM) |
| Web search | Tavily API |

---

## Project Structure

```
DevClash/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── services/     # Analysis, embedding, search, AI services
│   │   ├── schemas/      # Pydantic request/response models
│   │   ├── config.py     # Settings from environment
│   │   └── main.py       # App entrypoint, CORS, startup hooks
│   ├── requirements.txt
│   ├── docker-compose.yml
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/        # Dashboard, RepoAnalysis, RepoHistory, Auth
    │   ├── components/   # Graph canvas, panels, layout, UI primitives
    │   ├── store/        # Zustand stores (graph, repo, ownership, priority)
    │   ├── services/     # API call layer (graphService, repoService)
    │   ├── lib/          # Adapters, graph utils, constants, mock data
    │   └── types/        # Shared TypeScript types
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (for Redis) or a local Redis instance
- MongoDB Atlas account (or local MongoDB)
- Groq API key — [console.groq.com](https://console.groq.com)

### 1. Clone

```bash
git clone https://github.com/TanmayNawlakhe/DevClash.git
cd DevClash
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URL and GROQ_API_KEY at minimum

# Start Redis (Docker)
docker-compose up -d

# Run the API server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URL` | Yes | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | No | Database name (default: `repomap`) |
| `REDIS_URL` | No | Redis URL (default: `redis://localhost:6379/0`) |
| `GROQ_API_KEY` | Yes* | Groq API key for LLM summaries |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter key (if `LLM_PROVIDER=openrouter`) |
| `LLM_PROVIDER` | No | `groq` (default) or `openrouter` |
| `TAVILY_API_KEY` | No | Enables keyword reference links |
| `FRONTEND_ORIGINS` | No | Comma-separated CORS origins |
| `REPO_CLONE_BASE_DIR` | No | Local path for cloned repos (default: `.repo_cache`) |

*One of `GROQ_API_KEY` or `OPENROUTER_API_KEY` is required.

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/repos` | Submit a GitHub repo for analysis |
| `GET` | `/api/repos` | List all analyzed repos |
| `GET` | `/api/repos/{id}` | Get repo status and progress |
| `GET` | `/api/repos/{id}/graph` | Fetch dependency graph (nodes + edges) |
| `GET` | `/api/repos/{id}/summaries` | Get AI file summaries and classifications |
| `GET` | `/api/repos/{id}/files/{path}` | File detail with source code and functions |
| `POST` | `/api/repos/{id}/search` | Semantic search with LLM answer |
| `GET` | `/api/repos/{id}/embedding-status` | Embedding job status |
| `POST` | `/api/repos/{id}/retry` | Retry a failed analysis |
| `DELETE` | `/api/repos/{id}` | Cancel and delete a repo |

---

## File Classification Labels

The AI assigns each file one of 11 classification labels used to group nodes in the graph:

| Label | Description |
|---|---|
| `entry_point` | Application entry, bootstrapping |
| `api` | Routes, controllers, request handlers |
| `middleware` | Request/response pipeline, interceptors |
| `business_logic` | Core domain services and use-cases |
| `integration` | Third-party API clients, external services |
| `data_access` | Database queries, repositories, ORMs |
| `ui` | Frontend components and views |
| `utility` | Shared helpers and utility functions |
| `background_jobs` | Async workers, scheduled tasks, queues |
| `config` | Configuration, environment, constants |
| `test` | Test suites, fixtures, mocks |

---

## License

MIT
