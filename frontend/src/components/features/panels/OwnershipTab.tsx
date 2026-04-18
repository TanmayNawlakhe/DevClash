import { AlertTriangle } from 'lucide-react'
import type { FileNode } from '../../../types'
import { OwnershipBarChart } from '../ownership/OwnershipBarChart'

export function OwnershipTab({ file }: { file: FileNode }) {
  const busFactorRisk = file.owners.some((owner) => owner.ownershipPct > 0.9)

  return (
    <div className="space-y-4">
      {busFactorRisk ? (
        <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Bus Factor Risk: a single contributor owns more than 90% of this file.
        </div>
      ) : null}
      <OwnershipBarChart owners={file.owners} />
    </div>
  )
}
