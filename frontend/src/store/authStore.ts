import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User | null) => void
  syncSession: (payload: { token: string | null; user: User | null }) => void
  setHasHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      setUser: (user) => set((state) => ({ user, isAuthenticated: Boolean(state.token && user) })),
      syncSession: ({ token, user }) => set({ token, user, isAuthenticated: Boolean(token && user) }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'arclens-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
