import type { ArchitectureEdge, ArchitectureNode, FileNode, GraphData, GraphEdge, LayoutMode, ViewMode } from '../types'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { LAYER_COLORS } from './constants'
import { fileName } from './utils'
import { ownershipColor } from './ownershipColors'

type LayoutPoint = { x: number; y: number }
type SimulationNode = { id: string; x: number; y: number; centrality: number }

export function mapToFlowNodes(graph: GraphData, viewMode: ViewMode, layoutMode: LayoutMode): ArchitectureNode[] {
  const priorityMax = Math.max(1, ...graph.nodes.map((node) => node.priorityScore))
  const nodePositions = layoutPositions(graph, layoutMode)

  return graph.nodes.map((node, index) => {
    const normalizedPriority = node.priorityScore / priorityMax
    return {
      id: node.id,
      type: 'architecture',
      position: nodePositions.get(node.id) ?? fallbackPosition(index),
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

function layoutPositions(graph: GraphData, layoutMode: LayoutMode) {
  if (!graph.nodes.length) return new Map<string, LayoutPoint>()

  if (layoutMode === 'radial') {
    return radialLayout(graph)
  }

  if (layoutMode === 'hierarchical') {
    return hierarchicalLayout(graph)
  }

  return forceLayout(graph)
}

function forceLayout(graph: GraphData) {
  const nodes: SimulationNode[] = graph.nodes.map((node, index) => {
    const seed = hashString(node.id)
    const angle = ((seed % 360) * Math.PI) / 180
    const radius = 180 + (seed % 160)

    return {
      id: node.id,
      centrality: node.centrality,
      x: Math.cos(angle) * radius + (index % 7) * 42,
      y: Math.sin(angle) * radius + Math.floor(index / 7) * 36,
    }
  })

  const links = graph.edges
    .filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target }))

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink(links)
        .id((d) => (d as SimulationNode).id)
        .distance(220)
        .strength(0.2),
    )
    .force('charge', forceManyBody().strength(-560))
    .force('collision', forceCollide(112).strength(1))
    .force('center', forceCenter(0, 0))
    .alpha(1)
    .alphaMin(0.001)
    .alphaDecay(0.035)
    .stop()

  for (let i = 0; i < 260; i += 1) {
    simulation.tick()
  }

  const positioned = new Map<string, LayoutPoint>()
  nodes.forEach((node) => {
    positioned.set(node.id, {
      x: node.x || 0,
      y: node.y || 0,
    })
  })

  return normalizeLayout(positioned, { x: 220, y: 180 })
}

function hierarchicalLayout(graph: GraphData) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()

  graph.nodes.forEach((node) => {
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  })

  graph.edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return
    incoming.get(edge.target)?.push(edge.source)
    outgoing.get(edge.source)?.push(edge.target)
  })

  const indegree = new Map<string, number>()
  graph.nodes.forEach((node) => {
    indegree.set(node.id, incoming.get(node.id)?.length ?? 0)
  })

  const depth = new Map<string, number>()
  const queue = graph.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort(nodeRankComparator)
    .map((node) => node.id)

  while (queue.length) {
    const sourceId = queue.shift()!
    const sourceDepth = depth.get(sourceId) ?? 0

    ;(outgoing.get(sourceId) ?? []).forEach((targetId) => {
      depth.set(targetId, Math.max(depth.get(targetId) ?? 0, sourceDepth + 1))
      const nextInDegree = (indegree.get(targetId) ?? 1) - 1
      indegree.set(targetId, nextInDegree)
      if (nextInDegree === 0) {
        queue.push(targetId)
      }
    })

    queue.sort((left, right) => {
      const leftNode = nodeById.get(left)!
      const rightNode = nodeById.get(right)!
      return nodeRankComparator(leftNode, rightNode)
    })
  }

  graph.nodes.forEach((node) => {
    if (depth.has(node.id)) return
    const parentDepth = (incoming.get(node.id) ?? [])
      .map((parentId) => depth.get(parentId) ?? 0)
      .sort((left, right) => right - left)[0]
    depth.set(node.id, (parentDepth ?? 0) + (incoming.get(node.id)?.length ? 1 : 0))
  })

  const layers = new Map<number, string[]>()
  graph.nodes.forEach((node) => {
    const nodeDepth = depth.get(node.id) ?? 0
    const bucket = layers.get(nodeDepth) ?? []
    bucket.push(node.id)
    layers.set(nodeDepth, bucket)
  })

  const maxDepth = Math.max(...layers.keys())
  const orderByLayer = new Map<string, number>()
  const positioned = new Map<string, LayoutPoint>()

  for (let layer = 0; layer <= maxDepth; layer += 1) {
    const ids = layers.get(layer) ?? []

    ids.sort((leftId, rightId) => {
      const leftParents = (incoming.get(leftId) ?? [])
        .map((parentId) => orderByLayer.get(parentId))
        .filter((index): index is number => index !== undefined)
      const rightParents = (incoming.get(rightId) ?? [])
        .map((parentId) => orderByLayer.get(parentId))
        .filter((index): index is number => index !== undefined)

      const leftAverage = leftParents.length
        ? leftParents.reduce((sum, value) => sum + value, 0) / leftParents.length
        : Number.MAX_SAFE_INTEGER
      const rightAverage = rightParents.length
        ? rightParents.reduce((sum, value) => sum + value, 0) / rightParents.length
        : Number.MAX_SAFE_INTEGER

      if (leftAverage !== rightAverage) return leftAverage - rightAverage

      const leftNode = nodeById.get(leftId)!
      const rightNode = nodeById.get(rightId)!
      return nodeRankComparator(leftNode, rightNode)
    })

    const verticalGap = 192
    const horizontalGap = 320
    const stackHeight = Math.max(0, (ids.length - 1) * verticalGap)

    ids.forEach((id, index) => {
      orderByLayer.set(id, index)
      positioned.set(id, {
        x: layer * horizontalGap,
        y: index * verticalGap - stackHeight / 2,
      })
    })
  }

  return normalizeLayout(positioned, { x: 180, y: 240 })
}

function radialLayout(graph: GraphData) {
  const ordered = [...graph.nodes].sort(nodeRankComparator)
  const positioned = new Map<string, LayoutPoint>()

  if (!ordered.length) return positioned

  positioned.set(ordered[0].id, { x: 0, y: 0 })

  let ring = 1
  let ringPosition = 0
  let ringCapacity = 8

  for (let i = 1; i < ordered.length; i += 1) {
    if (ringPosition >= ringCapacity) {
      ring += 1
      ringPosition = 0
      ringCapacity = 8 + (ring - 1) * 6
    }

    const angle = (ringPosition / ringCapacity) * Math.PI * 2 + (ring % 2 ? 0 : Math.PI / ringCapacity)
    const radius = 210 + (ring - 1) * 180

    positioned.set(ordered[i].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    })

    ringPosition += 1
  }

  return normalizeLayout(positioned, { x: 420, y: 320 })
}

function normalizeLayout(positioned: Map<string, LayoutPoint>, padding: LayoutPoint) {
  const values = [...positioned.values()]
  if (!values.length) return positioned

  const minX = Math.min(...values.map((point) => point.x))
  const minY = Math.min(...values.map((point) => point.y))

  const normalized = new Map<string, LayoutPoint>()
  positioned.forEach((point, id) => {
    normalized.set(id, {
      x: point.x - minX + padding.x,
      y: point.y - minY + padding.y,
    })
  })

  return normalized
}

function nodeRankComparator(left: FileNode, right: FileNode) {
  if (left.centrality !== right.centrality) {
    return right.centrality - left.centrality
  }
  if (left.priorityScore !== right.priorityScore) {
    return right.priorityScore - left.priorityScore
  }
  if (left.lines !== right.lines) {
    return right.lines - left.lines
  }
  return left.path.localeCompare(right.path)
}

function fallbackPosition(index: number): LayoutPoint {
  const column = index % 4
  const row = Math.floor(index / 4)
  return { x: column * 280 + 180, y: row * 190 + 140 }
}

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
