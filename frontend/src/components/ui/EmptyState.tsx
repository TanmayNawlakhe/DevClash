import type { ReactNode } from 'react'
import { Button } from './Button'

export function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-8 text-center">
      {illustration ? <div className="mb-4">{illustration}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <Button className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
