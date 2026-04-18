import { useOwnershipStore } from '../../../store/ownershipStore'
import { cn } from '../../../lib/utils'

export function ContributorLegend() {
  const contributors = useOwnershipStore((state) => state.contributors)
  const contributorCounts = useOwnershipStore((state) => state.contributorCounts)
  const palette = useOwnershipStore((state) => state.contributorPalette)
  const selected = useOwnershipStore((state) => state.selectedContributor)
  const setSelected = useOwnershipStore((state) => state.setSelectedContributor)

  return (
    <div className="glass-panel w-64 rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contributors</h3>
        {selected ? (
          <button className="text-xs text-primary hover:underline" onClick={() => setSelected(null)}>
            Clear
          </button>
        ) : null}
      </div>
      <div className="space-y-1">
        {contributors.map((name) => {
          const count = contributorCounts[name] ?? 0
          return (
            <button
              key={name}
              onClick={() => setSelected(selected === name ? null : name)}
              className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent', selected === name && 'bg-accent')}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: palette[name] }} />
                {name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
