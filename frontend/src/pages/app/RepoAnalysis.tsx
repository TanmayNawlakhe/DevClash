import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileCode2, Loader2, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { GraphCanvas } from '../../components/features/graph/GraphCanvas'
import { AnalysisProgress } from '../../components/features/repo/AnalysisProgress'
import { FileDetailPanel } from '../../components/features/panels/FileDetailPanel'
import { OnboardingPathPanel } from '../../components/features/panels/OnboardingPathPanel'
import { PrioritySidebar } from '../../components/features/panels/PrioritySidebar'
import { RepoUrlInput } from '../../components/features/repo/RepoUrlInput'
import { EmptyState } from '../../components/ui/EmptyState'
import { LayerBadge } from '../../components/ui/Badge'
import { SearchInput } from '../../components/ui/SearchInput'
import { Tabs } from '../../components/ui/Tabs'
import { useDebounce } from '../../hooks/useDebounce'
import { applyRepoSummariesToGraph, buildPriorityRankings, describeRepoProgress, mergeRepoWithGraph } from '../../lib/repoAdapters'
import { fetchGraph, fetchRepoSummaries } from '../../services/graphService'
import { cancelRepoAnalysis, fetchRepoStatus, retryRepoAnalysis } from '../../services/repoService'
import { useGraphStore } from '../../store/graphStore'
import { useOwnershipStore } from '../../store/ownershipStore'
import { usePriorityStore } from '../../store/priorityStore'
import { useRepoStore } from '../../store/repoStore'
import { useUIStore } from '../../store/uiStore'
import { cn, truncatePath } from '../../lib/utils'
import type { FileNode } from '../../types'

export function RepoAnalysis() {
  const { repoId } = useParams()
  const graph = useRepoStore((state) => state.graphData)
  const repos = useRepoStore((state) => state.repos)
  const setRepo = useRepoStore((state) => state.setRepo)
  const upsertRepo = useRepoStore((state) => state.upsertRepo)
  const setGraphData = useRepoStore((state) => state.setGraphData)
  const setAnalysisStatus = useRepoStore((state) => state.setAnalysisStatus)
  const setRankings = usePriorityStore((state) => state.setRankings)
  const resetChecked = usePriorityStore((state) => state.resetChecked)
  const setContributorsFromFiles = useOwnershipStore((state) => state.setContributorsFromFiles)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const setActivePanel = useUIStore((state) => state.setActivePanel)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const hasSeenInProgressRef = useRef(false)
  const completionToastKeyRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const fallbackRepo = useMemo(
    () => repos.find((item) => item.id === repoId) ?? null,
    [repoId, repos],
  )

  const statusQuery = useQuery({
    queryKey: ['repo-status', repoId],
    queryFn: () => fetchRepoStatus(repoId!),
    enabled: Boolean(repoId),
    staleTime: 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && ['pending', 'analyzing', 'cloning', 'parsing', 'ai_processing', 'cancelling'].includes(status)
        ? 2000
        : false
    },
  })

  const repo = statusQuery.data ?? fallbackRepo

  useEffect(() => {
    hasSeenInProgressRef.current = false
    completionToastKeyRef.current = null
  }, [repoId])

  const graphQuery = useQuery({
    queryKey: ['repo-graph', repoId],
    queryFn: () => fetchGraph(repoId!),
    enabled: Boolean(repoId && repo?.status === 'complete'),
    staleTime: 30000,
  })

  const summariesQuery = useQuery({
    queryKey: ['repo-summaries', repoId],
    queryFn: () => fetchRepoSummaries(repoId!),
    enabled: Boolean(repoId && repo?.status === 'complete'),
    staleTime: 30000,
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelRepoAnalysis(repoId!),
    onSuccess: async (response: any) => {
      toast.success(response.message ?? 'Cancellation requested.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['repo-status', repoId] }),
        queryClient.invalidateQueries({ queryKey: ['repos'] }),
      ])
    },
    onError: () => {
      toast.error('Could not cancel analysis.')
    },
  })

  const retryMutation = useMutation({
    mutationFn: () => retryRepoAnalysis(repoId!),
    onSuccess: async (response: any) => {
      toast.success(response.message ?? 'Retry scheduled.')
      setGraphData(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['repo-status', repoId] }),
        queryClient.invalidateQueries({ queryKey: ['repo-graph', repoId] }),
        queryClient.invalidateQueries({ queryKey: ['repos'] }),
      ])
    },
    onError: () => {
      toast.error('Could not retry analysis.')
    },
  })

  useEffect(() => {
    setGraphData(null)
    setSelectedNode(null)
    setActivePanel(null)
  }, [repoId, setActivePanel, setGraphData, setSelectedNode])

  useEffect(() => {
    if (!repo) return
    upsertRepo(repo)
    setRepo(repo)
    if (['pending', 'analyzing', 'cloning', 'parsing', 'ai_processing', 'cancelling'].includes(repo.status)) {
      hasSeenInProgressRef.current = true
    }
    const progress = describeRepoProgress(repo)
    setAnalysisStatus(progress.status, progress.progress, progress.stage, progress.log)
  }, [repo, setAnalysisStatus, setRepo, upsertRepo])

  const enrichedGraph = useMemo(() => {
    if (!graphQuery.data) return null
    return applyRepoSummariesToGraph(graphQuery.data, summariesQuery.data?.summaries ?? [])
  }, [graphQuery.data, summariesQuery.data])

  useEffect(() => {
    if (!enrichedGraph || !repo) return
    const hydratedRepo = mergeRepoWithGraph(repo, enrichedGraph)
    upsertRepo(hydratedRepo)
    setRepo(hydratedRepo)
    setGraphData(enrichedGraph)
    setRankings(buildPriorityRankings(enrichedGraph))
    resetChecked()
    setContributorsFromFiles(enrichedGraph.nodes)
    setAnalysisStatus(
      'complete',
      100,
      'Architecture map ready',
      summariesQuery.data
        ? `Loaded ${enrichedGraph.meta.nodeCount} files and ${summariesQuery.data.summarized_files} AI summaries`
        : `Loaded ${enrichedGraph.meta.nodeCount} files`,
    )
  }, [
    enrichedGraph,
    repo,
    resetChecked,
    setAnalysisStatus,
    setContributorsFromFiles,
    setGraphData,
    setRankings,
    setRepo,
    summariesQuery.data,
    upsertRepo,
  ])

  useEffect(() => {
    if (!repoId || !repo || repo.status !== 'complete') return
    if (!enrichedGraph || !graphQuery.isSuccess || !summariesQuery.isSuccess) return
    if (!hasSeenInProgressRef.current) return

    const aiSummaries = summariesQuery.data?.summarized_files ?? 0
    const completionKey = `${repoId}:${enrichedGraph.meta.nodeCount}:${aiSummaries}`
    if (completionToastKeyRef.current === completionKey) return

    completionToastKeyRef.current = completionKey
    toast.success(
      aiSummaries > 0
        ? `Graph built successfully. AI analysis complete for ${aiSummaries} files.`
        : 'Graph built successfully. AI analysis complete.',
      { id: `analysis-complete-${repoId}` },
    )
  }, [
    enrichedGraph,
    graphQuery.isSuccess,
    repo,
    repoId,
    summariesQuery.data,
    summariesQuery.isSuccess,
  ])

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

  const isActiveAnalysis = Boolean(repo && ['pending', 'analyzing', 'cloning', 'parsing', 'ai_processing', 'cancelling'].includes(repo.status))
  const showEmptyState = !graph && !isActiveAnalysis && !graphQuery.isLoading && !summariesQuery.isLoading

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
        {graph ? (
          <GraphCanvas graph={graph} />
        ) : showEmptyState ? (
          <AnalysisStateCard
            repoName={repo ? `${repo.owner}/${repo.name}` : 'repository'}
            status={repo?.status}
            errorMessage={repo?.errorMessage}
            isRetrying={retryMutation.isPending}
            onRetry={repo ? () => retryMutation.mutate() : undefined}
          />
        ) : (
          <div className="flex h-full min-h-[640px] items-center justify-center rounded-lg border border-border bg-card/50">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <AnalysisProgress
          canCancel={Boolean(repo && ['pending', 'analyzing', 'cloning', 'parsing', 'ai_processing'].includes(repo.status))}
          isCancelling={cancelMutation.isPending || repo?.status === 'cancelling'}
          onCancel={repo ? () => cancelMutation.mutate() : undefined}
        />
      </main>

      <FileDetailPanel />
    </div>
  )
}

function AnalysisStateCard({
  repoName,
  status,
  errorMessage,
  isRetrying,
  onRetry,
}: {
  repoName: string
  status?: string
  errorMessage?: string | null
  isRetrying: boolean
  onRetry?: () => void
}) {
  if (status === 'failed') {
    return (
      <EmptyState
        illustration={<AlertTriangle className="size-10 text-destructive" />}
        title={`Analysis failed for ${repoName}`}
        description={errorMessage ?? 'The backend could not finish building the dependency graph for this repository.'}
        action={onRetry ? { label: isRetrying ? 'Retrying...' : 'Retry analysis', onClick: onRetry } : undefined}
      />
    )
  }

  if (status === 'cancelled') {
    return (
      <EmptyState
        illustration={<RotateCcw className="size-10 text-primary" />}
        title={`Analysis cancelled for ${repoName}`}
        description="You can queue the repository again whenever you're ready."
        action={onRetry ? { label: isRetrying ? 'Retrying...' : 'Analyze again', onClick: onRetry } : undefined}
      />
    )
  }

  return (
    <EmptyState
      title={`No graph loaded for ${repoName}`}
      description="The repository is connected, but the backend has not returned a completed graph yet."
    />
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
    return (graph?.nodes ?? []).filter(
      (file) =>
        file.path.toLowerCase().includes(query) ||
        file.summary.toLowerCase().includes(query),
    )
  }, [debounced, graph])

  const utilityFiles = useMemo(
    () => files.filter((file) => file.layer === 'utility' || file.layer === 'util'),
    [files],
  )

  const configFiles = useMemo(
    () => files.filter((file) => file.layer === 'config'),
    [files],
  )

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
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
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
            {
              value: 'utility',
              label: 'Utility',
              content: (
                <LayerFilesList
                  files={utilityFiles}
                  emptyMessage="No utility files match the current filter."
                  onSelect={(fileId) => {
                    setSelectedNode(fileId)
                    setActivePanel('file')
                  }}
                />
              ),
            },
            {
              value: 'config',
              label: 'Config',
              content: (
                <LayerFilesList
                  files={configFiles}
                  emptyMessage="No config files match the current filter."
                  onSelect={(fileId) => {
                    setSelectedNode(fileId)
                    setActivePanel('file')
                  }}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

function LayerFilesList({
  files,
  emptyMessage,
  onSelect,
}: {
  files: FileNode[]
  emptyMessage: string
  onSelect: (fileId: string) => void
}) {
  if (!files.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <button
          key={file.id}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
          onClick={() => onSelect(file.id)}
        >
          <FileCode2 className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{truncatePath(file.path, 34)}</span>
          <LayerBadge layer={file.layer} className="hidden xl:inline-flex" />
        </button>
      ))}
    </div>
  )
}
