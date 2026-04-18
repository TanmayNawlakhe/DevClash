import { api, hasConfiguredApi } from './api'
import { demoGraph, demoPriority } from '../lib/mockData'
import type { GraphData, PriorityEntry } from '../types'

export async function fetchPriority(repoId: string): Promise<PriorityEntry[]> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<PriorityEntry[]>(`/api/repos/${repoId}/priority`)
    return data
  }
  return demoPriority
}

export async function fetchPriorityGraph(repoId: string): Promise<GraphData> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<GraphData>(`/api/repos/${repoId}/priority/graph`)
    return data
  }
  return demoGraph
}
