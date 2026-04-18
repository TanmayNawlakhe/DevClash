import type { ArchitectureEdge, ArchitectureNode, FileNode, GraphData, GraphEdge, LayoutMode, ViewMode } from '../types'
import { LAYER_COLORS } from './constants'
import { fileName } from './utils'
import { ownershipColor } from './ownershipColors'

const positions = [
  { x: 0, y: 40 },
  { x: 280, y: -40 },
  { x: 560, y: 40 },
  { x: 280, y: 190 },
  { x: 620, y: 230 },
  { x: 920, y: 100 },
  { x: 80, y: 300 },
  { x: 430, y: 390 },
  { x: 760, y: 420 },
  { x: 1020, y: 320 },
]

export function mapToFlowNodes(graph: GraphData, viewMode: ViewMode, layoutMode: LayoutMode): ArchitectureNode[] {
  const priorityMax = Math.max(...graph.nodes.map((node) => node.priorityScore))
  return graph.nodes.map((node, index) => {
    const normalizedPriority = node.priorityScore / priorityMax
    return {
      id: node.id,
      type: 'architecture',
      position: layoutPosition(index, graph.nodes.length, layoutMode),
      data: {
        ...node,
        priorityScore: normalizedPriority,
      },
      style: {
        ['--node-layer' as string]: LAYER_COLORS[node.layer].hex,
        ['--node-owner' as string]: ownershipColor(node.primaryOwner),
      },
    }
  })
}

export function mapToFlowEdges(edges: GraphEdge[]): ArchitectureEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'architecture',
    animated: edge.importType === 'dynamic',
    data: {
      importType: edge.importType,
      symbol: edge.symbol,
    },
  }))
}

export function nodeFill(node: FileNode, viewMode: ViewMode) {
  if (viewMode === 'ownership') return ownershipColor(node.primaryOwner)
  if (viewMode === 'priority') return 'var(--primary)'
  return LAYER_COLORS[node.layer].hex
}

export function nodeLabel(node: FileNode, viewMode: ViewMode) {
  if (viewMode === 'priority') return `#${node.priorityRank} ${fileName(node.path)}`
  return fileName(node.path)
}

export function blastRadius(seedId: string, edges: GraphEdge[], depth = 3) {
  const affected = new Map<string, number>()
  let frontier = [seedId]
  for (let level = 1; level <= depth; level += 1) {
    const next = edges.filter((edge) => frontier.includes(edge.target)).map((edge) => edge.source)
    next.forEach((id) => {
      if (!affected.has(id)) affected.set(id, level)
    })
    frontier = next
  }
  return affected
}

function layoutPosition(index: number, total: number, layoutMode: LayoutMode) {
  if (layoutMode === 'radial') {
    const angle = (index / total) * Math.PI * 2
    const radius = 320
    return { x: Math.cos(angle) * radius + 480, y: Math.sin(angle) * radius + 260 }
  }

  if (layoutMode === 'hierarchical') {
    const column = index % 4
    const row = Math.floor(index / 4)
    return { x: column * 280, y: row * 190 }
  }

  return positions[index % positions.length]
}
