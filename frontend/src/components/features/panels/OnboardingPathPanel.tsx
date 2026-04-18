import { useGraphStore } from '../../../store/graphStore'
import { usePriorityStore } from '../../../store/priorityStore'
import { useRepoStore } from '../../../store/repoStore'
import { truncatePath } from '../../../lib/utils'

export function OnboardingPathPanel() {
  const graph = useRepoStore((state) => state.graphData)
  const rankings = usePriorityStore((state) => state.rankings)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <p className="text-sm text-muted-foreground">Time-to-Understanding</p>
        <p className="font-mono text-2xl font-semibold text-primary">~{graph?.meta.timeToUnderstandingHours ?? 3.2}h</p>
      </div>
      <div className="space-y-2">
        {rankings.slice(0, 7).map((entry) => (
          <button key={entry.fileId} onClick={() => setSelectedNode(entry.fileId)} className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-accent">
            <div className="font-mono text-xs text-primary">#{entry.rank}</div>
            <div className="mt-1 truncate font-mono text-sm">{truncatePath(entry.path, 34)}</div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.reason}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
