import { create } from 'zustand'
import { buildOwnerPalette } from '../lib/ownershipColors'
import { demoFiles } from '../lib/mockData'
import type { FileNode } from '../types'

const authors = Array.from(new Set(demoFiles.flatMap((file) => file.owners.map((owner) => owner.author))))
const defaultCounts = Object.fromEntries(
  authors.map((author) => [author, demoFiles.filter((file) => file.primaryOwner === author).length]),
)

interface OwnershipState {
  selectedContributor: string | null
  contributorPalette: Record<string, string>
  contributors: string[]
  contributorCounts: Record<string, number>
  setSelectedContributor: (name: string | null) => void
  setContributorsFromFiles: (files: FileNode[]) => void
}

export const useOwnershipStore = create<OwnershipState>((set) => ({
  selectedContributor: null,
  contributorPalette: buildOwnerPalette(authors),
  contributors: authors,
  contributorCounts: defaultCounts,
  setSelectedContributor: (selectedContributor) => set({ selectedContributor }),
  setContributorsFromFiles: (files) => {
    const nextAuthors = Array.from(new Set(files.flatMap((file) => file.owners.map((owner) => owner.author))))
    const contributors = nextAuthors.length ? nextAuthors : authors
    const contributorCounts = Object.fromEntries(
      contributors.map((author) => [author, files.filter((file) => file.primaryOwner === author).length]),
    )

    set({
      contributors,
      contributorPalette: buildOwnerPalette(contributors),
      contributorCounts,
      selectedContributor: null,
    })
  },
}))
