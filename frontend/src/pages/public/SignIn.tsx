import { motion } from 'framer-motion'
import { Brain, Code2, Database, GitBranch, Network, Route, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LoginForm } from '../../components/features/auth/LoginForm'
import { GittsuriLogo } from '../../components/ui/Logo'

export function SignIn() {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1fr]">
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{
          background:
            'linear-gradient(145deg, oklch(0.35 0.20 265) 0%, oklch(0.44 0.24 280) 50%, oklch(0.38 0.22 295) 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.72\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.7\'/%3E%3C/svg%3E")',
            backgroundSize: '200px 200px',
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.018) 3px, rgba(255,255,255,0.018) 4px)',
          }}
        />

        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -left-20 top-1/4 size-64 rounded-full bg-violet-400/25 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-20 right-0 size-72 rounded-full bg-indigo-300/20 blur-3xl"
        />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <GittsuriLogo className="size-5 text-white" />
            </span>
            <span className="font-heading text-2xl font-bold text-white">Gittsuri</span>
          </Link>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="mx-auto w-full max-w-xl">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="max-w-md font-heading text-4xl font-bold leading-tight text-white text-balance"
            >
              The IDE your architecture wished it had.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-5 max-w-sm leading-relaxed text-white/65"
            >
              Graphs, ownership, priority, and flow diagrams in one quiet command center.
            </motion.p>

            <div className="mt-8">
              <ArchitecturePreview />
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {[
            { icon: Sparkles, label: '12,847 repos mapped' },
            { icon: Zap, label: '2.3M files analyzed' },
            { icon: Brain, label: 'AI-powered insights' },
            { icon: Route, label: 'Priority-ranked maps' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm"
            >
              <Icon className="size-4 shrink-0 text-white/70" />
              <span className="text-xs font-medium text-white/85">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-5">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GittsuriLogo className="size-4" />
            </span>
            <span className="brand-gradient-text font-heading text-xl font-bold">Gittsuri</span>
          </Link>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

type PreviewNode = {
  id: string
  x: number
  y: number
  label: string
  file: string
  icon: React.ComponentType<{ className?: string }>
}

function ArchitecturePreview() {
  const nodes: PreviewNode[] = [
    { id: 'entry', x: 70, y: 165, label: 'Entry', file: 'app/router.tsx', icon: Network },
    { id: 'auth', x: 210, y: 95, label: 'Auth', file: 'auth/guard.tsx', icon: ShieldCheck },
    { id: 'graph', x: 240, y: 220, label: 'Graph', file: 'GraphCanvas.tsx', icon: Code2 },
    { id: 'store', x: 380, y: 165, label: 'Store', file: 'graphStore.ts', icon: Database },
    { id: 'panel', x: 485, y: 95, label: 'Panels', file: 'FileDetailPanel.tsx', icon: GitBranch },
  ]

  const edges: Array<[string, string]> = [
    ['entry', 'auth'],
    ['entry', 'graph'],
    ['auth', 'store'],
    ['graph', 'store'],
    ['store', 'panel'],
    ['auth', 'panel'],
  ]

  const byId = Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, PreviewNode>

  return (
    <div className="relative h-[290px] w-full overflow-hidden rounded-2xl border border-white/18 bg-white/8 p-4 backdrop-blur-sm">
      <div className="absolute left-3 top-3 rounded-lg border border-white/20 bg-white/12 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">
        live architecture view
      </div>

      <svg viewBox="0 0 560 260" className="absolute inset-0 h-full w-full">
        {edges.map(([from, to], index) => {
          const a = byId[from]
          const b = byId[to]
          return (
            <motion.line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(255,255,255,0.32)"
              strokeWidth="1.25"
              strokeDasharray="4 8"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0.2, 0.45, 0.2], strokeDashoffset: [0, -18] }}
              transition={{
                pathLength: { delay: 0.15 + index * 0.08, duration: 0.45 },
                opacity: { duration: 3.2 + index * 0.4, repeat: Infinity },
                strokeDashoffset: { duration: 2.6 + index * 0.25, repeat: Infinity, ease: 'linear' },
              }}
            />
          )
        })}
      </svg>

      {nodes.map((node, index) => {
        const Icon = node.icon
        return (
          <motion.div
            key={node.id}
            className="absolute w-[145px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/25 bg-white/14 p-2.5 shadow-lg backdrop-blur-md"
            style={{ left: `${(node.x / 560) * 100}%`, top: `${(node.y / 260) * 100}%` }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: [0, index % 2 ? -5 : 5, 0] }}
            transition={{
              opacity: { delay: 0.25 + index * 0.08, duration: 0.3 },
              y: { duration: 4 + index * 0.4, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-white/25">
                <Icon className="size-3.5 text-white" />
              </span>
              <span className="text-xs font-semibold text-white">{node.label}</span>
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-white/80">{node.file}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
