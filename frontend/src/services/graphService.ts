import { api, hasConfiguredApi } from './api'
import { demoCode, demoFiles, demoGraph } from '../lib/mockData'
import { sleep } from '../lib/utils'
import type { FileDetail, GraphData, QueryResult } from '../types'

export async function fetchGraph(repoId: string): Promise<GraphData> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<GraphData>(`/api/repos/${repoId}/graph`)
    return data
  }

  await sleep(250)
  return demoGraph
}

export async function fetchFileDetail(repoId: string, fileId: string): Promise<FileDetail> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<FileDetail>(`/api/repos/${repoId}/files/${fileId}`)
    return data
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

export async function fetchHeatmap(repoId: string) {
  if (hasConfiguredApi()) {
    const { data } = await api.get(`/api/repos/${repoId}/heatmap`)
    return data
  }
  return demoGraph.nodes.map((node) => ({ fileId: node.id, score: node.centrality }))
}

export async function submitNLQuery(repoId: string, query: string): Promise<QueryResult> {
  if (hasConfiguredApi()) {
    const { data } = await api.post<QueryResult>(`/api/repos/${repoId}/query`, { query })
    return data
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
