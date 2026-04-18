export function PriorityProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total ? (done / total) * 100 : 0
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>Files understood</span>
        <span className="font-mono text-primary">{done} / {total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
