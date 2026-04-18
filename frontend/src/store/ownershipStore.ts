import { create } from 'zustand'
import { buildOwnerPalette } from '../lib/ownershipColors'
import { demoFiles } from '../lib/mockData'

const authors = Array.from(new Set(demoFiles.flatMap((file) => file.owners.map((owner) => owner.author))))

interface OwnershipState {
  selectedContributor: string | null
  contributorPalette: Record<string, string>
  contributors: string[]
  setSelectedContributor: (name: string | null) => void
}

export const useOwnershipStore = create<OwnershipState>((set) => ({
  selectedContributor: null,
  contributorPalette: buildOwnerPalette(authors),
  contributors: authors,
  setSelectedContributor: (selectedContributor) => set({ selectedContributor }),
}))
