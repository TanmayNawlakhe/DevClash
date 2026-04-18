import { api, hasConfiguredApi } from './api'
import { demoRepos } from '../lib/mockData'
import { sleep } from '../lib/utils'
import type { Repo } from '../types'

export async function fetchRepos(): Promise<Repo[]> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<Repo[]>('/api/repos')
    return data
  }

  await sleep(250)
  return demoRepos
}

export async function submitRepoAnalysis(githubUrl: string): Promise<Repo> {
  if (hasConfiguredApi()) {
    const { data } = await api.post<Repo>('/api/repos/analyze', { github_url: githubUrl })
    return data
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
