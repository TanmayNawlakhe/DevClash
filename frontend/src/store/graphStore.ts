import { create } from 'zustand'
import type { FilterState, LayoutMode, ViewMode } from '../types'

interface GraphState {
  viewMode: ViewMode
  layoutMode: LayoutMode
  selectedNodeId: string | null
  selectedNodeIds: string[]
  hoveredNodeId: string | null
  blastRadiusEnabled: boolean
  filters: FilterState
  setViewMode: (mode: ViewMode) => void
  setLayoutMode: (mode: LayoutMode) => void
  setSelectedNode: (id: string | null) => void
  setSelectedNodes: (ids: string[]) => void
  setHoveredNode: (id: string | null) => void
  setFilters: (filters: Partial<FilterState>) => void
  toggleBlastRadius: () => void
  resetFilters: () => void
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
  setViewMode: (viewMode) => set((state) => (state.viewMode === viewMode ? state : { viewMode })),
  setLayoutMode: (layoutMode) => set((state) => (state.layoutMode === layoutMode ? state : { layoutMode })),
  setSelectedNode: (selectedNodeId) =>
    set((state) => {
      const nextIds = selectedNodeId ? [selectedNodeId] : []
      const sameIds = state.selectedNodeIds.length === nextIds.length && state.selectedNodeIds.every((id, index) => id === nextIds[index])
      if (state.selectedNodeId === selectedNodeId && sameIds) return state
      return { selectedNodeId, selectedNodeIds: nextIds }
    }),
  setSelectedNodes: (selectedNodeIds) =>
    set((state) => {
      const sameIds = state.selectedNodeIds.length === selectedNodeIds.length && state.selectedNodeIds.every((id, index) => id === selectedNodeIds[index])
      const nextSelected = selectedNodeIds.length ? selectedNodeIds[0] : state.selectedNodeId
      if (sameIds && state.selectedNodeId === nextSelected) return state
      return {
        selectedNodeIds,
        selectedNodeId: nextSelected,
      }
    }),
  setHoveredNode: (hoveredNodeId) => set((state) => (state.hoveredNodeId === hoveredNodeId ? state : { hoveredNodeId })),
  setFilters: (filters) =>
    set((state) => {
      const nextFilters = { ...state.filters, ...filters }
      const unchanged =
        state.filters.layers.length === nextFilters.layers.length &&
        state.filters.layers.every((layer, index) => layer === nextFilters.layers[index]) &&
        state.filters.languages.length === nextFilters.languages.length &&
        state.filters.languages.every((language, index) => language === nextFilters.languages[index]) &&
        state.filters.search === nextFilters.search &&
        state.filters.showOrphans === nextFilters.showOrphans &&
        state.filters.entryOnly === nextFilters.entryOnly
      return unchanged ? state : { filters: nextFilters }
    }),
  toggleBlastRadius: () => set((state) => ({ blastRadiusEnabled: !state.blastRadiusEnabled })),
  resetFilters: () => set({ filters: defaultFilters }),
}))
