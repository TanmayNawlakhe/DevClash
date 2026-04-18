import { api, hasConfiguredApi } from './api'
import { demoFlow } from '../lib/mockData'
import { sleep } from '../lib/utils'
import type { FlowDiagramResult } from '../types'

export async function generateFlowDiagram(
  repoId: string,
  fileIds: string[],
  diagramType: 'functional' | 'data' | 'combined',
): Promise<FlowDiagramResult> {
  if (hasConfiguredApi()) {
    const { data } = await api.post<FlowDiagramResult>(`/api/repos/${repoId}/flow`, {
      file_ids: fileIds,
      diagram_type: diagramType,
    })
    return data
  }

  await sleep(700)
  return {
    ...demoFlow,
    diagramId: `${demoFlow.diagramId}_${diagramType}_${fileIds.join('_')}`,
  }
}

export async function fetchFlowDiagram(repoId: string, diagramId: string): Promise<FlowDiagramResult> {
  if (hasConfiguredApi()) {
    const { data } = await api.get<FlowDiagramResult>(`/api/repos/${repoId}/flow/${diagramId}`)
    return data
  }

  await sleep(250)
  return demoFlow
}
