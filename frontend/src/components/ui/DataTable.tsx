import { AnimatePresence, motion } from 'framer-motion'
import { Skeleton } from './Skeleton'

interface Column<T> {
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  empty,
  onRowClick,
}: {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  if (!data.length) return <>{empty}</>

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 border-b border-border bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={`px-5 py-3.5 font-semibold ${column.className ?? ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {data.map((row, index) => (
              <motion.tr
                key={row.id}
                className="group cursor-pointer border-t border-border/60 transition-colors hover:bg-primary/3"
                onClick={() => onRowClick?.(row)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.03 }}
              >
                {columns.map((column) => (
                  <td key={column.header} className={`px-5 py-3.5 ${column.className ?? ''}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )

}
