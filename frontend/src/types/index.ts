import type { Edge, Node } from '@xyflow/react'

export type AnalysisStatus =
  | 'idle'
  | 'pending'
  | 'cloning'
  | 'parsing'
  | 'analyzing'
  | 'ai_processing'
  | 'cancelling'
  | 'cancelled'
  | 'complete'
  | 'failed'

export type ViewMode = 'dependency' | 'ownership' | 'priority'
export type LayoutMode = 'force' | 'hierarchical' | 'radial'
export type PanelId = 'file' | 'onboarding' | 'priority' | 'orphans' | 'query' | null

export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface Repo {
  id: string
  owner: string
  name: string
  githubUrl: string
  branch: string
  languages: string[]
  files: number
  nodes: number
  edges: number
  status: AnalysisStatus
  lastAnalyzed: string
  createdAt?: string
  completedAt?: string | null
  errorMessage?: string | null
  progress?: {
    stage: string
    percent: number
    currentFile?: string | null
    updatedAt?: string | null
  } | null
}

export type Layer =
  | 'entry_point'
  | 'api'
  | 'business_logic'
  | 'data'
  | 'util'
  | 'config'
  | 'test'

export interface OwnerShare {
  author: string
  email: string
  commitCount: number
  linesOwned: number
  ownershipPct: number
  lastCommitDate: string
}

export interface FileNode {
  id: string
  path: string
  language: string
  layer: Layer
  lines: number
  sizeBytes: number
  centrality: number
  cognitiveLoadScore: number
  summary: string
  isEntry: boolean
  isOrphan: boolean
  primaryOwner: string
  owners: OwnerShare[]
  priorityRank: number
  priorityScore: number
  priorityReason: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  importType: 'direct' | 'dynamic' | 'type_only' | 're_export'
  symbol?: string
}

export interface GraphMeta {
  repoId: string
  generatedAt: string
  nodeCount: number
  edgeCount: number
  timeToUnderstandingHours: number
}

export interface GraphData {
  nodes: FileNode[]
  edges: GraphEdge[]
  meta: GraphMeta
}

export interface FilterState {
  layers: Layer[]
  languages: string[]
  search: string
  showOrphans: boolean
  entryOnly: boolean
}

export interface PriorityEntry {
  fileId: string
  rank: number
  score: number
  path: string
  layer: Layer
  reason: string
}

export interface FlowDiagramResult {
  diagramId: string
  mermaidSource: string
  plainEnglish: string
}

export interface QueryFlowMatch {
  name: string
  score: number
}

export interface QueryFlowEntry {
  rank: number
  fileId: string
  path: string
  score: number
  scoreBreakdown: Record<string, number>
  layer: Layer
  language: string
  isEntry: boolean
  summary: string
  matchedFunctions: QueryFlowMatch[]
}

export interface QueryResult {
  fileIds: string[]
  results: Array<{
    fileId: string
    path: string
    score: number
    snippet: string
  }>
  answer?: string
  mermaid?: string
  flow?: QueryFlowEntry[]
  totalMatched?: number
}

export interface EmbeddingStatus {
  repoId: string
  status: 'processing' | 'complete' | 'failed' | 'not_started' | 'unknown'
  startedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
  fileCount: number
  message: string
}

export interface FileDetail extends FileNode {
  code: string
  imports: FileNode[]
  dependents: FileNode[]
}

export type ArchitectureNode = Node<FileNode & Record<string, unknown>>
export type ArchitectureEdge = Edge<{ importType: GraphEdge['importType']; symbol?: string; isGroupEdge?: boolean }>
