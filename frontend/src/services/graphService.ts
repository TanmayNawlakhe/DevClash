import { api, hasConfiguredApi, hasRepoApi } from './api'
import { demoCode, demoFiles, demoGraph } from '../lib/mockData'
import { adaptRepoFileDetail, adaptRepoGraph, searchGraphSummaries } from '../lib/repoAdapters'
import { sleep } from '../lib/utils'
import type { FileDetail, GraphData, QueryResult } from '../types'

export async function fetchGraph(repoId: string): Promise<GraphData> {
  if (hasRepoApi()) {
    const { data } = await api.get<any>(`/api/repos/${repoId}/graph`)
    return adaptRepoGraph(data)
  }

  await sleep(250)
  return demoGraph
}

export async function fetchFileDetail(repoId: string, fileId: string, graph: GraphData | null): Promise<FileDetail> {
  if (hasRepoApi()) {
    const { data } = await api.get<any>(`/api/repos/${repoId}/files/${fileId}`)
    return adaptRepoFileDetail(repoId, data, graph)
  }

  await sleep(200)
  const file = demoFiles.find((item) => item.id === fileId) ?? demoFiles[0]
  const outgoingIds = demoGraph.edges.filter((edge) => edge.source === file.id).map((edge) => edge.target)
  const incomingIds = demoGraph.edges.filter((edge) => edge.target === file.id).map((edge) => edge.source)
  return {
    ...file,
    code: demoCode[file.id] ?? sampleCode(file.path),
    imports: demoFiles.filter((item) => outgoingIds.includes(item.id)),
    dependents: demoFiles.filter((item) => incomingIds.includes(item.id)),
  }
}

export async function fetchRepoSummaries(repoId: string) {
  if (hasRepoApi()) {
    const { data } = await api.get<any>(`/api/repos/${repoId}/summaries`)
    return data
  }

  await sleep(200)
  return {
    repo_id: repoId,
    total_files: demoGraph.nodes.length,
    summarized_files: demoGraph.nodes.length,
    summaries: demoGraph.nodes.map((node) => ({
      path: node.id,
      summary: node.summary,
    })),
  }
}

export async function fetchHeatmap(repoId: string) {
  if (hasConfiguredApi()) {
    const { data } = await api.get(`/api/repos/${repoId}/heatmap`)
    return data
  }
  return demoGraph.nodes.map((node) => ({ fileId: node.id, score: node.centrality }))
}

export async function submitNLQuery(repoId: string, query: string): Promise<QueryResult> {
  if (hasRepoApi()) {
    try {
      const { data } = await api.post<any>(`/api/repos/${repoId}/search`, {
        query,
        top_files: 8,
        top_functions: 5,
        min_score: 0.3,
      })

      return {
        fileIds: (data.flow ?? []).map((entry: any) => entry.file_path),
        results: (data.flow ?? []).map((entry: any) => ({
          fileId: entry.file_path,
          path: entry.file_path,
          score: entry.relevance_score,
          snippet: entry.summary,
        })),
        answer: data.answer,
        mermaid: data.mermaid,
        totalMatched: data.total_matched,
        flow: (data.flow ?? []).map((entry: any) => ({
          rank: entry.rank,
          fileId: entry.file_path,
          path: entry.file_path,
          score: entry.relevance_score,
          scoreBreakdown: entry.score_breakdown ?? {},
          layer: entry.layer,
          language: entry.language,
          isEntry: entry.is_entry,
          summary: entry.summary,
          matchedFunctions: (entry.matched_functions ?? []).map((fn: any) => ({
            name: fn.name,
            score: fn.score,
          })),
        })),
      }
    } catch (error: any) {
      if (error?.response?.status && error.response.status !== 404) {
        throw error
      }
    }

    const graph = await fetchGraph(repoId)
    let summariesPayload: { summaries: Array<{ path: string; summary: string }> } = { summaries: [] }

    try {
      summariesPayload = await fetchRepoSummaries(repoId)
    } catch {
      // Keep query usable even if summaries are not available for an older repo.
    }

    const enrichedGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        summary:
          summariesPayload.summaries.find((item: { path: string; summary: string }) => item.path === node.id)?.summary ??
          node.summary,
      })),
    }
    return searchGraphSummaries(enrichedGraph, query)
  }

  await sleep(450)
  const normalized = query.toLowerCase()
  const matches = demoFiles
    .filter((file) => file.path.toLowerCase().includes(normalized.split(' ')[0]) || file.summary.toLowerCase().includes('graph'))
    .slice(0, 4)
  return {
    fileIds: matches.map((file) => file.id),
    results: matches.map((file, index) => ({
      fileId: file.id,
      path: file.path,
      score: 0.94 - index * 0.09,
      snippet: file.summary,
    })),
  }
}

function sampleCode(path: string) {
  return `export function inspect() {
  return {
    path: '${path}',
    purpose: 'Architecture context for Gittsurī',
  }
}`
}
