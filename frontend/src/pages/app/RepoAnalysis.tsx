import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileCode2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { GraphCanvas } from '../../components/features/graph/GraphCanvas'
import { AnalysisProgress } from '../../components/features/repo/AnalysisProgress'
import { FileDetailPanel } from '../../components/features/panels/FileDetailPanel'
import { OnboardingPathPanel } from '../../components/features/panels/OnboardingPathPanel'
import { OrphanPanel } from '../../components/features/panels/OrphanPanel'
import { PrioritySidebar } from '../../components/features/panels/PrioritySidebar'
import { RepoUrlInput } from '../../components/features/repo/RepoUrlInput'
import { LayerBadge } from '../../components/ui/Badge'
import { SearchInput } from '../../components/ui/SearchInput'
import { Tabs } from '../../components/ui/Tabs'
import { useDebounce } from '../../hooks/useDebounce'
import { useGraphStore } from '../../store/graphStore'
import { useRepoStore } from '../../store/repoStore'
import { useUIStore } from '../../store/uiStore'
import { cn, truncatePath } from '../../lib/utils'

export function RepoAnalysis() {
  const { repoId } = useParams()
  const graph = useRepoStore((state) => state.graphData)
  const repos = useRepoStore((state) => state.repos)
  const setRepo = useRepoStore((state) => state.setRepo)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const repo = repos.find((item) => item.id === repoId)
    if (repo) setRepo(repo)
  }, [repoId, repos, setRepo])

  if (!repoId) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-5">
        <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase text-primary">New Analysis</p>
          <h1 className="mt-2 text-3xl font-semibold">Map a repository</h1>
          <div className="mt-6">
            <RepoUrlInput />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative grid h-[calc(100dvh-4rem)] min-h-[720px] grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-300',
        sidebarOpen
          ? 'lg:grid-cols-[288px_1fr_auto]'
          : 'lg:grid-cols-[0px_1fr_auto]',
      )}
    >
      {/* Left sidebar */}
      <aside
        className={cn(
          'hidden min-h-0 overflow-hidden border-r border-border bg-card transition-[width,opacity] duration-300 lg:block',
          sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0',
        )}
      >
        {sidebarOpen && (
          <LeftAnalysisPanel onClose={() => setSidebarOpen(false)} />
        )}
      </aside>

      {/* Main canvas */}
      <main className="relative min-w-0 p-3">
        {/* Sidebar toggle button — shown when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open file sidebar"
            className="absolute left-5 top-5 z-20 flex size-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:bg-accent"
          >
            <PanelLeftOpen className="size-4 text-muted-foreground" />
          </button>
        )}
        {graph ? <GraphCanvas graph={graph} /> : null}
        <AnalysisProgress />
      </main>

      <FileDetailPanel />
    </div>
  )
}

function LeftAnalysisPanel({ onClose }: { onClose: () => void }) {
  const graph = useRepoStore((state) => state.graphData)
  const [tab, setTab] = useState('files')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const setActivePanel = useUIStore((state) => state.setActivePanel)

  const files = useMemo(() => {
    const query = debounced.toLowerCase()
    return (graph?.nodes ?? []).filter((file) => file.path.toLowerCase().includes(query))
  }, [debounced, graph])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header with close button */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explorer</span>
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            {
              value: 'files',
              label: 'Files',
              content: (
                <div className="space-y-3">
                  <SearchInput value={search} onChange={setSearch} placeholder="Search files" />
                  <div className="space-y-1">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent',
                          file.isOrphan && 'border border-dashed border-destructive/50',
                        )}
                        onClick={() => {
                          setSelectedNode(file.id)
                          setActivePanel('file')
                        }}
                      >
                        <FileCode2 className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{truncatePath(file.path, 34)}</span>
                        <LayerBadge layer={file.layer} className="hidden xl:inline-flex" />
                      </button>
                    ))}
                  </div>
                </div>
              ),
            },
            { value: 'onboarding', label: 'Guide', content: <OnboardingPathPanel /> },
            { value: 'priority', label: 'Priority', content: <PrioritySidebar /> },
            { value: 'dead', label: 'Dead', content: <OrphanPanel /> },
          ]}
        />
      </div>
    </div>
  )
}
