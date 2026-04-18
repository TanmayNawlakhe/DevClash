import { api, hasRepoApi } from './api'
import { demoRepos } from '../lib/mockData'
import { adaptRepoStatus } from '../lib/repoAdapters'
import { sleep } from '../lib/utils'
import type { Repo } from '../types'

export async function fetchRepos(): Promise<Repo[]> {
  if (hasRepoApi()) {
    const { data } = await api.get<{ items: any[] }>('/api/repos')
    return data.items.map(adaptRepoStatus)
  }

  await sleep(250)
  return demoRepos
}

export async function fetchRepoStatus(repoId: string): Promise<Repo> {
  if (hasRepoApi()) {
    const { data } = await api.get<any>(`/api/repos/${repoId}`)
    return adaptRepoStatus(data)
  }

  await sleep(200)
  return demoRepos.find((repo) => repo.id === repoId) ?? demoRepos[0]
}

export async function submitRepoAnalysis(githubUrl: string): Promise<Repo> {
  if (hasRepoApi()) {
    const { data } = await api.post<any>('/api/repos', { github_url: githubUrl })
    return adaptRepoStatus({
      ...data,
      created_at: new Date().toISOString(),
      completed_at: null,
      error_msg: null,
      node_count: 0,
      edge_count: 0,
      progress: {
        stage: 'queued',
        percent: 0,
        current_file: null,
        updated_at: new Date().toISOString(),
      },
    })
  }

  await sleep(300)
  const [, owner = 'demo', name = 'repository'] = githubUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/) ?? []
  return {
    id: `${owner}-${name}`.toLowerCase(),
    owner,
    name: name.replace(/\.git$/, ''),
    githubUrl,
    branch: 'main',
    languages: ['TypeScript', 'JavaScript'],
    files: 842,
    nodes: 76,
    edges: 188,
    status: 'analyzing',
    lastAnalyzed: new Date().toISOString(),
  }
}

export async function cancelRepoAnalysis(repoId: string) {
  const { data } = await api.post<{ message: string } & Record<string, unknown>>(`/api/repos/${repoId}/cancel`)
  return data
}

export async function retryRepoAnalysis(repoId: string) {
  const { data } = await api.post<{ message: string } & Record<string, unknown>>(`/api/repos/${repoId}/retry`)
  return data
}
