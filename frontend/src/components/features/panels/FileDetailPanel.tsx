import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, ExternalLink, GitPullRequestArrow, Link2, Loader2, Network, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge, LayerBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Skeleton } from '../../ui/Skeleton'
import { CodePreviewPanel } from './CodePreviewPanel'
import { FlowDiagramModal } from './FlowDiagramModal'
import { OwnershipTab } from './OwnershipTab'
import { fetchFileDetail, fetchFileReferences, type RepoKeywordReference } from '../../../services/graphService'
import { useGraphStore } from '../../../store/graphStore'
import { useRepoStore } from '../../../store/repoStore'
import { useUIStore } from '../../../store/uiStore'
import { formatNumber, truncatePath } from '../../../lib/utils'

type TabId = 'code' | 'imports' | 'dependents' | 'ownership' | 'flow'

export function FileDetailPanel() {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  const graph = useRepoStore((state) => state.graphData)
  const repo = useRepoStore((state) => state.currentRepo)
  const activePanel = useUIStore((state) => state.activePanel)
  const setActivePanel = useUIStore((state) => state.setActivePanel)
  const [tab, setTab] = useState<TabId>('code')
  const [flowOpen, setFlowOpen] = useState(false)
  const [referencesOpen, setReferencesOpen] = useState(false)

  const query = useQuery({
    queryKey: ['file-detail', repo?.id, selectedNodeId],
    queryFn: () => fetchFileDetail(repo?.id ?? graph?.meta.repoId ?? 'react-demo', selectedNodeId ?? 'f2', graph),
    enabled: Boolean(selectedNodeId && activePanel === 'file'),
  })

  const referencesQuery = useQuery({
    queryKey: ['file-references', repo?.id, selectedNodeId],
    queryFn: () => fetchFileReferences(repo?.id ?? graph?.meta.repoId ?? 'react-demo', selectedNodeId ?? ''),
    enabled: Boolean(selectedNodeId && activePanel === 'file'),
    staleTime: 300000,
  })

  useEffect(() => {
    setReferencesOpen(false)
  }, [selectedNodeId])

  const file = query.data

  return (
    <AnimatePresence>
      {activePanel === 'file' && selectedNodeId ? (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="h-full w-full overflow-auto border-l border-border bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur-xl lg:w-[420px]"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 border-b border-border bg-card/90 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{file ? truncatePath(file.path, 42) : 'Loading file...'}</p>
                {file ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{file.language}</Badge>
                    <LayerBadge layer={file.layer} />
                  </div>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedNode(null)
                  setActivePanel(null)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {query.isLoading || !file ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Lines" value={formatNumber(file.lines)} />
                  <MiniStat label="Centrality" value={`${Math.round(file.centrality * 100)}%`} />
                  <MiniStat label="CLS" value={`${Math.round(file.cognitiveLoadScore * 100)}%`} />
                </div>

                <div className="rounded-lg border-l-4 border-primary bg-accent/50 p-3">
                  <p className="whitespace-pre-line text-sm leading-6">{file.summary}</p>
                </div>

                <ReferenceLinksCard
                  references={referencesQuery.data?.references ?? []}
                  isLoading={referencesQuery.isLoading}
                  isError={referencesQuery.isError}
                  isOpen={referencesOpen}
                  onToggle={() => setReferencesOpen((state) => !state)}
                />

                {file.priorityRank <= 8 ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <p className="font-mono text-xs text-primary">Priority #{file.priorityRank}</p>
                    <p className="mt-1 text-sm">{file.priorityReason}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {(['code', 'imports', 'dependents', 'ownership', 'flow'] as TabId[]).map((item) => (
                    <button
                      key={item}
                      onClick={() => setTab(item)}
                      className={`rounded-md px-3 py-1.5 text-xs capitalize ${tab === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {tab === 'code' ? <CodePreviewPanel code={file.code} language={file.language} /> : null}
                {tab === 'imports' ? <FileList files={file.imports} icon={<GitPullRequestArrow className="size-4" />} /> : null}
                {tab === 'dependents' ? <FileList files={file.dependents} icon={<Network className="size-4" />} /> : null}
                {tab === 'ownership' ? <OwnershipTab file={file} /> : null}
                {tab === 'flow' ? (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">Generate a Mermaid diagram for this file and its immediate neighbors.</p>
                    <Button className="mt-4" onClick={() => setFlowOpen(true)}>
                      {query.isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
                      Generate Flow Diagram
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(file.path)
                      toast.success('Path copied.')
                    }}
                  >
                    <Copy className="size-4" />
                    Copy Path
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${repo?.githubUrl}/blob/${repo?.branch}/${file.path}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      GitHub
                    </a>
                  </Button>
                </div>
                <FlowDiagramModal open={flowOpen} onOpenChange={setFlowOpen} repoId={repo?.id ?? 'react-demo'} fileIds={[file.id]} />
              </>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  )
}

function ReferenceLinksCard({
  references,
  isLoading,
  isError,
  isOpen,
  onToggle,
}: {
  references: RepoKeywordReference[]
  isLoading: boolean
  isError: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  if (isLoading) {
    return <Skeleton className="h-14" />
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">References are unavailable for this file right now.</p>
      </div>
    )
  }

  if (!references.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">No curated references found for this file.</p>
      </div>
    )
  }

  const primary = references[0]
  const remainingCount = Math.max(0, references.length - 1)
  const primaryUrl = preferredReferenceUrl(primary)

  return (
    <div className="relative rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">References</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={primaryUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <Link2 className="size-3" />
          <span className="max-w-[180px] truncate">{primary.keyword}</span>
          <ExternalLink className="size-3" />
        </a>

        {remainingCount > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            +{remainingCount} more
            {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(100%,22rem)] rounded-xl border border-border bg-card p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All References</p>
              <button
                type="button"
                onClick={onToggle}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close references"
              >
                <X className="size-3" />
              </button>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {references.map((reference) => (
                <ReferenceRow key={reference.keyword} reference={reference} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ReferenceRow({ reference }: { reference: RepoKeywordReference }) {
  const primary = preferredReferenceUrl(reference)

  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <p className="truncate text-xs font-medium">{reference.keyword}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href={primary}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent"
        >
          <Link2 className="size-3" />
          Open
        </a>
        {reference.youtubeReferenceUrl ? (
          <a
            href={reference.youtubeReferenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent"
          >
            <ExternalLink className="size-3" />
            YouTube
          </a>
        ) : null}
      </div>
    </div>
  )
}

function preferredReferenceUrl(reference: RepoKeywordReference): string {
  return reference.normalReferenceUrl ?? reference.youtubeReferenceUrl ?? reference.youtubeSearchUrl
}

function FileList({ files, icon }: { files: Array<{ id: string; path: string; summary: string }>; icon: React.ReactNode }) {
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)
  if (!files.length) return <p className="text-sm text-muted-foreground">No files found in this direction.</p>

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <button key={file.id} className="flex w-full gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent" onClick={() => setSelectedNode(file.id)}>
          <span className="mt-0.5 text-primary">{icon}</span>
          <span>
            <span className="block font-mono text-sm">{truncatePath(file.path, 36)}</span>
            <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">{file.summary}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
