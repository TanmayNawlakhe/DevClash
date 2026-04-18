import { create } from 'zustand'
import type { AnalysisStatus, GraphData, Repo } from '../types'
import { demoGraph, demoRepos } from '../lib/mockData'

interface RepoState {
  currentRepo: Repo | null
  repos: Repo[]
  analysisStatus: AnalysisStatus
  analysisProgress: number
  currentStage: string
  graphData: GraphData | null
  liveLog: string[]
  setRepo: (repo: Repo) => void
  addRepo: (repo: Repo) => void
  setRepos: (repos: Repo[]) => void
  setGraphData: (graph: GraphData) => void
  setAnalysisStatus: (status: AnalysisStatus, progress: number, stage: string, log?: string) => void
}

export const useRepoStore = create<RepoState>((set) => ({
  currentRepo: demoRepos[0],
  repos: demoRepos,
  analysisStatus: 'complete',
  analysisProgress: 100,
  currentStage: 'Architecture map ready',
  graphData: demoGraph,
  liveLog: ['Loaded cached graph snapshot for facebook/react'],
  setRepo: (repo) => set({ currentRepo: repo }),
  addRepo: (repo) => set((state) => ({ repos: [repo, ...state.repos], currentRepo: repo })),
  setRepos: (repos) => set({ repos }),
  setGraphData: (graphData) => set({ graphData }),
  setAnalysisStatus: (analysisStatus, analysisProgress, currentStage, log) =>
    set((state) => ({
      analysisStatus,
      analysisProgress,
      currentStage,
      liveLog: log ? [...state.liveLog.slice(-8), log] : state.liveLog,
    })),
}))
