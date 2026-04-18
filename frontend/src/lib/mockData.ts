import type { FileNode, FlowDiagramResult, GraphData, PriorityEntry, Repo, User } from '../types'

export const demoUser: User = {
  id: 'usr_demo',
  name: 'Avery Stone',
  email: 'avery@arclens.dev',
}

export const demoRepos: Repo[] = [
  {
    id: 'react-demo',
    owner: 'facebook',
    name: 'react',
    githubUrl: 'https://github.com/facebook/react',
    branch: 'main',
    languages: ['TypeScript', 'JavaScript'],
    files: 14293,
    nodes: 128,
    edges: 421,
    status: 'complete',
    lastAnalyzed: new Date(Date.now() - 1000 * 60 * 36).toISOString(),
  },
  {
    id: 'fastapi-demo',
    owner: 'tiangolo',
    name: 'fastapi',
    githubUrl: 'https://github.com/tiangolo/fastapi',
    branch: 'master',
    languages: ['Python'],
    files: 1821,
    nodes: 84,
    edges: 246,
    status: 'complete',
    lastAnalyzed: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'django-demo',
    owner: 'django',
    name: 'django',
    githubUrl: 'https://github.com/django/django',
    branch: 'main',
    languages: ['Python'],
    files: 4268,
    nodes: 115,
    edges: 339,
    status: 'analyzing',
    lastAnalyzed: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
  },
]

const owners = {
  june: {
    author: 'June Kim',
    email: 'june@arclens.dev',
    commitCount: 48,
    linesOwned: 420,
    ownershipPct: 0.76,
    lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  malik: {
    author: 'Malik Rao',
    email: 'malik@arclens.dev',
    commitCount: 37,
    linesOwned: 315,
    ownershipPct: 0.64,
    lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
  sol: {
    author: 'Sol Rivera',
    email: 'sol@arclens.dev',
    commitCount: 24,
    linesOwned: 210,
    ownershipPct: 0.52,
    lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
  },
  nora: {
    author: 'Nora Ellis',
    email: 'nora@arclens.dev',
    commitCount: 16,
    linesOwned: 188,
    ownershipPct: 0.92,
    lastCommitDate: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
}

export const demoFiles: FileNode[] = [
  {
    id: 'f1',
    path: 'src/app/router.tsx',
    language: 'TypeScript',
    layer: 'entry_point',
    lines: 164,
    sizeBytes: 9320,
    centrality: 0.93,
    cognitiveLoadScore: 0.72,
    summary: 'Defines the authenticated and public route tree, including the graph analysis workspace. It is the first place to inspect when navigation or auth handoff changes.',
    isEntry: true,
    isOrphan: false,
    primaryOwner: 'June Kim',
    owners: [owners.june, { ...owners.sol, ownershipPct: 0.24, linesOwned: 132 }],
    priorityRank: 1,
    priorityScore: 0.96,
    priorityReason: 'Navigation control sits here, so every major user journey passes through this file.',
  },
  {
    id: 'f2',
    path: 'src/features/graph/GraphCanvas.tsx',
    language: 'TypeScript',
    layer: 'business_logic',
    lines: 428,
    sizeBytes: 28400,
    centrality: 0.89,
    cognitiveLoadScore: 0.86,
    summary: 'Owns the React Flow surface, graph layout, selection, and viewport behavior. Most architecture exploration features are composed through this component.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'Malik Rao',
    owners: [owners.malik, { ...owners.june, ownershipPct: 0.27, linesOwned: 148 }],
    priorityRank: 2,
    priorityScore: 0.92,
    priorityReason: 'The graph canvas is the product core and coordinates every node and edge interaction.',
  },
  {
    id: 'f3',
    path: 'src/services/socketService.ts',
    language: 'TypeScript',
    layer: 'api',
    lines: 118,
    sizeBytes: 6720,
    centrality: 0.76,
    cognitiveLoadScore: 0.55,
    summary: 'Connects the browser to analysis progress events and ownership or priority readiness signals. It keeps long-running repo jobs feeling live.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'Sol Rivera',
    owners: [owners.sol, { ...owners.malik, ownershipPct: 0.38, linesOwned: 130 }],
    priorityRank: 4,
    priorityScore: 0.74,
    priorityReason: 'Real-time progress depends on this API seam, and stale events would make analysis feel broken.',
  },
  {
    id: 'f4',
    path: 'src/store/graphStore.ts',
    language: 'TypeScript',
    layer: 'data',
    lines: 92,
    sizeBytes: 4860,
    centrality: 0.82,
    cognitiveLoadScore: 0.5,
    summary: 'Stores view mode, selected nodes, filters, hover state, and layout preferences. Graph features read from here instead of duplicating UI state.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'June Kim',
    owners: [owners.june, { ...owners.sol, ownershipPct: 0.18, linesOwned: 44 }],
    priorityRank: 3,
    priorityScore: 0.81,
    priorityReason: 'Graph behavior is driven by this state model, so understanding it unlocks the rest of the UI.',
  },
  {
    id: 'f5',
    path: 'src/features/panels/FileDetailPanel.tsx',
    language: 'TypeScript',
    layer: 'business_logic',
    lines: 312,
    sizeBytes: 18700,
    centrality: 0.64,
    cognitiveLoadScore: 0.71,
    summary: 'Renders the right-side context panel for selected files, including code preview, imports, ownership, and flow generation. It turns graph clicks into understandable next actions.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'Malik Rao',
    owners: [owners.malik, { ...owners.nora, ownershipPct: 0.22, linesOwned: 69 }],
    priorityRank: 5,
    priorityScore: 0.7,
    priorityReason: 'This panel explains selected nodes and makes the graph useful rather than decorative.',
  },
  {
    id: 'f6',
    path: 'src/services/priorityService.ts',
    language: 'TypeScript',
    layer: 'api',
    lines: 64,
    sizeBytes: 2960,
    centrality: 0.48,
    cognitiveLoadScore: 0.36,
    summary: 'Fetches priority rankings and priority graph data from the API. The UI depends on it when switching to onboarding-first exploration.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'Sol Rivera',
    owners: [owners.sol, { ...owners.june, ownershipPct: 0.14, linesOwned: 20 }],
    priorityRank: 7,
    priorityScore: 0.55,
    priorityReason: 'Priority mode is a key differentiator, and this service is its API entry point.',
  },
  {
    id: 'f7',
    path: 'src/lib/ownershipColors.ts',
    language: 'TypeScript',
    layer: 'util',
    lines: 36,
    sizeBytes: 1210,
    centrality: 0.42,
    cognitiveLoadScore: 0.22,
    summary: 'Generates deterministic contributor colors from author names. It keeps the ownership graph stable across reloads and teams.',
    isEntry: false,
    isOrphan: false,
    primaryOwner: 'Nora Ellis',
    owners: [owners.nora],
    priorityRank: 8,
    priorityScore: 0.43,
    priorityReason: 'Small but important: contributor color stability makes ownership mode trustworthy.',
  },
  {
    id: 'f8',
    path: 'src/pages/app/RepoAnalysis.tsx',
    language: 'TypeScript',
    layer: 'entry_point',
    lines: 276,
    sizeBytes: 15100,
    centrality: 0.78,
    cognitiveLoadScore: 0.68,
    summary: 'Composes the three-zone analysis workspace: file tabs, graph canvas, and contextual panels. It is the page-level control room for architecture navigation.',
    isEntry: true,
    isOrphan: false,
    primaryOwner: 'June Kim',
    owners: [owners.june, { ...owners.malik, ownershipPct: 0.22, linesOwned: 61 }],
    priorityRank: 6,
    priorityScore: 0.67,
    priorityReason: 'This route composes the graph, sidebars, progress overlay, and panel lifecycle.',
  },
  {
    id: 'f9',
    path: 'src/legacy/unusedTelemetry.ts',
    language: 'TypeScript',
    layer: 'util',
    lines: 88,
    sizeBytes: 4190,
    centrality: 0.08,
    cognitiveLoadScore: 0.28,
    summary: 'Legacy telemetry wrapper that no active feature imports anymore. It should be reviewed before being deleted because older analytics scripts may still reference it indirectly.',
    isEntry: false,
    isOrphan: true,
    primaryOwner: 'Nora Ellis',
    owners: [owners.nora],
    priorityRank: 9,
    priorityScore: 0.22,
    priorityReason: 'Likely dead code; understand it only after the main graph and route flow are clear.',
  },
]

export const demoGraph: GraphData = {
  nodes: demoFiles,
  edges: [
    { id: 'e1', source: 'f1', target: 'f8', importType: 'direct' },
    { id: 'e2', source: 'f8', target: 'f2', importType: 'direct' },
    { id: 'e3', source: 'f8', target: 'f5', importType: 'direct' },
    { id: 'e4', source: 'f2', target: 'f4', importType: 'direct' },
    { id: 'e5', source: 'f2', target: 'f7', importType: 'direct' },
    { id: 'e6', source: 'f5', target: 'f6', importType: 'dynamic' },
    { id: 'e7', source: 'f5', target: 'f4', importType: 'direct' },
    { id: 'e8', source: 'f3', target: 'f4', importType: 'direct' },
    { id: 'e9', source: 'f6', target: 'f3', importType: 'type_only' },
    { id: 'e10', source: 'f1', target: 'f4', importType: 'direct' },
  ],
  meta: {
    repoId: 'react-demo',
    generatedAt: new Date().toISOString(),
    nodeCount: demoFiles.length,
    edgeCount: 10,
    timeToUnderstandingHours: 3.2,
  },
}

export const demoPriority: PriorityEntry[] = demoFiles
  .filter((file) => !file.isOrphan)
  .sort((a, b) => a.priorityRank - b.priorityRank)
  .map((file) => ({
    fileId: file.id,
    rank: file.priorityRank,
    score: file.priorityScore,
    path: file.path,
    layer: file.layer,
    reason: file.priorityReason,
  }))

export const demoCode: Record<string, string> = {
  f2: `import { ReactFlow, Background, Controls } from '@xyflow/react'
import { useMemo } from 'react'
import { useGraphStore } from '../../store/graphStore'

export function GraphCanvas({ graph }) {
  const viewMode = useGraphStore((state) => state.viewMode)
  const nodes = useMemo(() => mapToFlowNodes(graph, viewMode), [graph, viewMode])

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView>
      <Background />
      <Controls />
    </ReactFlow>
  )
}`,
}

export const demoFlow: FlowDiagramResult = {
  diagramId: 'flow_demo',
  mermaidSource: `flowchart TD
  A[Paste GitHub URL] --> B[Create analysis job]
  B --> C[Stream progress events]
  C --> D[Render graph nodes]
  D --> E[Open file detail panel]
  E --> F[Generate flow diagram]`,
  plainEnglish:
    'Gittsurī starts with a GitHub URL, creates an analysis job, streams progress into the client, and renders the graph as soon as dependency data is ready. Selecting files narrows the context so AI-generated flow diagrams can explain a focused module instead of the whole repository at once.',
}
