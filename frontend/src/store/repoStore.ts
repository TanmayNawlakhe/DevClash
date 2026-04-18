import { create } from 'zustand'
import type { AnalysisStatus, GraphData, Repo } from '../types'
import { demoRepos } from '../lib/mockData'

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function areProgressEqual(left: Repo['progress'], right: Repo['progress']) {
  if (!left && !right) return true
  if (!left || !right) return false

  return (
    left.stage === right.stage
    && left.percent === right.percent
    && left.currentFile === right.currentFile
    && left.updatedAt === right.updatedAt
  )
}

function areReposEqual(left: Repo, right: Repo) {
  return (
    left.id === right.id
    && left.owner === right.owner
    && left.name === right.name
    && left.githubUrl === right.githubUrl
    && left.branch === right.branch
    && areStringArraysEqual(left.languages, right.languages)
    && left.files === right.files
    && left.nodes === right.nodes
    && left.edges === right.edges
    && left.status === right.status
    && left.lastAnalyzed === right.lastAnalyzed
    && left.createdAt === right.createdAt
    && left.completedAt === right.completedAt
    && left.errorMessage === right.errorMessage
    && areProgressEqual(left.progress, right.progress)
  )
}

function areRepoListsEqual(left: Repo[], right: Repo[]) {
  if (left.length !== right.length) return false
  return left.every((repo, index) => areReposEqual(repo, right[index]))
}

interface RepoState {
  currentRepo: Repo | null
  repos: Repo[]
  analysisStatus: AnalysisStatus
  analysisProgress: number
  currentStage: string
  graphData: GraphData | null
  liveLog: string[]
  setRepo: (repo: Repo) => void
  upsertRepo: (repo: Repo) => void
  addRepo: (repo: Repo) => void
  setRepos: (repos: Repo[]) => void
  setGraphData: (graph: GraphData | null) => void
  setAnalysisStatus: (status: AnalysisStatus, progress: number, stage: string, log?: string) => void
}

export const useRepoStore = create<RepoState>((set) => ({
  currentRepo: null,
  repos: demoRepos,
  analysisStatus: 'idle',
  analysisProgress: 0,
  currentStage: 'Waiting for analysis',
  graphData: null,
  liveLog: [],
  setRepo: (repo) =>
    set((state) => {
      if (state.currentRepo && areReposEqual(state.currentRepo, repo)) {
        return state
      }
      return { currentRepo: repo }
    }),
  upsertRepo: (repo) =>
    set((state) => {
      const mergeRepo = (current: Repo, incoming: Repo): Repo => ({
        ...current,
        ...incoming,
        branch: incoming.branch || current.branch,
        languages: incoming.languages.length ? incoming.languages : current.languages,
        files: incoming.files || current.files,
        nodes: incoming.nodes || current.nodes,
        edges: incoming.edges || current.edges,
      })

      const existingRepo = state.repos.find((item) => item.id === repo.id)

      if (!existingRepo) {
        const nextCurrentRepo = state.currentRepo?.id === repo.id ? repo : state.currentRepo
        return {
          repos: [repo, ...state.repos],
          currentRepo: nextCurrentRepo,
        }
      }

      const mergedRepo = mergeRepo(existingRepo, repo)
      const repoChanged = !areReposEqual(existingRepo, mergedRepo)
      const currentRepoChanged = state.currentRepo?.id === repo.id
        ? !areReposEqual(state.currentRepo, mergedRepo)
        : false

      if (!repoChanged && !currentRepoChanged) {
        return state
      }

      const repos = repoChanged
        ? state.repos.map((item) => (item.id === repo.id ? mergedRepo : item))
        : state.repos

      return {
        repos,
        currentRepo: state.currentRepo?.id === repo.id ? mergedRepo : state.currentRepo,
      }
    }),
  addRepo: (repo) =>
    set((state) => {
      const repos = [repo, ...state.repos.filter((item) => item.id !== repo.id)]
      return { repos, currentRepo: repo }
    }),
  setRepos: (repos) =>
    set((state) => {
      const currentRepo = state.currentRepo
        ? repos.find((repo) => repo.id === state.currentRepo?.id) ?? state.currentRepo
        : state.currentRepo

      const hasRepoListChange = !areRepoListsEqual(state.repos, repos)
      const hasCurrentRepoChange = state.currentRepo && currentRepo
        ? !areReposEqual(state.currentRepo, currentRepo)
        : state.currentRepo !== currentRepo

      if (!hasRepoListChange && !hasCurrentRepoChange) {
        return state
      }

      return {
        repos,
        currentRepo,
      }
    }),
  setGraphData: (graphData) =>
    set((state) => {
      if (state.graphData === graphData) {
        return state
      }
      return { graphData }
    }),
  setAnalysisStatus: (analysisStatus, analysisProgress, currentStage, log) =>
    set((state) => {
      const nextLiveLog = log ? [...state.liveLog.slice(-8), log] : state.liveLog
      const hasSameStatus =
        state.analysisStatus === analysisStatus
        && state.analysisProgress === analysisProgress
        && state.currentStage === currentStage
      const hasSameLogs = state.liveLog.length === nextLiveLog.length
        && state.liveLog.every((item, index) => item === nextLiveLog[index])

      if (hasSameStatus && hasSameLogs) {
        return state
      }

      return {
        analysisStatus,
        analysisProgress,
        currentStage,
        liveLog: nextLiveLog,
      }
    }),
}))
