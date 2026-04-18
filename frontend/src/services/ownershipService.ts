import { api, hasConfiguredApi } from './api'
import { demoFiles } from '../lib/mockData'
import type { FileNode } from '../types'

export async function fetchOwnership(repoId: string) {
  if (hasConfiguredApi()) {
    const { data } = await api.get(`/api/repos/${repoId}/ownership`)
    return data
  }
  return demoFiles.map((file) => ({ fileId: file.id, owners: file.owners, primaryOwner: file.primaryOwner }))
}

export async function fetchFileOwnership(repoId: string, fileId: string) {
  if (hasConfiguredApi()) {
    const { data } = await api.get(`/api/repos/${repoId}/ownership/${fileId}`)
    return data
  }
  return demoFiles.find((file) => file.id === fileId)?.owners ?? []
}

export async function fetchAuthorFiles(repoId: string, authorName: string): Promise<FileNode[]> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<FileNode[]>(`/api/repos/${repoId}/ownership/author/${authorName}`)
    return data
  }
  return demoFiles.filter((file) => file.primaryOwner === authorName)
}
