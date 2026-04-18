import { motion } from 'framer-motion'
import { ArrowRight, Clock3, Code2, FolderGit2, Languages, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnalysisStatsChart } from '../../components/features/dashboard/AnalysisStatsChart'
import { RecentReposTable } from '../../components/features/dashboard/RecentReposTable'
import { StatCard } from '../../components/features/dashboard/StatCard'
import { RepoUrlInput } from '../../components/features/repo/RepoUrlInput'
import { Button } from '../../components/ui/Button'
import { useRepoStore } from '../../store/repoStore'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function Dashboard() {
  const repos = useRepoStore((state) => state.repos)
  const totalFiles = repos.reduce((sum, repo) => sum + repo.files, 0)
  const languages = new Set(repos.flatMap((repo) => repo.languages)).size

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="space-y-8 p-5 lg:p-8"
    >
      {/* ── Welcome banner ── */}
      <motion.div variants={fadeUp}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
              Welcome back
            </p>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
              Your architecture command center
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex size-1.5 rounded-full bg-emerald-500" />
            All systems operational
          </div>
        </div>
      </motion.div>

      {/* ── Analyze input card ── */}
      <motion.section
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/6 via-violet-500/4 to-background p-6 shadow-sm"
      >
        {/* Noise grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
          }}
        />
        {/* Glow blob */}
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="size-4 text-primary" />
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
              New Analysis
            </p>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Paste a GitHub URL. Get the map.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze any public or private repo in under 60 seconds.
          </p>
          <div className="mt-5">
            <RepoUrlInput />
          </div>
        </div>
      </motion.section>

      {/* ── Stats grid ── */}
      <motion.section variants={fadeUp} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Repos Analyzed"
          value={repos.length}
          icon={FolderGit2}
          trend={{ direction: 'up', percent: 18 }}
          color="indigo"
        />
        <StatCard
          label="Total Files Mapped"
          value={totalFiles}
          icon={Code2}
          color="violet"
        />
        <StatCard
          label="Avg. Analysis Time"
          value="47s"
          icon={Clock3}
          color="purple"
        />
        <StatCard
          label="Languages Detected"
          value={languages}
          icon={Languages}
          color="blue"
        />
      </motion.section>

      {/* ── Repos + Chart ── */}
      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold">Recent Repos</h2>
              <p className="text-sm text-muted-foreground">Last 10 analyzed repositories</p>
            </div>
            <Button asChild variant="outline" size="sm" className="group gap-1.5">
              <Link to="/repos">
                View All
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <RecentReposTable repos={repos} />
        </div>
        <div className="space-y-4">
          <AnalysisStatsChart />
          {/* Quick actions */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Analyze a new repo', icon: TrendingUp, to: '/analysis' },
                { label: 'Browse repo history', icon: FolderGit2, to: '/repos' },
              ].map(({ label, icon: Icon, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-all hover:border-primary/30 hover:bg-primary/4 hover:text-primary group"
                >
                  <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  {label}
                  <ChevronRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
