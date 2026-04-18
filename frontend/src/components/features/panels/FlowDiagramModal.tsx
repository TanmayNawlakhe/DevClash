import { useMutation } from '@tanstack/react-query'
import { Copy, Download, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { Skeleton } from '../../ui/Skeleton'
import { generateFlowDiagram } from '../../../services/flowService'
import { renderMermaid } from '../../../lib/mermaidRenderer'
import { useUIStore } from '../../../store/uiStore'
import type { FlowDiagramResult } from '../../../types'

export function FlowDiagramModal({
  open,
  onOpenChange,
  repoId,
  fileIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
  fileIds: string[]
}) {
  const darkMode = useUIStore((state) => state.darkMode)
  const [diagramType, setDiagramType] = useState<'functional' | 'data' | 'combined'>('combined')
  const [result, setResult] = useState<FlowDiagramResult | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const mutation = useMutation({
    mutationFn: () => generateFlowDiagram(repoId, fileIds.length ? fileIds : ['f2', 'f5'], diagramType),
    onSuccess: setResult,
  })

  useEffect(() => {
    if (open && !result && !mutation.isPending) mutation.mutate()
  }, [open])

  useEffect(() => {
    if (!result || !ref.current) return

    let cancelled = false

    renderMermaid(`flow-${result.diagramId}-${diagramType}`, result.mermaidSource, darkMode)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      })
      .catch((error) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = ''
        }
        toast.error(error instanceof Error ? error.message : 'Unable to render Mermaid diagram.')
      })

    return () => {
      cancelled = true
    }
  }, [darkMode, diagramType, result])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Flow Diagram"
      description="Inspect the Mermaid diagram generated for the selected file set and read the plain-English walkthrough beside it."
      className="w-[min(96vw,1180px)]"
    >
      <div className="grid max-h-[78dvh] gap-4 overflow-hidden lg:grid-cols-[1.4fr_0.9fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="flex gap-2 border-b border-border p-2">
            {(['functional', 'data', 'combined'] as const).map((type) => (
              <Button key={type} variant={diagramType === type ? 'primary' : 'ghost'} size="sm" onClick={() => setDiagramType(type)}>
                {type}
              </Button>
            ))}
          </div>
          <div className="h-[520px] overflow-auto p-4">
            {mutation.isPending && !result ? <Skeleton className="h-full w-full" /> : <div ref={ref} className="min-w-[620px]" />}
          </div>
        </div>
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="font-serif text-xl font-semibold">Plain-English walkthrough</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 text-sm leading-6 text-muted-foreground">
            {result?.plainEnglish ?? 'Generating an explanation from the selected files.'}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(result?.mermaidSource ?? '')
                toast.success('Mermaid source copied.')
              }}
            >
              <Copy className="size-4" />
              Copy Mermaid
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('PNG export is ready for backend wiring.')}>
              <Download className="size-4" />
              Download PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => mutation.mutate()}>
              <RefreshCw className="size-4" />
              Regenerate
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
