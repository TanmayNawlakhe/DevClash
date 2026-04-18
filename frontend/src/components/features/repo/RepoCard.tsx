import { motion } from 'framer-motion'
import { ArrowRight, Clock, Code2, GitBranch, MoreHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Badge, StatusBadge } from '../../ui/Badge'
import type { Repo } from '../../../types'
import { formatNumber } from '../../../lib/utils'

export function RepoCard({ repo, onClick }: { repo: Repo; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-lg hover:shadow-primary/6"
    >
      {/* Hover gradient accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <GitBranch className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-mono text-sm font-bold">
              {repo.owner}/<span className="text-primary">{repo.name}</span>
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {formatDistanceToNow(new Date(repo.lastAnalyzed), { addSuffix: true })}
            </div>
          </div>
        </div>
        <button
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-accent hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* Language badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {repo.languages.map((lang) => (
          <Badge key={lang} className="rounded-full px-2.5 py-0.5 text-xs">{lang}</Badge>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { icon: Code2, value: formatNumber(repo.files), label: 'files' },
          { icon: GitBranch, value: formatNumber(repo.nodes), label: 'nodes' },
          { icon: ArrowRight, value: formatNumber(repo.edges), label: 'edges' },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="rounded-xl bg-muted/40 p-2.5 text-center">
            <p className="font-mono text-sm font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="mt-4 flex items-center justify-between">
        <StatusBadge status={repo.status} />
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open map <ArrowRight className="size-3" />
        </span>
      </div>
    </motion.div>
  )
}
