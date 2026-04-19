import { create } from 'zustand'
import type { FilterState, Layer, LayoutMode, ViewMode } from '../types'

interface GraphState {
  viewMode: ViewMode
  layoutMode: LayoutMode
  selectedNodeId: string | null
  selectedNodeIds: string[]
  hoveredNodeId: string | null
  blastRadiusEnabled: boolean
  filters: FilterState
  collapsedView: boolean
  /** Only one layer may be expanded at a time to avoid overlap. */
  expandedLayer: Layer | null
  setViewMode: (mode: ViewMode) => void
  setLayoutMode: (mode: LayoutMode) => void
  setSelectedNode: (id: string | null) => void
  setSelectedNodes: (ids: string[]) => void
  setHoveredNode: (id: string | null) => void
  setFilters: (filters: Partial<FilterState>) => void
  toggleBlastRadius: () => void
  resetFilters: () => void
  setCollapsedView: (v: boolean) => void
  toggleLayerExpanded: (layer: Layer) => void
  collapseAllLayers: () => void
}

const defaultFilters: FilterState = {
  layers: [],
  languages: [],
  search: '',
  showOrphans: true,
  entryOnly: false,
}

export const useGraphStore = create<GraphState>((set) => ({
  viewMode: 'dependency',
  layoutMode: 'hierarchical',
  selectedNodeId: null,
  selectedNodeIds: [],
  hoveredNodeId: null,
  blastRadiusEnabled: true,
  filters: defaultFilters,
  collapsedView: true,
  expandedLayer: null,
  setViewMode: (viewMode) => set((state) => (state.viewMode === viewMode ? state : { viewMode })),
  setLayoutMode: (layoutMode) => set((state) => (state.layoutMode === layoutMode ? state : { layoutMode })),
  setSelectedNode: (selectedNodeId) =>
    set((state) => {
      const nextIds = selectedNodeId ? [selectedNodeId] : []
      const sameIds =
        state.selectedNodeIds.length === nextIds.length &&
        state.selectedNodeIds.every((id, index) => id === nextIds[index])
      if (state.selectedNodeId === selectedNodeId && sameIds) return state
      return { selectedNodeId, selectedNodeIds: nextIds }
    }),
  setSelectedNodes: (selectedNodeIds) =>
    set((state) => {
      const sameIds =
        state.selectedNodeIds.length === selectedNodeIds.length &&
        state.selectedNodeIds.every((id, index) => id === selectedNodeIds[index])
      const nextSelected = selectedNodeIds.length ? selectedNodeIds[0] : state.selectedNodeId
      if (sameIds && state.selectedNodeId === nextSelected) return state
      return { selectedNodeIds, selectedNodeId: nextSelected }
    }),
  setHoveredNode: (hoveredNodeId) =>
    set((state) => (state.hoveredNodeId === hoveredNodeId ? state : { hoveredNodeId })),
  setFilters: (filters) =>
    set((state) => {
      const nextFilters = { ...state.filters, ...filters }
      const unchanged =
        state.filters.layers.length === nextFilters.layers.length &&
        state.filters.layers.every((l, i) => l === nextFilters.layers[i]) &&
        state.filters.languages.length === nextFilters.languages.length &&
        state.filters.languages.every((l, i) => l === nextFilters.languages[i]) &&
        state.filters.search === nextFilters.search &&
        state.filters.showOrphans === nextFilters.showOrphans &&
        state.filters.entryOnly === nextFilters.entryOnly
      return unchanged ? state : { filters: nextFilters }
    }),
  toggleBlastRadius: () => set((state) => ({ blastRadiusEnabled: !state.blastRadiusEnabled })),
  resetFilters: () => set({ filters: defaultFilters }),
  setCollapsedView: (collapsedView) => set({ collapsedView }),
  // Clicking the same layer again collapses it; clicking a new one switches the expansion.
  toggleLayerExpanded: (layer) =>
    set((state) => ({ expandedLayer: state.expandedLayer === layer ? null : layer })),
  collapseAllLayers: () => set({ expandedLayer: null }),
}))
