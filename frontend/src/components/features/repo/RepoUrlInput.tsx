import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, GitBranch, Loader2, Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../../ui/Button'
import { githubUrlSchema } from '../../../lib/validators'
import { demoGraph } from '../../../lib/mockData'
import { submitRepoAnalysis } from '../../../services/repoService'
import { useAuthStore } from '../../../store/authStore'
import { useRepoStore } from '../../../store/repoStore'
import { cn, sleep } from '../../../lib/utils'

const schema = z.object({ githubUrl: githubUrlSchema })

const EXAMPLE_REPOS = ['facebook/react', 'vercel/next.js', 'microsoft/vscode']

export function RepoUrlInput({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const addRepo = useRepoStore((state) => state.addRepo)
  const setAnalysisStatus = useRepoStore((state) => state.setAnalysisStatus)
  const setGraphData = useRepoStore((state) => state.setGraphData)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { githubUrl: 'https://github.com/facebook/react' },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const repo = await submitRepoAnalysis(values.githubUrl)
      addRepo(repo)
      setGraphData({ ...demoGraph, meta: { ...demoGraph.meta, repoId: repo.id } })
      toast.success('Analysis started. Mapping in progress...')

      const destination = `/analysis/${repo.id}`
      if (!isAuthenticated) {
        navigate(`/signin?redirect=${encodeURIComponent(destination)}`)
        return
      }

      navigate(destination)
      void simulateAnalysis(setAnalysisStatus)
    } catch {
      toast.error(errors.githubUrl?.message ?? 'Could not start analysis.')
    }
  }

  return (
    <div className={cn('w-full', compact ? 'max-w-none' : 'mx-auto max-w-2xl')}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          className={cn(
            'group flex items-center gap-2 rounded-2xl border p-2 shadow-lg transition-all duration-200',
            inverted
              ? 'border-white/25 bg-white/15 backdrop-blur-sm focus-within:border-white/50 focus-within:bg-white/20'
              : 'border-border bg-card focus-within:border-primary/50 focus-within:shadow-xl focus-within:shadow-primary/10',
          )}
        >
          <div className={cn('ml-2 shrink-0', inverted ? 'text-white' : 'text-primary')}>
            <GitBranch className="size-5" />
          </div>
          <input
            className={cn(
              'h-11 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground',
              inverted && 'text-white placeholder:text-white/60',
            )}
            placeholder="https://github.com/owner/repo"
            {...register('githubUrl')}
          />
          <Button
            type="submit"
            disabled={isSubmitting}
            className="shrink-0 gap-2 rounded-xl"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : compact ? null : (
              <Sparkles className="size-4" />
            )}
            {compact ? (isSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Analyze') : 'Analyze'}
            {!compact && !isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>

      {errors.githubUrl ? (
        <p className={cn('mt-2 text-sm', inverted ? 'text-white/80' : 'text-destructive')}>
          {errors.githubUrl.message}
        </p>
      ) : null}

      {!compact ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLE_REPOS.map((repo) => (
            <button
              key={repo}
              type="button"
              onClick={() => setValue('githubUrl', `https://github.com/${repo}`)}
              className={cn(
                'rounded-lg px-2.5 py-1 font-mono text-xs transition-colors',
                inverted
                  ? 'text-white/70 hover:bg-white/15 hover:text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {repo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

async function simulateAnalysis(
  setAnalysisStatus: (status: any, progress: number, stage: string, log?: string) => void,
) {
  const steps = [
    ['cloning', 14, 'Cloning repository...', 'git clone --depth=1 completed'],
    ['parsing', 36, 'Parsing TypeScript files...', 'Parsed 142 TypeScript files'],
    ['analyzing', 58, 'Computing dependency graph...', 'Built 128 nodes and 421 edges'],
    ['ai_processing', 82, 'Running AI analysis...', 'Generated ownership and priority signals'],
    ['complete', 100, 'Architecture map ready', 'Analysis complete'],
  ] as const

  for (const step of steps) {
    setAnalysisStatus(step[0], step[1], step[2], step[3])
    await sleep(560)
  }
}
