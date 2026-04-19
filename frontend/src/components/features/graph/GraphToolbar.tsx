import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain, Loader2, Maximize2, Radar, Search, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'sonner'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { SearchInput } from '../../ui/SearchInput'
import { Select } from '../../ui/Select'
import { GraphFilterPanel } from './GraphFilterPanel'
import { GraphViewSwitcher } from './GraphViewSwitcher'
import { fetchRepoEmbeddingStatus, startRepoEmbeddings } from '../../../services/repoService'
import { useGraphStore } from '../../../store/graphStore'

function estimateEmbeddingProgress(startedAt?: string | null) {
  if (!startedAt) return 8

  const elapsedSeconds = Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000)
  const warmup = Math.min(18, elapsedSeconds * 3)
  const cruise = 78 * (1 - Math.exp(-Math.max(0, elapsedSeconds - 6) / 26))
  return Math.min(95, Math.max(8, Math.round(warmup + cruise)))
}

export function GraphToolbar({ onOpenQuery, queryEnabled, repoId }: { onOpenQuery: () => void; queryEnabled: boolean; repoId: string }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const filters = useGraphStore((state) => state.filters)
  const setFilters = useGraphStore((state) => state.setFilters)
  const layoutMode = useGraphStore((state) => state.layoutMode)
  const setLayoutMode = useGraphStore((state) => state.setLayoutMode)
  const blastRadiusEnabled = useGraphStore((state) => state.blastRadiusEnabled)
  const toggleBlastRadius = useGraphStore((state) => state.toggleBlastRadius)
  const queryClient = useQueryClient()
  const [optimisticProcessing, setOptimisticProcessing] = useState(false)

  const embeddingsQuery = useQuery({
    queryKey: ['repo-embeddings-status', repoId],
    queryFn: () => fetchRepoEmbeddingStatus(repoId),
    enabled: Boolean(repoId),
    staleTime: 1000,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' || optimisticProcessing ? 1500 : false,
  })

  const embeddingsMutation = useMutation({
    mutationFn: () => startRepoEmbeddings(repoId),
    onSuccess: async (result) => {
      setOptimisticProcessing(true)
      toast.success(result.message || 'Embedding generation started.')
      await queryClient.invalidateQueries({ queryKey: ['repo-embeddings-status', repoId] })
    },
    onError: (error: any) => {
      setOptimisticProcessing(false)
      toast.error(error?.response?.data?.detail ?? 'Could not start embeddings.')
    },
  })

  const embeddingStatus = embeddingsQuery.data?.status ?? 'not_started'
  const effectiveEmbeddingStatus =
    optimisticProcessing && embeddingStatus === 'not_started' ? 'processing' : embeddingStatus
  const embeddingProgress =
    effectiveEmbeddingStatus === 'complete'
      ? 100
      : effectiveEmbeddingStatus === 'processing'
        ? estimateEmbeddingProgress(embeddingsQuery.data?.startedAt)
        : 0

  useEffect(() => {
    if (!optimisticProcessing) return
    if (embeddingStatus === 'processing' || embeddingStatus === 'complete' || embeddingStatus === 'failed') {
      setOptimisticProcessing(false)
    }
  }, [embeddingStatus, optimisticProcessing])

  const embeddingMessage = useMemo(() => {
    if (effectiveEmbeddingStatus === 'processing') {
      return `Embedding generation in progress (${embeddingProgress}%).`
    }
    if (effectiveEmbeddingStatus === 'complete') {
      return `${embeddingsQuery.data?.fileCount ?? 0} files embedded.`
    }
    return embeddingsQuery.data?.message
  }, [effectiveEmbeddingStatus, embeddingProgress, embeddingsQuery.data?.fileCount, embeddingsQuery.data?.message])

  const embeddingLabel =
    effectiveEmbeddingStatus === 'processing'
      ? `Embedding ${embeddingProgress}%`
      : effectiveEmbeddingStatus === 'complete'
        ? 'Embeddings Ready'
        : effectiveEmbeddingStatus === 'failed'
          ? 'Retry Embeddings'
          : 'Generate Embeddings'
  const embeddingsBusy = embeddingsMutation.isPending || effectiveEmbeddingStatus === 'processing'

  function handleOpenQuery() {
    if (!queryEnabled) {
      toast.info('Generate embeddings first. Query is enabled once embeddings are ready.')
      return
    }
    onOpenQuery()
  }

  return (
    <div className="glass-panel flex flex-wrap items-center justify-center gap-2 rounded-lg p-2 shadow-xl shadow-primary/10">
      <GraphViewSwitcher />
      <div className="h-6 w-px bg-border" />
      <Button variant="ghost" size="icon" onClick={() => zoomIn({ duration: 260 })} aria-label="Zoom in">
        <ZoomIn className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => zoomOut({ duration: 260 })} aria-label="Zoom out">
        <ZoomOut className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => fitView({ padding: 0.24, duration: 620 })} aria-label="Fit view">
        <Maximize2 className="size-4" />
      </Button>
      <Button variant={blastRadiusEnabled ? 'primary' : 'outline'} size="sm" onClick={toggleBlastRadius}>
        <Radar className="size-4" />
        Blast
      </Button>
      <GraphFilterPanel />
      <Select
        ariaLabel="Layout mode"
        value={layoutMode}
        onValueChange={(value) => setLayoutMode(value as any)}
        options={[
          { value: 'force', label: 'Force-directed' },
          { value: 'hierarchical', label: 'Hierarchical' },
          { value: 'radial', label: 'Radial' },
        ]}
      />
      <SearchInput className="w-56" value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Search files" />
      <Button
        variant={effectiveEmbeddingStatus === 'complete' ? 'primary' : 'outline'}
        size="sm"
        onClick={() => embeddingsMutation.mutate()}
        disabled={embeddingsBusy}
        title={embeddingMessage || undefined}
      >
        {embeddingsBusy ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
        {embeddingLabel}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenQuery}
        disabled={!queryEnabled}
        title={!queryEnabled ? 'Generate embeddings first to unlock Ask.' : undefined}
      >
        <Search className="size-4" />
        Ask
        <span className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">Ctrl K</span>
      </Button>
      <div className="hidden items-center gap-1 rounded-md bg-accent/70 px-2 py-1 font-mono text-[10px] text-accent-foreground xl:flex">
        <Sparkles className="size-3" />
        Shift drag to lasso
      </div>
    </div>
  )
}
