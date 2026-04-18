# 🗺️ Repository Architecture Navigator
## DevClash 2026 — 24-Hour Hackathon Battle Plan

> **Mission:** Build a SaaS-grade developer productivity tool that turns any GitHub repo into an interactive, AI-explained visual architecture map — in 24 hours.

---

## 📋 Table of Contents

1. [Product Vision](#product-vision)
2. [Feature Prioritization (MoSCoW)](#feature-prioritization)
3. [System Architecture](#system-architecture)
4. [Tech Stack](#tech-stack)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [24-Hour Execution Timeline](#24-hour-execution-timeline)
8. [Team Roles](#team-roles)
9. [Innovative Differentiators](#innovative-differentiators)
10. [New Core Features](#new-core-features)
11. [Deployment Strategy](#deployment-strategy)

---

## 🎯 Product Vision

**RepoMap** — _"Understand any codebase in 10 minutes, not 10 weeks."_

A developer drops in a GitHub URL. Within 60 seconds, they get:
- A living, interactive graph of the entire codebase
- AI-generated plain-English explanations on every node
- A personalized onboarding path — the exact order to read files
- Risk hotspots — files where a change can break everything
- Natural language answers: "Where is auth handled?"
- **Ownership Graph** — who owns what, overlaid on the dependency map via git blame
- **Functional & Data Flow Diagrams** — AI-generated flowcharts for any file, folder, or cross-module selection
- **Priority Graph** — a ranked, weighted map of what to understand first, scored by impact and complexity

---

## 📊 Feature Prioritization

### 🔴 Must Have (Core — ship by Hour 16)
| Feature | Description |
|---|---|
| GitHub URL Ingestion | Clone/fetch repo, traverse file tree |
| Static Dependency Graph | Extract imports, require, from statements across JS/TS/Python/Go |
| Interactive Force Graph | Zoomable, clickable React-Flow graph of all modules |
| File Detail Panel | Click any node → see its imports, dependents, and AI summary |
| AI Summaries | Each file gets a 2-sentence plain-English purpose description |
| Entry Point Detection | Auto-detect main.py, index.ts, app.js, cmd/, etc. |
| Onboarding Path Generator | Ordered reading list for a new developer |
| **Priority Graph** | Weighted, ranked graph of which files/modules to understand first — scored by centrality, cognitive load, and layer importance |
| **Functional & Data Flow Diagrams** | AI-generated Mermaid flowcharts for any selected file or folder showing how data and control flow through it |

### 🟡 Should Have (Differentiators — ship by Hour 20)
| Feature | Description |
|---|---|
| Risk Heatmap | Color-code files by fan-in (how many files depend on them) |
| Layer Detection | Auto-classify: API layer, Business Logic, Data Access, Utils, Config |
| NL Query Interface | "Show me the payment flow" → highlights subgraph |
| Orphan/Dead Code Detection | Files with zero imports and zero dependents |
| Multi-language Support | JS/TS + Python + Go simultaneously |
| **Ownership Graph** | Git blame-powered overlay: each node shows primary author, % ownership, and last-touch date — filter the entire graph by contributor |
| **Multi-file Flow Diagram** | Select multiple files or an entire folder → generate a unified cross-module data + functional flow diagram |

### 🟢 Nice to Have (Wow Factor — if time permits)
| Feature | Description |
|---|---|
| Commit History Evolution | Animate how the graph changed over time |
| PR Impact Preview | Paste a PR diff → see which nodes are affected |
| Team Ownership Map | Who wrote what — overlay git blame on graph |
| Export to Confluence/Notion | One-click architecture doc generation |
| Ownership Timeline | Animate how team ownership of each module shifted over git history |
| Flow Diagram Export | Download any functional/data flow diagram as PNG or Mermaid source |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│     React 18 (Vite) │ React-Flow Graph │ shadcn/ui          │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / WebSocket
┌─────────────────▼───────────────────────────────────────────┐
│                    API GATEWAY (FastAPI)                      │
│         Auth (JWT) │ Rate Limiting │ Job Queue Status        │
└────────┬────────────────────────────────────┬───────────────┘
         │                                    │
┌────────▼──────────┐              ┌──────────▼──────────────┐
│  Analysis Worker  │              │   AI Summarization       │
│  (FastAPI/Celery) │              │   Worker (FastAPI)       │
│                   │              │                          │
│ • Git Clone       │              │ • Claude API Calls       │
│ • AST Parsing     │              │ • Batch file summaries   │
│ • Graph Building  │              │ • NL Query embedding     │
│ • Layer Detection │              │ • Vector search          │
│ • git blame →     │              │ • Flow diagram gen       │
│   Ownership Graph │              │ • Priority scoring       │
└────────┬──────────┘              └──────────┬──────────────┘
         │                                    │
┌────────▼────────────────────────────────────▼───────────────┐
│                         DATA LAYER                           │
│  MongoDB (graph data, metadata, summaries)                   │
│  Redis (Celery task queue + cache)                           │
│  MongoDB Atlas Vector Search (embeddings for NL search)      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (GitHub URL)
        │
        ▼
  [Job Created] ──► Redis / Celery Queue
        │
        ▼
  [Worker Picks Up]
        │
        ├── 1. git clone --depth=1 <repo>
        ├── 2. Walk file tree, build file list
        ├── 3. Parse each file with AST (language-specific)
        ├── 4. Build adjacency list (imports graph)
        ├── 5. Compute PageRank-style centrality scores
        ├── 6. Classify layers (heuristic + AI)
        ├── 7. Detect entry points & orphans
        ├── 8. Run git blame → build Ownership Graph (author per file/line)
        ├── 9. Compute Priority Score per file (centrality + CLS + layer weight)
        └── 10. Store graph documents in MongoDB
                    │
                    ▼
        [AI Worker Picks Up]
                    │
                    ├── Batch file contents → Claude API
                    ├── Generate 2-sentence summaries
                    ├── Generate embeddings (for NL search)
                    ├── Generate Functional & Data Flow Mermaid diagrams per file/folder
                    └── Store summaries + vectors + diagrams in MongoDB
                                │
                                ▼
                    [WebSocket Push to Client]
                    Graph renders progressively
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose | Why |
|---|---|---|
| **React 18** (Vite) | Frontend SPA | Fast HMR, lightweight, no SSR complexity needed |
| **React Router v6** | Client-side routing | Simple SPA routing for web |
| **React Flow** | Interactive graph visualization | Best-in-class for node graphs, zoom/pan built-in |
| **D3.js** | Custom force simulation & layouts | Fine-grained control over graph physics |
| **shadcn/ui + Tailwind CSS** | UI components | Beautiful, accessible, fast to build |
| **Zustand** | Client state management | Lightweight, perfect for graph state |
| **TanStack Query** | Server state + polling | Job status polling, cache management |
| **Socket.io Client** | Real-time progress updates | Stream analysis progress to user |
| **Framer Motion** | Animations | Smooth graph transitions and reveals |
| **Monaco Editor** | Code preview in side panel | VSCode-quality code view on file click |
| **Axios** | HTTP client | Clean REST calls to FastAPI backend |
| **Mermaid.js** | Flow diagram rendering | Render AI-generated functional & data flow diagrams inline |

### Backend — FastAPI (Unified)
| Technology | Purpose | Why |
|---|---|---|
| **Python 3.11** | Core runtime | Best AST tooling + FastAPI ecosystem |
| **FastAPI** | REST API + WebSocket server | Async, fast, auto-docs, perfect fit |
| **python-jose / PyJWT** | Authentication (JWT) | Lightweight JWT auth, no third-party SaaS needed |
| **passlib + bcrypt** | Password hashing | Industry standard for credential security |
| **Celery** | Background job queue | Distributed task processing for heavy analysis |
| **python-socketio** | WebSocket server | Real-time job progress streaming to React |
| **pydantic v2** | Input validation + data models | Type-safe contracts, FastAPI native |
| **httpx** | Async HTTP client | Calling GitHub API from FastAPI |
| **GitPython / subprocess** | Repo cloning | Simple, battle-tested |
| **ast (stdlib)** | Python AST parsing | No external deps needed |
| **tree-sitter** | Universal polyglot parsing | One library for 40+ languages (JS/TS/Go) |
| **NetworkX** | Graph algorithms | PageRank, centrality, shortest paths |
| **pydriller** | Git history + blame analysis | Commit-level code evolution + Ownership Graph data |
| **Motor** | Async MongoDB driver | Non-blocking MongoDB I/O, FastAPI-native |
| **Beanie** | ODM for MongoDB | Pydantic-based document models, clean schema |

### AI Layer
| Technology | Purpose | Why |
|---|---|---|
| **Anthropic Claude API** | Code summarization + NL queries | Best code understanding, long context |
| **claude-haiku-4-5** | Fast bulk summaries | Cheap + fast for per-file summaries |
| **claude-sonnet-4-6** | NL query understanding | Better reasoning for complex queries |
| **OpenAI text-embedding-3-small** | Vector embeddings | Cheap, fast embeddings for NL search |
| **MongoDB Atlas Vector Search** | Vector similarity search | Native to MongoDB, no extra infra |

### Data Layer
| Technology | Purpose | Why |
|---|---|---|
| **MongoDB 7** | Primary database | Flexible documents perfect for graph data, metadata, summaries |
| **MongoDB Atlas Vector Search** | Embedding storage + NL search | Native vector indexing, no pgvector needed |
| **Redis 7** | Celery broker + result backend + cache | Celery requires it; cache parsed graphs |
| **Beanie ODM** | Document modeling | Type-safe MongoDB access with Pydantic models |

### Infrastructure & Deployment
| Technology | Purpose | Why |
|---|---|---|
| **Netlify / Vercel** | React SPA hosting | Zero-config static deploy with CDN |
| **Railway / Render** | FastAPI backend + Celery workers | One-click Python hosting, Redis + worker support |
| **MongoDB Atlas** | Managed MongoDB + Vector Search | Free tier, built-in vector search, reliable |
| **Cloudflare R2** | Cloned repo temp storage | S3-compatible, cheaper than S3 |
| **Docker + docker-compose** | Local development | Consistent dev environment |
| **GitHub Actions** | CI/CD pipeline | Auto-deploy on push |

---

## 🗄️ Database Schema (MongoDB Collections)

```javascript
// ── repos collection ──────────────────────────────────────────
{
  _id: ObjectId,
  github_url: String,          // unique
  owner: String,
  name: String,
  branch: String,              // default: "main"
  languages: [String],         // ["python", "typescript"]
  status: String,              // "pending"|"analyzing"|"ai_processing"|"complete"|"failed"
  created_at: Date,
  completed_at: Date,
  error_msg: String
}

// ── files collection ──────────────────────────────────────────
{
  _id: ObjectId,
  repo_id: ObjectId,           // ref: repos._id
  path: String,                // "src/auth/login.ts"
  language: String,
  lines: Number,
  size_bytes: Number,
  layer: String,               // "api"|"business_logic"|"data"|"util"|"config"|"test"
  is_entry: Boolean,
  is_orphan: Boolean,
  centrality: Number,          // PageRank score (risk score)
  cognitive_load_score: Number,// CLS composite metric
  summary: String,             // AI-generated plain English description
  embedding: [Number],         // 1536-dim vector for NL search
  // compound index on (repo_id, path) for uniqueness
}

// ── dependencies collection ───────────────────────────────────
{
  _id: ObjectId,
  repo_id: ObjectId,           // ref: repos._id
  from_file: ObjectId,         // ref: files._id
  to_file: ObjectId,           // ref: files._id
  import_type: String,         // "direct"|"dynamic"|"type_only"|"re_export"
  symbol: String               // specific imported symbol
}

// ── onboarding_paths collection ───────────────────────────────
{
  _id: ObjectId,
  repo_id: ObjectId,           // ref: repos._id
  ordered_files: [ObjectId],   // ordered array of file _ids
  reasoning: String,
  created_at: Date
}

// ── nl_queries collection ─────────────────────────────────────
{
  _id: ObjectId,
  repo_id: ObjectId,
  query: String,
  result_file_ids: [ObjectId],
  created_at: Date
}

// ── ownership collection ───────────────────────────────────────
// One document per file, capturing git blame aggregated ownership
{
  _id: ObjectId,
  repo_id: ObjectId,           // ref: repos._id
  file_id: ObjectId,           // ref: files._id
  path: String,
  owners: [
    {
      author: String,          // "Jane Doe"
      email: String,
      commit_count: Number,
      lines_owned: Number,
      ownership_pct: Number,   // 0.0 – 1.0
      last_commit_date: Date
    }
  ],
  primary_owner: String,       // author with highest ownership_pct
  last_touched: Date
}

// ── flow_diagrams collection ──────────────────────────────────
// Stores AI-generated Mermaid diagrams for files or folder selections
{
  _id: ObjectId,
  repo_id: ObjectId,
  scope: String,               // "file" | "folder" | "multi_file"
  target_ids: [ObjectId],      // file _ids or folder path references
  target_paths: [String],      // human-readable paths for display
  diagram_type: String,        // "functional_flow" | "data_flow" | "combined"
  mermaid_source: String,      // raw Mermaid diagram definition
  plain_english: String,       // AI prose explanation of the flow
  created_at: Date
}

// ── priority_graph collection ─────────────────────────────────
// Pre-computed priority ranking of all files for onboarding
{
  _id: ObjectId,
  repo_id: ObjectId,
  ranked_files: [
    {
      file_id: ObjectId,
      path: String,
      priority_score: Number,  // composite score (see formula below)
      rank: Number,            // 1 = highest priority to understand first
      reason: String           // AI-generated one-liner: "Core auth module, 14 dependents"
    }
  ],
  scoring_breakdown: {
    centrality_weight: 0.35,
    cognitive_load_weight: 0.30,
    layer_weight: 0.20,        // entry/API layers weighted higher
    ownership_clarity_weight: 0.15  // single owner = easier to ask for help
  },
  created_at: Date
}
```

### MongoDB Indexes
```javascript
// repos
db.repos.createIndex({ github_url: 1 }, { unique: true })

// files
db.files.createIndex({ repo_id: 1 })
db.files.createIndex({ repo_id: 1, path: 1 }, { unique: true })
// Atlas Vector Search index on `embedding` field (cosine similarity)

// dependencies
db.dependencies.createIndex({ repo_id: 1 })
db.dependencies.createIndex({ from_file: 1 })
db.dependencies.createIndex({ to_file: 1 })

// ownership
db.ownership.createIndex({ repo_id: 1 })
db.ownership.createIndex({ file_id: 1 }, { unique: true })
db.ownership.createIndex({ repo_id: 1, primary_owner: 1 })

// flow_diagrams
db.flow_diagrams.createIndex({ repo_id: 1 })
db.flow_diagrams.createIndex({ repo_id: 1, scope: 1 })

// priority_graph
db.priority_graph.createIndex({ repo_id: 1 }, { unique: true })
```

---

## 🔌 API Design

### REST Endpoints (FastAPI)

```
POST   /api/repos                    → Submit GitHub URL for analysis
GET    /api/repos/{id}               → Get repo status + metadata
GET    /api/repos/{id}/graph         → Full graph JSON (nodes + edges)
GET    /api/repos/{id}/files/{file_id} → File detail + code preview
GET    /api/repos/{id}/onboarding    → Recommended reading path
POST   /api/repos/{id}/query         → NL natural language query
GET    /api/repos/{id}/heatmap       → Risk centrality scores

# Ownership Graph
GET    /api/repos/{id}/ownership              → Full ownership graph (all files + authors)
GET    /api/repos/{id}/ownership/{file_id}    → Ownership breakdown for a single file
GET    /api/repos/{id}/ownership/author/{name} → Filter graph to files owned by author

# Functional & Data Flow Diagrams
POST   /api/repos/{id}/flow                  → Generate flow diagram (body: { file_ids[], diagram_type })
GET    /api/repos/{id}/flow/{diagram_id}     → Retrieve a previously generated diagram

# Priority Graph
GET    /api/repos/{id}/priority              → Full priority-ranked file list with scores + reasons
GET    /api/repos/{id}/priority/graph        → Priority graph as nodes+edges (for React Flow render)

POST   /api/auth/register            → Create account (email + password)
POST   /api/auth/login               → Login → returns JWT access token
GET    /api/auth/me                  → Get current user from JWT
```

### Authentication Flow
```
POST /api/auth/login
  Body: { email, password }
  Response: { access_token, token_type: "bearer" }

All protected routes:
  Header: Authorization: Bearer <access_token>
  FastAPI Depends(get_current_user) extracts + validates JWT
```

### WebSocket Events (python-socketio via FastAPI)

```
Client joins room: repo:{id}

Server emits:
  analysis:started       → { repo_id, estimated_time }
  analysis:progress      → { stage, percent, current_file }
  analysis:graph_ready   → { node_count, edge_count }
  ai:summary_batch       → { file_ids, summaries }  (streamed as they complete)
  analysis:complete      → { repo_id }
  analysis:error         → { message }
```

### Graph JSON Structure

```json
{
  "nodes": [
    {
      "id": "mongo-object-id",
      "path": "src/auth/login.ts",
      "label": "login.ts",
      "layer": "api",
      "isEntry": false,
      "isOrphan": false,
      "centrality": 0.87,
      "cognitiveLoadScore": 0.74,
      "priorityScore": 0.91,
      "priorityRank": 3,
      "priorityReason": "Core auth module — 14 files depend on it, entry to all protected routes",
      "primaryOwner": "Jane Doe",
      "ownershipPct": 0.82,
      "lines": 142,
      "summary": "Handles JWT token validation and user session creation. Called by all protected route middleware.",
      "language": "typescript",
      "hasFlowDiagram": true
    }
  ],
  "edges": [
    {
      "id": "mongo-object-id",
      "source": "node-id-a",
      "target": "node-id-b",
      "importType": "direct",
      "symbol": "validateToken"
    }
  ],
  "meta": {
    "entryPoints": ["id-1", "id-2"],
    "highRiskFiles": ["id-3"],
    "orphans": ["id-4"],
    "layerCounts": { "api": 12, "business_logic": 34, "data": 8 }
  }
}
```

---

## ⏱️ 24-Hour Execution Timeline

### Hour 0–2 | Foundation Sprint
- [ ] Team sync: assign roles, agree on API contracts + MongoDB document shapes
- [ ] Project setup: `packages/web` (Vite + React) + `packages/api` (FastAPI)
- [ ] Docker Compose: MongoDB + Redis + FastAPI + Celery worker
- [ ] JWT auth skeleton (register/login endpoints + `get_current_user` dependency)
- [ ] Beanie ODM: define all document models + indexes
- [ ] Celery task queue skeleton with Redis broker
- [ ] CORS configured: FastAPI allows React dev origin

### Hour 2–6 | Core Analysis Engine (FastAPI + Celery)
- [ ] Celery task: git clone + file tree walker
- [ ] Python AST parser → import extractor
- [ ] TypeScript/JS parser (tree-sitter) → import extractor
- [ ] Build adjacency list → NetworkX graph
- [ ] PageRank centrality computation
- [ ] Entry point heuristics (main, index, app, cmd/)
- [ ] Layer classification (heuristic rules first, AI if time)
- [ ] Orphan detection (zero in-degree AND zero out-degree)
- [ ] **git blame via pydriller → aggregate per-file ownership → store in `ownership` collection**
- [ ] **Priority Score computation: `centrality(0.35) + CLS(0.30) + layer_weight(0.20) + ownership_clarity(0.15)` → store ranked list in `priority_graph` collection**
- [ ] Write graph documents to MongoDB via Motor/Beanie
- [ ] Emit WebSocket progress events via python-socketio

### Hour 6–10 | Frontend Graph MVP (React + Vite)
- [ ] Landing page with GitHub URL input
- [ ] Auth pages: Login / Register (calls FastAPI JWT endpoints)
- [ ] Axios instance with JWT Authorization header interceptor
- [ ] Job submission → Zustand job state → Socket.io room join
- [ ] Progress indicator (animated, shows stage)
- [ ] React Flow graph canvas renders nodes + edges
- [ ] Color coding by layer (pastel palette)
- [ ] Node size by centrality score
- [ ] Click node → right panel with file path + stats + primary owner badge
- [ ] Basic zoom/pan/minimap
- [ ] **Priority Graph view toggle** — re-layout graph with node size and label driven by priority rank instead of centrality
- [ ] **Ownership Graph view toggle** — color nodes by primary owner (auto-palette per contributor)

### Hour 10–14 | AI Integration + New Feature Backends
- [ ] Celery task: batch file content → Claude Haiku for summaries
- [ ] Stream summaries back via WebSocket as they complete
- [ ] Update MongoDB file documents with summaries + embeddings
- [ ] Node tooltips show AI summary (React side)
- [ ] Onboarding path generator (NL-guided BFS from entry points)
- [ ] Onboarding path UI — numbered step list in sidebar
- [ ] **Flow Diagram generation**: FastAPI endpoint accepts `file_ids[]` + `diagram_type` → sends file contents + dependency context to Claude Sonnet → returns Mermaid source + plain-English explanation → stored in `flow_diagrams` collection
- [ ] **Flow Diagram UI**: right-click any node or multi-select → "Generate Flow Diagram" button → Mermaid.js renders diagram in modal/side panel
- [ ] **Priority Graph UI**: dedicated tab renders React Flow with nodes sized/ranked by `priority_score`; sidebar shows ranked list with AI reason per file

### Hour 14–18 | Polish + Risk Heatmap + NL Query + Ownership
- [ ] Risk heatmap: red gradient on high-centrality nodes
- [ ] "High Risk" badge on top-5 files
- [ ] NL query input → FastAPI endpoint → Claude Sonnet → MongoDB Atlas Vector Search → highlighted subgraph
- [ ] Filter panel: by layer, language, file type
- [ ] Search bar: filter nodes by filename
- [ ] Orphan files panel: "Dead Code" warning section
- [ ] **Ownership Graph panel**: contributor legend with auto-assigned colours; click a contributor name → graph dims all nodes they don't primarily own
- [ ] **Ownership sidebar**: click any node → show full ownership breakdown table (author, lines owned, %, last commit date)
- [ ] **Multi-file Flow Diagram**: lasso-select a folder or set of nodes → "Explain this module" → cross-module Mermaid diagram generated and displayed

### Hour 18–20 | SaaS Shell + Deployment
- [ ] React SPA: deploy to Netlify/Vercel (`npm run build`)
- [ ] FastAPI + Celery: deploy to Railway/Render
- [ ] MongoDB Atlas cluster + Vector Search index configured
- [ ] Redis provisioned (Railway or Upstash)
- [ ] Environment variables configured across all services
- [ ] GitHub Actions CI: lint + type-check + deploy on push
- [ ] Rate limiting on FastAPI routes (`slowapi`)
- [ ] Error boundary + graceful failure states (React)

### Hour 20–22 | Demo Polish + Wow Factor
- [ ] Pre-analyze 3 famous repos (React, FastAPI, Django) for instant demo
- [ ] Landing page with hero section showing live graph preview
- [ ] Animated graph load (nodes fly in with Framer Motion)
- [ ] Share link: `repomap.app/r/facebook/react`
- [ ] Copy graph as PNG button
- [ ] "Analyze public repo" no-auth quick demo mode

### Hour 22–24 | Buffer + Presentation Prep
- [ ] Bug bash
- [ ] Demo script rehearsal
- [ ] Slide deck: problem → solution → tech → live demo
- [ ] Backup: pre-recorded demo video if live breaks
- [ ] README with architecture diagram

---

## 👥 Team Roles

> Recommended for a 3–4 person team

### Person A — Backend / Analysis Engine
- Python AST + tree-sitter parsing pipeline
- NetworkX graph algorithms (PageRank, orphan detection)
- **git blame via pydriller → Ownership Graph aggregation**
- **Priority Score formula computation + `priority_graph` collection writes**
- Celery task orchestration
- MongoDB schema design + Beanie ODM queries

### Person B — Frontend / Graph UI
- React + Vite project setup + routing
- React Flow graph visualization
- Socket.io client + real-time progress
- File detail panel, layer color coding + animations
- **Priority Graph view** — alternate React Flow layout driven by priority rank
- **Ownership Graph view** — contributor colour palette, filter-by-author interaction
- **Mermaid.js integration** — render flow diagrams in modal/side panel

### Person C — AI Integration + Full Stack
- Claude API integration (summaries + NL queries)
- MongoDB Atlas Vector Search for NL similarity
- **Functional & Data Flow diagram generation** — prompt engineering for Claude Sonnet to produce valid Mermaid output from file/folder context
- **Multi-file flow diagram endpoint** (`POST /api/repos/{id}/flow`)
- Onboarding path algorithm
- Risk heatmap logic + Cognitive Load Score

### Person D — Infrastructure + Glue (if 4-person team)
- Docker Compose local environment
- FastAPI ↔ React CORS + JWT auth wiring
- Railway/Render deployment: FastAPI + Celery + Redis
- Netlify/Vercel deployment: React SPA
- `slowapi` rate limiting + error handling
- MongoDB Atlas Vector Search index setup

---

## 🚀 Innovative Differentiators

> These 10 ideas will separate you from every other team

---

### 1. 🧠 "Cognitive Load Score" — A New Metric
**What:** Beyond just centrality, compute a composite **Cognitive Load Score** per file:
```
CLS = (fan_in * 0.4) + (fan_out * 0.3) + (lines/100 * 0.2) + (is_god_file * 0.1)
```
**Why it's different:** Teams building code health tools only show complexity. You show *the cost of understanding* — a metric that directly speaks to the onboarding problem in the PS.

---

### 2. 🗣️ "Architecture in Plain English" — Auto-Generated README
**What:** After analysis, auto-generate a complete `ARCHITECTURE.md` file that reads like a human wrote it:
> _"This is a Django REST API with a React frontend. The entry point is `manage.py`. Authentication flows through `users/auth.py`, which is a high-risk file depended on by 14 other modules..."_

Users can **download or push it directly to their GitHub repo** via the GitHub API.

**Why it's different:** Not just visualization — a *deliverable artifact* that teams can actually use.

---

### 3. ⚡ "Time-to-Understanding" Estimator
**What:** After generating the onboarding path, calculate and display:
> _"Estimated time for a new developer to reach productive understanding: **3.2 hours**"_

Based on: total lines in onboarding path files × avg reading/comprehension rate for code.

**Why it's different:** You've quantified the problem the PS describes. That number will make judges pause.

---

### 4. 🔴 "Change Blast Radius" Simulator
**What:** User hovers over any file → graph highlights all files that would be *transitively affected* by a change (both direct dependents and their dependents, up to depth 3). A live "blast radius" ripples out from the node.

**Why it's different:** This is the exact insight senior engineers use to estimate PR risk. You're making that intuition visual and instant.

---

### 5. 🎙️ "Voice Tour Mode" — AI-Narrated Codebase Walkthrough
**What:** A "Start Tour" button that auto-plays through the onboarding path, with each file expanding and an AI-generated text (or TTS-spoken) narration explaining what the file does and why it matters in the system.

**Why it's different:** Nobody else builds interactive *audio* experiences in dev tools. It's memorable, demo-able, and genuinely useful for async onboarding.

---

### 6. 🔮 "Dead Code Graveyard" Panel
**What:** A dedicated section that collects all orphaned files and scores them by:
- Last modified date (older = more suspicious)
- File size (bigger orphan = more wasted cognitive load)
- Whether it has test coverage (untested orphan = dangerous dead weight)

Present as a **"Technical Debt Cost"** — estimated hours wasted by new devs reading dead code.

**Why it's different:** Turns an optional PS feature into a *cost savings calculator* that resonates with engineering managers, not just developers.

---

### 7. 🤝 "Ask the Codebase" — Conversational Context Window
**What:** A persistent chat interface where the entire repo graph + summaries are loaded as context. Developers can ask:
- "How would I add a new payment method?"
- "What tests would break if I change the User model?"
- "Explain the data pipeline from API request to database write"

Unlike RAG systems that search for documents, your system *reasons over the graph* — it knows the topology, not just the text.

**Why it's different:** You're not building a code search tool. You're building a codebase-aware reasoning agent. That's a fundamentally more powerful product.

---

### 8. 👤 "Ownership Graph" — The Human Layer of the Codebase
**What:** Every node in the dependency graph is enriched with git blame data — who wrote it, what percentage of lines they own, and when they last touched it. The graph can be filtered and re-coloured by contributor, turning the architecture map into a **team topology map**.

Key interactions:
- Click any contributor in the legend → graph dims all files they don't primarily own
- Node tooltip shows: `Primary Owner: Jane Doe (82%) | Last touch: 3 days ago`
- "Bus Factor" warning badge on files with a single owner who holds >90% of lines

**Implementation:**
```python
# pydriller commit traversal per file
for commit in Repository(repo_path, filepath=file_path).traverse_commits():
    for mod in commit.modified_files:
        author_line_counts[commit.author.name] += mod.added_lines
```

**Why it's different:** No codebase visualizer surfaces the *human* ownership dimension. When a new developer asks "who do I talk to about this?" — your tool answers it on the graph itself.

---

### 9. 🔁 "Functional & Data Flow Diagrams" — AI-Generated Mermaid Flowcharts
**What:** Select any single file, folder, or multi-file group → click "Explain Flow" → Claude Sonnet receives the file contents, their import relationships, and the dependency subgraph, then returns:
1. A **Mermaid.js flowchart** rendered inline, showing the functional flow (control path) and data flow (what data enters, transforms, and exits)
2. A **plain-English walkthrough** of the diagram

Scope levels supported:
- **Single file**: how data enters the function, transforms, and returns
- **Folder / module**: how files in the folder collaborate and hand off data to each other
- **Multi-file selection**: cross-module data pipeline from input to output

**Prompt strategy for Claude:**
```
Given these files and their import relationships:
[file contents + dependency adjacency list]

Generate a Mermaid flowchart that shows:
1. The functional flow (which functions call which, in order)
2. The data flow (what data structures enter, how they're transformed, what exits)

Return ONLY valid Mermaid syntax starting with "flowchart TD".
```

**Why it's different:** Diagrams are usually written manually by senior engineers after months on a codebase. You generate them on demand, for any scope, in seconds. This is the feature that engineering managers will demo to their leadership.

---

### 10. 🏆 "Priority Graph" — What to Understand First, Ranked by Impact
**What:** A dedicated graph view where every node is ranked by a composite **Priority Score** — telling a new developer exactly which files to tackle first to reach productive understanding fastest.

**Priority Score formula:**
```
Priority Score =
  (centrality_score   × 0.35)  +   # How many files depend on it
  (cognitive_load_score × 0.30) +   # Cost of understanding it
  (layer_weight        × 0.20)  +   # Entry/API layers weighted higher
  (ownership_clarity   × 0.15)      # Single clear owner = easier to get help
```

**Visual treatment:**
- Nodes sized and numbered by priority rank (rank 1 = largest node)
- Sidebar shows a ranked checklist: `#1 · src/auth/middleware.py · "Core auth gate — all 14 API routes pass through here"`
- Each entry has an AI-generated one-sentence reason for its rank
- Developers can check items off as they read them (persisted in MongoDB per user)

**Why it's different:** The onboarding path tells you *an* order. The Priority Graph tells you *the* order — weighted by real structural importance, not just BFS traversal. It's the difference between a trail and a GPS route.

---

## 🆕 New Core Features — Deep Dive

> Detailed implementation spec for the three new features added to this plan.

---

### 👤 Feature A: Ownership Graph

#### What It Is
The Ownership Graph is a **view mode** that overlays git blame data on top of the existing dependency graph. Every node is coloured by its primary author, and every node's tooltip and side panel shows a full contributor breakdown.

#### Backend Implementation (Person A)
```python
# pydriller-based git blame aggregation per file
from pydriller import Repository
from collections import defaultdict

def build_ownership(repo_path: str, file_path: str) -> dict:
    author_lines = defaultdict(int)
    for commit in Repository(repo_path, filepath=file_path).traverse_commits():
        for mod in commit.modified_files:
            if mod.new_path == file_path:
                author_lines[commit.author.name] += mod.added_lines
    total = sum(author_lines.values()) or 1
    return {
        author: {"lines": lines, "pct": round(lines / total, 3)}
        for author, lines in sorted(author_lines.items(), key=lambda x: -x[1])
    }
```
- Run as a Celery sub-task after graph construction
- Aggregate across all files → write one `ownership` document per file to MongoDB
- Compute `primary_owner` (highest `pct`), `bus_factor_flag` (single owner > 90%)

#### Frontend Implementation (Person B)
- Add a **graph view mode switcher** in the toolbar: `Dependency | Ownership | Priority`
- In Ownership mode: generate a deterministic colour palette from unique author names (hashed to HSL)
- Node fill colour = primary owner's colour; node border = secondary owner's colour if split
- Contributor legend (top-right panel): click to highlight/dim that contributor's nodes
- File detail side panel gains an **"Ownership"** tab showing a horizontal bar chart of contributors

#### Data Flow
```
Celery Task (git blame)
    → pydriller.Repository.traverse_commits()
    → aggregate author → lines_owned
    → compute ownership_pct, primary_owner, bus_factor_flag
    → write ownership document to MongoDB
    → WebSocket event: ownership:ready → { repo_id }

React (on ownership:ready)
    → fetch GET /api/repos/{id}/ownership
    → build author→colour map
    → re-render React Flow nodes with new fill colours
```

---

### 🔁 Feature B: Functional & Data Flow Diagrams

#### What It Is
On-demand AI-generated **Mermaid.js flowcharts** for any file, folder, or multi-file selection. Two diagram types are supported: **Functional Flow** (which function calls which) and **Data Flow** (what data enters, transforms, and exits). Both can be generated for a single file or across a group of files.

#### Backend Implementation (Person C)

**FastAPI endpoint:**
```python
@router.post("/repos/{repo_id}/flow")
async def generate_flow_diagram(
    repo_id: str,
    body: FlowDiagramRequest,   # { file_ids: list[str], diagram_type: "functional"|"data"|"combined" }
    user=Depends(get_current_user)
):
    files = await File.find({"_id": {"$in": body.file_ids}}).to_list()
    subgraph_edges = await Dependency.find({"repo_id": repo_id, "from_file": {"$in": body.file_ids}}).to_list()
    mermaid, explanation = await call_claude_for_flow(files, subgraph_edges, body.diagram_type)
    diagram = FlowDiagram(repo_id=repo_id, scope=body.scope, target_ids=body.file_ids,
                          mermaid_source=mermaid, plain_english=explanation)
    await diagram.insert()
    return {"diagram_id": str(diagram.id), "mermaid_source": mermaid, "plain_english": explanation}
```

**Claude prompt (functional flow):**
```
You are a senior software architect. Given these files and their import relationships,
generate a Mermaid flowchart showing the functional flow — which functions call which,
in execution order.

Files:
{file_path}: {file_content}
...

Import edges:
{from_file} → {to_file} via {symbol}

Rules:
- Return ONLY valid Mermaid syntax, starting with "flowchart TD"
- Use short readable node labels (function or file name only)
- Group nodes from the same file using Mermaid subgraphs
- Do not include more than 20 nodes total; merge minor helpers into their caller
```

**Claude prompt (data flow):**
```
...same context...

Generate a Mermaid flowchart showing the DATA FLOW — what data structures
enter the system, how they are transformed at each step, and what exits.
Label edges with the data type or variable name where known.
Return ONLY valid Mermaid starting with "flowchart LR".
```

#### Frontend Implementation (Person B)
- **Single file**: "Show Flow" button in the file detail side panel → opens a modal with Mermaid diagram + plain-English explanation below it
- **Multi-file / folder**: lasso-select nodes on the graph canvas → toolbar button "Explain Module Flow" → modal renders combined diagram
- Use `mermaid.render()` inside a React `useEffect` to turn raw Mermaid source into an SVG inline
- Include a "Copy Mermaid Source" button and a "Download as PNG" button

#### Mermaid rendering in React:
```jsx
import mermaid from 'mermaid'
import { useEffect, useRef } from 'react'

export function FlowDiagram({ source }) {
  const ref = useRef(null)
  useEffect(() => {
    mermaid.render('flow-diagram', source).then(({ svg }) => {
      ref.current.innerHTML = svg
    })
  }, [source])
  return <div ref={ref} className="overflow-auto" />
}
```

---

### 🏆 Feature C: Priority Graph

#### What It Is
A dedicated graph view and ranked sidebar that tells a new developer **exactly which files to understand first**, scored by a composite formula that combines structural importance, cognitive cost, layer type, and ownership clarity.

#### Priority Score Formula
```
Priority Score =
  (centrality_score    × 0.35)  +   # PageRank — how many files depend on it
  (cognitive_load_score × 0.30) +   # CLS — cost of understanding
  (layer_weight         × 0.20) +   # entry/API = 1.0, util = 0.5, config = 0.3
  (ownership_clarity    × 0.15)     # single clear owner = 1.0 (easy to get help)
                                    # contested ownership = 0.3
```

#### Layer Weight Mapping
| Layer | Weight |
|---|---|
| entry_point | 1.0 |
| api | 0.9 |
| business_logic | 0.8 |
| data | 0.7 |
| util | 0.5 |
| config | 0.3 |
| test | 0.2 |

#### Backend Implementation (Person A)
```python
def compute_priority_score(file: File, ownership: Ownership) -> float:
    layer_weights = {
        "entry_point": 1.0, "api": 0.9, "business_logic": 0.8,
        "data": 0.7, "util": 0.5, "config": 0.3, "test": 0.2
    }
    ownership_clarity = 1.0 if ownership.owners[0].ownership_pct > 0.7 else 0.3
    return (
        file.centrality             * 0.35 +
        file.cognitive_load_score   * 0.30 +
        layer_weights.get(file.layer, 0.5) * 0.20 +
        ownership_clarity           * 0.15
    )
```
- Computed after both graph analysis and ownership tasks complete
- Sorted descending → ranked 1..N → each entry gets an AI-generated reason via Claude Haiku
- Written to `priority_graph` collection; served via `GET /api/repos/{id}/priority`

#### AI Reason Generation (Claude Haiku per file, batched)
```
File: src/auth/middleware.py
Layer: api | Centrality: 0.91 | CLS: 0.83 | Primary Owner: Jane Doe (88%)

In one sentence, explain why a new developer should understand this file early.
Be specific — mention what it does and why it matters to the system.
```
Example output: `"Core auth gate — every one of the 14 API routes passes through this middleware before reaching business logic."`

#### Frontend Implementation (Person B)
- **Priority Graph tab**: React Flow re-renders with nodes sized `10px + (50px × normalised_priority_score)` and labelled with `#rank · filename`
- Top 5 priority nodes get a gold border pulse animation (Framer Motion)
- **Priority Sidebar**: ranked checklist panel on the right
  - Each row: `#rank | filename | layer badge | AI reason`
  - Checkbox per row — state saved to MongoDB per user session
  - Progress bar at top: "3 / 24 files understood"
- Clicking a sidebar row → camera flies to that node on the graph (React Flow `fitView` on node)

#### Data Flow
```
[After Analysis + AI Complete]
    → compute_priority_score() for all files
    → sort descending, assign rank 1..N
    → batch call Claude Haiku for one-sentence reasons
    → write priority_graph document to MongoDB
    → WebSocket: priority:ready → { repo_id }

React (on priority:ready)
    → fetch GET /api/repos/{id}/priority
    → store in Zustand priorityStore
    → Priority Graph tab becomes active (badge: "Ready")
    → Sidebar renders ranked checklist
```

---

```bash
# Local dev
docker-compose up -d          # MongoDB + Redis
cd packages/api && uvicorn main:app --reload --port 8000
cd packages/api && celery -A tasks worker --loglevel=info
cd packages/web && npm run dev  # Vite dev server on :5173

# Production
# Frontend (React SPA)
cd packages/web && npm run build
# → Deploy /dist to Netlify or Vercel (static site)

# Backend (FastAPI + Celery)
# → Deploy packages/api to Railway or Render
# → Set worker start command: celery -A tasks worker

# Env vars needed
ANTHROPIC_API_KEY=
OPENAI_API_KEY=               # For embeddings
GITHUB_TOKEN=                 # For private repo access + higher rate limits
MONGODB_URL=                  # MongoDB Atlas connection string
REDIS_URL=
JWT_SECRET_KEY=               # Strong random secret for JWT signing
JWT_ALGORITHM=HS256
VITE_API_BASE_URL=            # React env var pointing to deployed FastAPI
```

### docker-compose.yml (Local Dev)
```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./packages/api
    ports: ["8000:8000"]
    environment:
      - MONGODB_URL=mongodb://mongo:27017/repomap
      - REDIS_URL=redis://redis:6379/0
    depends_on: [mongo, redis]
    volumes: ["./packages/api:/app"]
    command: uvicorn main:app --reload --host 0.0.0.0

  worker:
    build: ./packages/api
    environment:
      - MONGODB_URL=mongodb://mongo:27017/repomap
      - REDIS_URL=redis://redis:6379/0
    depends_on: [mongo, redis]
    command: celery -A tasks worker --loglevel=info

volumes:
  mongo_data:
```

---

## 🎤 Presentation Story Arc

1. **Problem (30 sec):** "It costs $15,000+ in senior engineer time to onboard one developer onto a large codebase. There is no map."
2. **Demo (3 min):** Drop in the React GitHub URL. Watch the graph build live. Click a node. Ask "where is state management?" Watch the subgraph highlight.
3. **Insight (30 sec):** Show the Cognitive Load Score and Time-to-Understanding estimate for the React repo.
4. **Differentiators (1.5 min):** Change Blast Radius + Architecture auto-README + switch to Priority Graph view ("here's the ranked order to read this repo") + click "Explain Flow" on the auth module to render the Mermaid data flow diagram live + switch to Ownership Graph ("here's who owns what — and the bus-factor warnings").
5. **Tech credibility (30 sec):** Architecture diagram — Python AST → Celery → NetworkX + pydriller → Claude API → MongoDB → React Flow + Mermaid.js → Netlify/Railway.
6. **Vision (30 sec):** "Every GitHub repo URL becomes a navigable map. This is Google Maps for code."

---

*Built for DevClash 2026 | DevKraft | 24-Hour Hackathon*
