import { create } from 'zustand'
import type { PriorityEntry } from '../types'
import { demoPriority } from '../lib/mockData'

interface PriorityState {
  rankings: PriorityEntry[]
  checkedFileIds: Set<string>
  isReady: boolean
  toggleChecked: (fileId: string) => void
  setRankings: (rankings: PriorityEntry[]) => void
  resetChecked: () => void
}

export const usePriorityStore = create<PriorityState>((set) => ({
  rankings: demoPriority,
  checkedFileIds: new Set(['f1', 'f4']),
  isReady: true,
  toggleChecked: (fileId) =>
    set((state) => {
      const checkedFileIds = new Set(state.checkedFileIds)
      if (checkedFileIds.has(fileId)) checkedFileIds.delete(fileId)
      else checkedFileIds.add(fileId)
      return { checkedFileIds }
    }),
  setRankings: (rankings) => set({ rankings, isReady: true }),
  resetChecked: () => set({ checkedFileIds: new Set() }),
}))
