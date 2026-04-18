import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderGit2, Search, SlidersHorizontal } from 'lucide-react'
import { RepoCard } from '../../components/features/repo/RepoCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Select'
import { useDebounce } from '../../hooks/useDebounce'
import { useRepoStore } from '../../store/repoStore'

const STATUS_FILTERS = ['all', 'pending', 'analyzing', 'cancelling', 'cancelled', 'complete', 'failed']

export function RepoHistory() {
  const repos = useRepoStore((state) => state.repos)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const debounced = useDebounce(search)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    return repos
      .filter((repo) => `${repo.owner}/${repo.name}`.toLowerCase().includes(debounced.toLowerCase()))
      .filter((repo) => status === 'all' || repo.status === status)
      .sort((a, b) => {
        if (sort === 'alpha') return `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`)
        if (sort === 'files') return b.files - a.files
        return new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime()
      })
  }, [debounced, repos, sort, status])

  return (
    <div className="space-y-6 p-5 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Repository History
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
            Every codebase you've mapped.
          </h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <FolderGit2 className="size-3.5" />
          <span className="font-mono font-medium">{repos.length}</span> repositories
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center"
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200 ${
                  status === item
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <Select
          ariaLabel="Sort repositories"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: 'recent', label: 'Recent First' },
            { value: 'alpha', label: 'Alphabetical' },
            { value: 'files', label: 'Most Files' },
          ]}
        />
      </motion.div>

      {/* Results */}
      {filtered.length ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((repo) => (
            <motion.div
              key={repo.id}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            >
              <RepoCard repo={repo} onClick={() => navigate(`/analysis/${repo.id}`)} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          title="No repos found"
          description={search ? `No results for "${search}"` : 'Start by analyzing your first GitHub repository.'}
        />
      )}
    </div>
  )
}
