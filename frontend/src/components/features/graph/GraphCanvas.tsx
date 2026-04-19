import {
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileCode2, Layers, Menu, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GraphToolbar } from './GraphToolbar'
import { GraphMinimap } from './GraphMinimap'
import { NodeCustom } from './NodeCustom'
import { GroupNode } from './GroupNode'
import { EdgeCustom } from './EdgeCustom'
import { ContributorLegend } from '../ownership/ContributorLegend'
import { FlowDiagramModal } from '../panels/FlowDiagramModal'
import { NLQueryPanel } from '../panels/NLQueryPanel'
import { buildCollapsedGraph, mapToFlowEdges, mapToFlowNodes } from '../../../lib/graphUtils'
import { useBlastRadius } from '../../../hooks/useBlastRadius'
import { useGraphStore } from '../../../store/graphStore'
import { useOwnershipStore } from '../../../store/ownershipStore'
import { useUIStore } from '../../../store/uiStore'
import type { GraphData, Layer } from '../../../types'

const nodeTypes = { architecture: NodeCustom, group: GroupNode }
const edgeTypes = { architecture: EdgeCustom }

export function GraphCanvas({ graph }: { graph: GraphData }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner graph={graph} />
    </ReactFlowProvider>
  )
}

function GraphCanvasInner({ graph }: { graph: GraphData }) {
  const viewMode = useGraphStore((state) => state.viewMode)
  const layoutMode = useGraphStore((state) => state.layoutMode)
  const filters = useGraphStore((state) => state.filters)
  const hoveredNodeId = useGraphStore((state) => state.hoveredNodeId)
  const blastRadiusEnabled = useGraphStore((state) => state.blastRadiusEnabled)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const setSelectedNodes = useGraphStore((state) => state.setSelectedNodes)
  const setHoveredNode = useGraphStore((state) => state.setHoveredNode)
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds)
  const collapsedView = useGraphStore((state) => state.collapsedView)
  const expandedLayer = useGraphStore((state) => state.expandedLayer)
  const setCollapsedView = useGraphStore((state) => state.setCollapsedView)
  const toggleLayerExpanded = useGraphStore((state) => state.toggleLayerExpanded)
  const collapseAllLayers = useGraphStore((state) => state.collapseAllLayers)
  const selectedContributor = useOwnershipStore((state) => state.selectedContributor)
  const setActivePanel = useUIStore((state) => state.setActivePanel)
  const { fitView } = useReactFlow()

  const [queryOpen, setQueryOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [isViewportMoving, setIsViewportMoving] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const blastMap = useBlastRadius(
    hoveredNodeId,
    graph.edges,
    blastRadiusEnabled && !isViewportMoving && !collapsedView,
  )

  const filteredGraph = useMemo(() => {
    const search = filters.search.toLowerCase()
    const allowedNodes = graph.nodes.filter((node) => {
      if (!filters.showOrphans && node.isOrphan) return false
      if (filters.entryOnly && !node.isEntry) return false
      if (filters.layers.length && !filters.layers.includes(node.layer)) return false
      if (filters.languages.length && !filters.languages.includes(node.language)) return false
      if (search && !node.path.toLowerCase().includes(search) && !node.summary.toLowerCase().includes(search))
        return false
      return true
    })
    const allowedIds = new Set(allowedNodes.map((node) => node.id))
    return {
      nodes: allowedNodes,
      edges: graph.edges.filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target)),
      meta: graph.meta,
    }
  }, [filters, graph])

  // ── Collapsed graph ──────────────────────────────────────────────────────────
  const collapsedGraph = useMemo(
    () =>
      collapsedView
        ? buildCollapsedGraph(filteredGraph, expandedLayer as Layer | null, viewMode)
        : null,
    [collapsedView, expandedLayer, filteredGraph, viewMode],
  )

  // ── Detailed graph ───────────────────────────────────────────────────────────
  const baseFlowNodes = useMemo(
    () => (!collapsedView ? mapToFlowNodes(filteredGraph, viewMode, layoutMode) : []),
    [collapsedView, filteredGraph, layoutMode, viewMode],
  )

  const baseFlowEdges = useMemo(
    () => (!collapsedView ? mapToFlowEdges(filteredGraph.edges) : []),
    [collapsedView, filteredGraph.edges],
  )

  const layoutStabilityKey = useMemo(
    () =>
      collapsedView
        ? `collapsed|${expandedLayer ?? ''}|${filteredGraph.nodes.map((n) => n.id).join(',')}`
        : `${layoutMode}|${viewMode}|${filteredGraph.nodes.map((n) => n.id).join(',')}|${filteredGraph.edges.map((e) => e.id).join(',')}`,
    [collapsedView, expandedLayer, filteredGraph.edges, filteredGraph.nodes, layoutMode, viewMode],
  )

  const lastLayoutKeyRef = useRef(layoutStabilityKey)

  const hoverEdgeDepthMap = useMemo(() => {
    if (collapsedView || !hoveredNodeId || !blastRadiusEnabled || isViewportMoving)
      return new Map<string, number>()

    const incomingByTarget = new Map<string, typeof filteredGraph.edges>()
    const outgoingBySource = new Map<string, typeof filteredGraph.edges>()

    filteredGraph.edges.forEach((edge) => {
      const incoming = incomingByTarget.get(edge.target) ?? []
      incoming.push(edge)
      incomingByTarget.set(edge.target, incoming)

      const outgoing = outgoingBySource.get(edge.source) ?? []
      outgoing.push(edge)
      outgoingBySource.set(edge.source, outgoing)
    })

    const edgeDepth = new Map<string, number>()
    const nodeDepth = new Map<string, number>([[hoveredNodeId, 0]])
    const queue: string[] = [hoveredNodeId]
    const maxDepth = 3

    while (queue.length) {
      const currentId = queue.shift()!
      const currentDepth = nodeDepth.get(currentId) ?? 0
      if (currentDepth >= maxDepth) continue

      const traverse = (edgeId: string, neighborNodeId: string) => {
        const nextDepth = currentDepth + 1
        const existingEdgeDepth = edgeDepth.get(edgeId)
        if (existingEdgeDepth === undefined || nextDepth < existingEdgeDepth)
          edgeDepth.set(edgeId, nextDepth)

        const existingNodeDepth = nodeDepth.get(neighborNodeId)
        if (existingNodeDepth === undefined || nextDepth < existingNodeDepth) {
          nodeDepth.set(neighborNodeId, nextDepth)
          queue.push(neighborNodeId)
        }
      }

      ;(incomingByTarget.get(currentId) ?? []).forEach((edge) => traverse(edge.id, edge.source))
      ;(outgoingBySource.get(currentId) ?? []).forEach((edge) => traverse(edge.id, edge.target))
    }

    return edgeDepth
  }, [blastRadiusEnabled, collapsedView, filteredGraph.edges, hoveredNodeId, isViewportMoving])

  // ── Apply nodes + edges ──────────────────────────────────────────────────────
  useEffect(() => {
    if (collapsedView) {
      if (!collapsedGraph) return

      const markerColor = 'color-mix(in oklch, var(--primary) 65%, var(--border))'
      setNodes(collapsedGraph.nodes)
      setEdges(
        collapsedGraph.edges.map((edge) => ({
          ...edge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 22,
            height: 22,
            color: markerColor,
          },
        })),
      )
      lastLayoutKeyRef.current = layoutStabilityKey
      return
    }

    // Detailed view — preserve user-dragged positions when layout hasn't changed
    const shouldResetLayout = lastLayoutKeyRef.current !== layoutStabilityKey

    const nextNodes = baseFlowNodes.map((node) => ({
      ...node,
      data: { ...node.data, blastDepth: blastMap.get(node.id) },
      hidden: selectedContributor ? node.data.primaryOwner !== selectedContributor : false,
    }))
    const nextEdges = baseFlowEdges.map((edge) => ({
      ...edge,
      data: { ...edge.data, pathDepth: hoverEdgeDepthMap.get(edge.id) },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: hoverEdgeDepthMap.has(edge.id)
          ? 'color-mix(in oklch, var(--primary) 78%, white)'
          : 'color-mix(in oklch, var(--primary) 60%, var(--border))',
      },
    }))

    setNodes((currentNodes) => {
      if (shouldResetLayout) return nextNodes
      const currentNodeMap = new Map(currentNodes.map((node) => [node.id, node]))
      return nextNodes.map((node) => {
        const currentNode = currentNodeMap.get(node.id)
        return currentNode ? { ...node, position: currentNode.position } : node
      })
    })
    setEdges(nextEdges)
    lastLayoutKeyRef.current = layoutStabilityKey
  }, [
    baseFlowEdges,
    baseFlowNodes,
    blastMap,
    collapsedGraph,
    collapsedView,
    hoverEdgeDepthMap,
    layoutStabilityKey,
    selectedContributor,
    setEdges,
    setNodes,
  ])

  // ── Fit view on layout / filter / mode changes ────────────────────────────────
  useEffect(() => {
    const timeout = window.setTimeout(
      () => fitView({ padding: expandedLayer ? 0.18 : 0.22, duration: 700 }),
      80,
    )
    return () => window.clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    collapsedView,
    expandedLayer,
    filters.entryOnly,
    filters.layers,
    filters.languages,
    filters.search,
    filters.showOrphans,
    fitView,
    layoutMode,
    viewMode,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQueryOpen(true)
      }
      if (event.key === 'Escape') setToolbarOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (node.type === 'group') {
        toggleLayerExpanded(node.data.layer as Layer)
        return
      }
      setSelectedNode(node.id)
      setActivePanel('file')
    },
    [setActivePanel, setSelectedNode, toggleLayerExpanded],
  )

  return (
    <div className="canvas-shell relative h-full min-h-160 overflow-hidden rounded-lg border border-border bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => {
          if (isViewportMoving || collapsedView) return
          setHoveredNode(node.id)
        }}
        onNodeMouseLeave={() => {
          if (isViewportMoving) return
          setHoveredNode(null)
        }}
        onMoveStart={() => {
          setIsViewportMoving(true)
          setHoveredNode(null)
        }}
        onMoveEnd={() => setIsViewportMoving(false)}
        onSelectionChange={({ nodes }) => setSelectedNodes(nodes.map((node) => node.id))}
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
        selectionKeyCode="Shift"
        panOnScroll
        panOnScrollSpeed={0.9}
        zoomOnPinch
        zoomOnScroll
        zoomOnDoubleClick={false}
        elevateNodesOnSelect
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.22, duration: 700 }}
        minZoom={0.25}
        maxZoom={1.7}
      >
        {/* ── Hamburger button + sliding toolbar panel ── */}
        <Panel position="top-left">
          <div className="relative flex flex-col gap-2">
            <button
              onClick={() => setToolbarOpen((v) => !v)}
              aria-label={toolbarOpen ? 'Close toolbar' : 'Open toolbar'}
              className="glass-panel flex size-9 items-center justify-center rounded-lg shadow-lg shadow-primary/10 transition-colors hover:bg-accent"
            >
              {toolbarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>

            <AnimatePresence>
              {toolbarOpen && (
                <motion.div
                  key="toolbar-panel"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="origin-top-left"
                >
                  <GraphToolbar
                    repoId={graph.meta.repoId}
                    onOpenQuery={() => {
                      setQueryOpen(true)
                      setToolbarOpen(false)
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>

        {/* ── Top-right: view toggle + optional ownership legend ── */}
        <Panel position="top-right">
          <div className="flex flex-col items-end gap-2">
            {/* Simplified / Detailed pill */}
            <div className="glass-panel flex overflow-hidden rounded-lg border border-border shadow-md">
              <button
                onClick={() => {
                  setCollapsedView(true)
                  collapseAllLayers()
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  collapsedView
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Layers className="size-3.5" />
                Simplified
              </button>
              <div className="w-px bg-border" />
              <button
                onClick={() => setCollapsedView(false)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  !collapsedView
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <FileCode2 className="size-3.5" />
                Detailed
              </button>
            </div>

            {/* Collapse button — appears when a group is expanded */}
            <AnimatePresence>
              {collapsedView && expandedLayer !== null && (
                <motion.button
                  key="collapse-group"
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={collapseAllLayers}
                  className="glass-panel rounded-lg border border-border px-3 py-2 text-xs font-medium shadow-md transition-colors hover:bg-muted"
                >
                  Collapse group
                </motion.button>
              )}
            </AnimatePresence>

            {/* Ownership legend */}
            {viewMode === 'ownership' && <ContributorLegend />}
          </div>
        </Panel>

        <GraphMinimap />
      </ReactFlow>

      <NLQueryPanel open={queryOpen} onOpenChange={setQueryOpen} repoId={graph.meta.repoId} />
      <FlowDiagramModal
        open={flowOpen}
        onOpenChange={setFlowOpen}
        repoId={graph.meta.repoId}
        fileIds={selectedNodeIds}
      />
    </div>
  )
}
