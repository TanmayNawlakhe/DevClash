import { Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { useNLQuery } from '../../../hooks/useNLQuery'
import { useGraphStore } from '../../../store/graphStore'

export function NLQueryPanel({ open, onOpenChange, repoId }: { open: boolean; onOpenChange: (open: boolean) => void; repoId: string }) {
  const [query, setQuery] = useState('')
  const mutation = useNLQuery(repoId)
  const setSelectedNodes = useGraphStore((state) => state.setSelectedNodes)
  const examples = ['Where is auth handled?', 'Show me the payment flow', 'What tests cover the User model?']

  async function submit(value = query) {
    if (!value.trim()) return
    const result = await mutation.mutateAsync(value)
    setSelectedNodes(result.fileIds)
    toast.success(`${result.fileIds.length} matching files highlighted.`)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ask the Codebase" className="top-[18%] translate-y-0">
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
          <button key={example} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { setQuery(example); void submit(example) }}>
            {example}
          </button>
        ))}
      </div>
      {mutation.data ? (
        <div className="mt-5 space-y-2">
          {mutation.data.results.map((result) => (
            <div key={result.fileId} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">{result.path}</span>
                <span className="font-mono text-xs text-primary">{Math.round(result.score * 100)}%</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{result.snippet}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  )
}
