import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, ExternalLink, GitPullRequestArrow, Loader2, Network, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, LayerBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Skeleton } from '../../ui/Skeleton'
import { CodePreviewPanel } from './CodePreviewPanel'
import { FlowDiagramModal } from './FlowDiagramModal'
import { OwnershipTab } from './OwnershipTab'
import { fetchFileDetail } from '../../../services/graphService'
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

  const query = useQuery({
    queryKey: ['file-detail', repo?.id, selectedNodeId],
    queryFn: () => fetchFileDetail(repo?.id ?? graph?.meta.repoId ?? 'react-demo', selectedNodeId ?? 'f2'),
    enabled: Boolean(selectedNodeId && activePanel === 'file'),
  })

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
                  <p className="text-sm leading-6">{file.summary}</p>
                </div>

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
            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{file.summary}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
