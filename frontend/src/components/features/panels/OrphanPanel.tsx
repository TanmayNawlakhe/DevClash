import { AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRepoStore } from '../../../store/repoStore'
import { formatNumber, truncatePath } from '../../../lib/utils'

export function OrphanPanel() {
  const graph = useRepoStore((state) => state.graphData)
  const orphans = graph?.nodes.filter((node) => node.isOrphan) ?? []

  return (
    <div className="space-y-3">
      {orphans.map((file) => (
        <div key={file.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <span className="font-mono text-sm">{truncatePath(file.path, 34)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-muted-foreground">
            <span>{formatNumber(file.sizeBytes)} bytes</span>
            <span>{formatDistanceToNow(new Date(file.owners[0].lastCommitDate), { addSuffix: true })}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Technical debt cost: ~{Math.max(1, Math.round(file.lines / 45))} hours</p>
        </div>
      ))}
    </div>
  )
}
