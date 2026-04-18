import { useMemo } from 'react'
import { blastRadius } from '../lib/graphUtils'
import type { GraphEdge } from '../types'

export function useBlastRadius(seedId: string | null, edges: GraphEdge[], enabled = true) {
  return useMemo(() => {
    if (!seedId || !enabled) return new Map<string, number>()
    return blastRadius(seedId, edges)
  }, [seedId, edges, enabled])
}
