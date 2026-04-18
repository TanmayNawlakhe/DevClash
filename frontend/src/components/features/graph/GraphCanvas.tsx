import {
  Background,
  BackgroundVariant,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GraphToolbar } from './GraphToolbar'
import { GraphMinimap } from './GraphMinimap'
import { NodeCustom } from './NodeCustom'
import { EdgeCustom } from './EdgeCustom'
import { ContributorLegend } from '../ownership/ContributorLegend'
import { FlowDiagramModal } from '../panels/FlowDiagramModal'
import { NLQueryPanel } from '../panels/NLQueryPanel'
import { mapToFlowEdges, mapToFlowNodes } from '../../../lib/graphUtils'
import { useBlastRadius } from '../../../hooks/useBlastRadius'
import { useGraphStore } from '../../../store/graphStore'
import { useOwnershipStore } from '../../../store/ownershipStore'
import { useUIStore } from '../../../store/uiStore'
import type { GraphData } from '../../../types'

const nodeTypes = { architecture: NodeCustom }
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
  const selectedContributor = useOwnershipStore((state) => state.selectedContributor)
  const setActivePanel = useUIStore((state) => state.setActivePanel)
  const { fitView } = useReactFlow()

  const [queryOpen, setQueryOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const blastMap = useBlastRadius(hoveredNodeId, graph.edges, blastRadiusEnabled)

  const filteredGraph = useMemo(() => {
    const search = filters.search.toLowerCase()
    const allowedNodes = graph.nodes.filter((node) => {
      if (!filters.showOrphans && node.isOrphan) return false
      if (filters.entryOnly && !node.isEntry) return false
      if (filters.layers.length && !filters.layers.includes(node.layer)) return false
      if (filters.languages.length && !filters.languages.includes(node.language)) return false
      if (search && !node.path.toLowerCase().includes(search) && !node.summary.toLowerCase().includes(search)) return false
      return true
    })
    const allowedIds = new Set(allowedNodes.map((node) => node.id))
    return {
      nodes: allowedNodes,
      edges: graph.edges.filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target)),
      meta: graph.meta,
    }
  }, [filters, graph])

  useEffect(() => {
    const nextNodes = mapToFlowNodes(filteredGraph, viewMode, layoutMode).map((node) => ({
      ...node,
      data: { ...node.data, blastDepth: blastMap.get(node.id) },
      hidden: selectedContributor ? node.data.primaryOwner !== selectedContributor : false,
    }))
    const nextEdges = mapToFlowEdges(filteredGraph.edges).map((edge) => ({
      ...edge,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: 'color-mix(in oklch, var(--primary) 60%, var(--border))',
      },
    }))
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [blastMap, filteredGraph, layoutMode, selectedContributor, setEdges, setNodes, viewMode])

  useEffect(() => {
    const timeout = window.setTimeout(() => fitView({ padding: 0.24, duration: 700 }), 80)
    return () => window.clearTimeout(timeout)
  }, [filters.entryOnly, filters.layers, filters.languages, filters.search, filters.showOrphans, fitView, layoutMode, viewMode])

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
      setSelectedNode(node.id)
      setActivePanel('file')
    },
    [setActivePanel, setSelectedNode],
  )

  return (
    <div className="canvas-shell premium-grid relative h-full min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
        onNodeMouseLeave={() => setHoveredNode(null)}
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
        fitViewOptions={{ padding: 0.24, duration: 700 }}
        minZoom={0.25}
        maxZoom={1.7}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="color-mix(in oklch, var(--primary) 22%, transparent)"
        />

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
                  <GraphToolbar onOpenQuery={() => { setQueryOpen(true); setToolbarOpen(false) }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>

        {viewMode === 'ownership' ? (
          <Panel position="top-right">
            <ContributorLegend />
          </Panel>
        ) : null}

        <Panel position="bottom-left">
          <button
            className="glass-panel rounded-lg px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent"
            onClick={() => setFlowOpen(true)}
          >
            Explain Module Flow
            {selectedNodeIds.length > 1 ? (
              <span className="ml-2 font-mono text-xs text-primary">{selectedNodeIds.length} files</span>
            ) : null}
          </button>
        </Panel>

        <GraphMinimap />
      </ReactFlow>

      <NLQueryPanel open={queryOpen} onOpenChange={setQueryOpen} repoId={graph.meta.repoId} />
      <FlowDiagramModal open={flowOpen} onOpenChange={setFlowOpen} repoId={graph.meta.repoId} fileIds={selectedNodeIds} />
    </div>
  )
}
