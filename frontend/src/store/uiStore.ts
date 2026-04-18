import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PanelId } from '../types'

interface UIState {
  sidebarOpen: boolean
  darkMode: boolean
  mobileNavOpen: boolean
  activePanel: PanelId
  toggleSidebar: () => void
  toggleDarkMode: () => void
  setDarkMode: (darkMode: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setActivePanel: (panel: PanelId) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      darkMode: false,
      mobileNavOpen: false,
      activePanel: null,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (darkMode) => set((state) => (state.darkMode === darkMode ? state : { darkMode })),
      setMobileNavOpen: (mobileNavOpen) => set((state) => (state.mobileNavOpen === mobileNavOpen ? state : { mobileNavOpen })),
      setActivePanel: (activePanel) => set((state) => (state.activePanel === activePanel ? state : { activePanel })),
    }),
    {
      name: 'arclens-ui',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen, darkMode: state.darkMode }),
    },
  ),
)
