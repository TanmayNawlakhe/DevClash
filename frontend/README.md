# NeuroGraph — Frontend

React 19 + TypeScript SPA for the NeuroGraph repository visualization platform.

See the [root README](../README.md) for full project documentation, setup instructions, and architecture overview.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run lint     # ESLint
```

## Key Directories

```
src/
├── pages/          # Route-level components (Dashboard, RepoAnalysis, RepoHistory, Auth)
├── components/
│   ├── features/   # Graph canvas, panels, ownership, repo cards, analysis progress
│   └── ui/         # Primitive components (Badge, Tooltip, etc.)
├── store/          # Zustand stores: graphStore, repoStore, ownershipStore, priorityStore
├── services/       # API calls: graphService, repoService
├── lib/
│   ├── repoAdapters.ts   # Backend → frontend type mapping and graph enrichment
│   ├── graphUtils.ts     # Graph layout algorithms (force, hierarchical, collapsed pipeline)
│   └── constants.ts      # LAYER_COLORS, STATUS_LABELS, ANALYSIS_STAGES
└── types/index.ts  # All shared TypeScript types
```

## Graph Views

The canvas (`GraphCanvas.tsx`) supports three view modes and two layout modes:

- **View modes:** `dependency` · `ownership` · `priority`
- **Layout modes:** `hierarchical` · `force` · `radial`
- **Collapsed pipeline** — files grouped by AI classification into a horizontal dependency flow; click a chip to expand it

## Backend Connection

Set `VITE_API_BASE_URL` (optional) to point at a non-default backend. The `api.ts` service reads this at runtime. Without it the app runs against `http://localhost:8000`.
