import type { OwnerShare } from '../../../types'
import { ownershipColor } from '../../../lib/ownershipColors'

export function OwnershipBarChart({ owners }: { owners: OwnerShare[] }) {
  return (
    <div className="space-y-3">
      {owners.map((owner) => (
        <div key={owner.author}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{owner.author}</span>
            <span className="font-mono text-muted-foreground">{Math.round(owner.ownershipPct * 100)}% / {owner.linesOwned} lines</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${owner.ownershipPct * 100}%`, background: ownershipColor(owner.author) }} />
          </div>
        </div>
      ))}
    </div>
  )
}
