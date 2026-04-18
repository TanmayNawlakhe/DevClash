import { Loader2, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { useNLQuery } from '../../../hooks/useNLQuery'
import { renderMermaid } from '../../../lib/mermaidRenderer'
import { useGraphStore } from '../../../store/graphStore'
import { useUIStore } from '../../../store/uiStore'

export function NLQueryPanel({ open, onOpenChange, repoId }: { open: boolean; onOpenChange: (open: boolean) => void; repoId: string }) {
  const [query, setQuery] = useState('')
  const mutation = useNLQuery(repoId)
  const setSelectedNodes = useGraphStore((state) => state.setSelectedNodes)
  const darkMode = useUIStore((state) => state.darkMode)
  const mermaidRef = useRef<HTMLDivElement>(null)
  const examples = ['Where is auth handled?', 'Show me the payment flow', 'What tests cover the User model?']

  async function submit(value = query) {
    if (!value.trim()) return
    try {
      const result = await mutation.mutateAsync(value)
      setSelectedNodes(result.fileIds)
      toast.success(`${result.fileIds.length} matching files highlighted.`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? 'Query failed.')
    }
  }

  useEffect(() => {
    if (!mutation.data?.mermaid || !mermaidRef.current) return

    let cancelled = false

    renderMermaid(`search-${repoId}`, mutation.data.mermaid, darkMode)
      .then(({ svg }) => {
        if (!cancelled && mermaidRef.current) {
          mermaidRef.current.innerHTML = svg
        }
      })
      .catch((error) => {
        if (!cancelled && mermaidRef.current) {
          mermaidRef.current.innerHTML = ''
        }
        toast.error(error instanceof Error ? error.message : 'Unable to render Mermaid graph.')
      })

    return () => {
      cancelled = true
    }
  }, [darkMode, mutation.data?.mermaid, repoId])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ask the Codebase"
      description="Ask a natural-language question, review the backend answer, and inspect the Mermaid flow for the matched files."
      className="top-[8%] max-h-[88dvh] w-[min(96vw,1240px)] translate-y-0 overflow-y-auto"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-5 text-primary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask anything about this codebase..."
            className="h-10 flex-1 bg-transparent font-mono outline-none"
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Ask
          </Button>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => {
              setQuery(example)
              void submit(example)
            }}
          >
            {example}
          </button>
        ))}
      </div>
      {mutation.data ? (
        <div className="mt-5 grid h-[70dvh] min-h-[420px] gap-4 overflow-hidden lg:grid-cols-[1.15fr_0.95fr]">
          <div className="min-h-0 h-full overflow-auto rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold">Semantic Flow</h3>
                <p className="text-sm text-muted-foreground">{mutation.data.totalMatched ?? mutation.data.fileIds.length} matched files</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedNodes(mutation.data.fileIds)}>
                <Sparkles className="size-4" />
                Highlight All
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {mutation.data.answer ?? 'No answer returned.'}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {mutation.data.results.map((result, index) => (
                <div key={result.fileId} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm">{result.path}</span>
                    <span className="font-mono text-xs text-primary">#{index + 1} - {Math.round(result.score * 100)}%</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{result.snippet}</p>
                  {mutation.data.flow?.[index]?.matchedFunctions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mutation.data.flow[index].matchedFunctions.map((fn) => (
                        <span key={`${result.fileId}-${fn.name}`} className="rounded bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary">
                          {fn.name} {Math.round(fn.score * 100)}%
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 h-full overflow-auto rounded-lg border border-border bg-card p-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-semibold">Mermaid Graph</h3>
              <p className="text-sm text-muted-foreground">Rendered from the backend semantic-search response.</p>
            </div>
            <div className="mt-4 overflow-auto rounded-lg border border-border bg-background p-4">
              <div ref={mermaidRef} className="min-w-[520px]" />
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
