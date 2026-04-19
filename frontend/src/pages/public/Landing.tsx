import { AnimatePresence, motion, useInView, useMotionTemplate, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight, Bot, Brain, CheckCircle2, ChevronRight, GitBranch,
  Radar, Route, Search, ShieldAlert, Sparkles, Star, Zap
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { GittsuriLogo } from '../../components/ui/Logo'
import { RepoUrlInput } from '../../components/features/repo/RepoUrlInput'

const features = [
  {
    title: 'Interactive Architecture Graph',
    copy: 'Pan across modules, click into files, and see structure instead of scanning folder trees.',
    icon: GittsuriLogo,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    title: 'AI-Generated Flow Diagrams',
    copy: 'Turn selected files into Mermaid diagrams with readable control and data flow.',
    icon: Bot,
    color: 'from-violet-500 to-purple-500',
  },
  {
    title: 'Priority-Ranked Onboarding',
    copy: 'Start with the files that carry the most architectural weight.',
    icon: Route,
    color: 'from-purple-500 to-pink-500',
  },
]

const deepDives = [
  { title: 'Smart Approvals', copy: 'Sequential and parallel workflows stay visible as jobs move through the queue.', icon: GitBranch },
  { title: 'Receipt OCR', copy: 'Scan source artifacts and auto-fill the missing context before analysis begins.', icon: Search },
  { title: 'Blast Radius', copy: 'See what breaks before you push by tracing transitive dependents.', icon: Radar },
  { title: 'Ask the Codebase', copy: 'Natural language questions resolve into highlighted graph subregions.', icon: Brain },
  { title: 'Cognitive Load Score', copy: 'Know the cost of understanding a file before opening it.', icon: ShieldAlert },
]

const steps = [
  {
    step: '01',
    title: 'Paste URL',
    desc: 'Drop any GitHub URL and instantly start a deep architecture scan.',
    icon: GitBranch,
    color: 'from-sky-500 to-indigo-500',
    badge: 'Repo Intake',
    command: '$ gittsuri analyze https://github.com/facebook/react',
    output: [
      'Validated repository access and branch metadata.',
      'Cloned source snapshot and queued parser workers.',
      'Detected 40+ languages across 9,842 files.',
    ],
    metricLabel: 'Files indexed',
    metricValue: '9,842',
  },
  {
    step: '02',
    title: 'Watch Analysis',
    desc: 'Parsers, graph builder, and AI ranking stream updates in real time.',
    icon: Zap,
    color: 'from-indigo-500 to-fuchsia-500',
    badge: 'Live Pipeline',
    command: '$ gittsuri stream --pipeline parser,graph,priority,ownership',
    output: [
      'Built dependency graph with weighted import edges.',
      'Generated ownership map from commit history + CODEOWNERS.',
      'Ranked onboarding files by centrality and complexity.',
    ],
    metricLabel: 'Modules mapped',
    metricValue: '128',
  },
  {
    step: '03',
    title: 'Explore Graph',
    desc: 'Traverse nodes, inspect flows, and ask natural-language questions.',
    icon: Sparkles,
    color: 'from-fuchsia-500 to-rose-500',
    badge: 'Interactive Canvas',
    command: '$ gittsuri open --view architecture --focus priority',
    output: [
      'Highlighted top-risk files with blast-radius overlays.',
      'Rendered flow + ownership views from one shared graph model.',
      'Enabled NL query mode for guided onboarding walkthroughs.',
    ],
    metricLabel: 'Hotspots surfaced',
    metricValue: '23',
  },
]

const testimonials = [
  { quote: 'The graph finally made our monolith legible.', role: 'Principal Engineer', company: 'Stripe', rating: 5 },
  { quote: 'Priority mode shaved days off our onboarding process.', role: 'Engineering Manager', company: 'Vercel', rating: 5 },
  { quote: 'Ownership view answered who to ask in literal seconds.', role: 'Staff Engineer', company: 'Linear', rating: 5 },
]

const HERO_TYPEWRITER_WORDS = ['repo', 'monolith', 'frontend', 'backend', 'service']

export function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const howSectionRef = useRef<HTMLElement>(null)
  const [typedWord, setTypedWord] = useState('')
  const [activeWordIndex, setActiveWordIndex] = useState(0)
  const [isDeletingWord, setIsDeletingWord] = useState(false)
  const [activeHowStep, setActiveHowStep] = useState(0)
  const [isHowPaused, setIsHowPaused] = useState(false)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const { scrollY } = useScroll()
  const isHowInView = useInView(howSectionRef, { amount: 0.35 })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const navProgress = useTransform(scrollY, [0, 120], [0, 1])
  const navWidth = useTransform(navProgress, [0, 1], ['100%', 'min(1120px, calc(100% - 2rem))'])
  const navTop = useTransform(navProgress, [0, 1], [10, 16])
  const navRadius = useTransform(navProgress, [0, 1], [10, 20])
  const navShadow = useTransform(
    navProgress,
    [0, 1],
    [
      'none',
      '0 10px 24px -16px rgba(36, 44, 94, 0.28)',
    ],
  )
  const navBorderOpacity = useTransform(navProgress, [0, 1], [0, 0.9])
  const navBgOpacity = useTransform(navProgress, [0, 1], [0, 0.98])
  const navBorder = useMotionTemplate`1px solid rgba(196, 205, 236, ${navBorderOpacity})`
  const navBackground = useMotionTemplate`rgba(249, 251, 255, ${navBgOpacity})`

  useEffect(() => {
    const currentWord = HERO_TYPEWRITER_WORDS[activeWordIndex]
    const isWordComplete = typedWord === currentWord
    const isWordEmpty = typedWord.length === 0

    const nextDelay = isWordComplete
      ? 1050
      : isDeletingWord
        ? 50
        : 85

    const timer = window.setTimeout(() => {
      if (!isDeletingWord) {
        if (!isWordComplete) {
          setTypedWord(currentWord.slice(0, typedWord.length + 1))
          return
        }
        setIsDeletingWord(true)
        return
      }

      if (!isWordEmpty) {
        setTypedWord(currentWord.slice(0, typedWord.length - 1))
        return
      }

      setIsDeletingWord(false)
      setActiveWordIndex((idx) => (idx + 1) % HERO_TYPEWRITER_WORDS.length)
    }, nextDelay)

    return () => window.clearTimeout(timer)
  }, [activeWordIndex, isDeletingWord, typedWord])

  useEffect(() => {
    if (!isHowInView || isHowPaused) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveHowStep((prev) => (prev + 1) % steps.length)
    }, 3200)

    return () => window.clearInterval(timer)
  }, [isHowInView, isHowPaused])

  const activeHowStepItem = steps[activeHowStep]

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* ── Navbar ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed left-0 right-0 top-0 z-50"
      >
        <motion.div
          className="mx-auto h-14"
          style={{
            width: navWidth,
            marginTop: navTop,
            borderRadius: navRadius,
            border: navBorder,
            background: navBackground,
            boxShadow: navShadow,
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-5">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                <GittsuriLogo className="size-4" />
              </span>
              <span className="brand-gradient-text font-heading text-xl font-bold tracking-tight">Gittsurī</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {['Features', 'Views', 'Flow'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild className="group relative overflow-hidden">
                <Link to="/signup">
                  <span className="relative z-10 flex items-center gap-1.5">
                    Get Started
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.header>

      <main>
        {/* ══════════════════════════════════════
            HERO 
        ══════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="mesh-gradient relative flex min-h-[100svh] items-center overflow-hidden px-5 pt-28 pb-16"
        >
          {/* Subtle background accent — theme primary only, no hardcoded purple */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 size-[500px] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -right-24 bottom-0 size-[400px] rounded-full bg-primary/4 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2">
            {/* Left: Text */}
            <motion.div
              style={{ y: heroY, opacity: heroOpacity }}
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
              className="relative z-10"
            >
              {/* <motion.div
                variants={fadeUp}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 text-xs font-medium text-primary"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Built for DevClash 2026 · Now in beta
              </motion.div> */}

              <motion.h1
                variants={fadeUp}
                className="font-heading text-5xl font-bold leading-[1.08] tracking-tight text-balance md:text-6xl lg:text-7xl"
              >
                Decode any{' '}
                <span className="brand-gradient-text inline-flex min-w-[10.4ch] items-baseline justify-start">
                  {typedWord || ' '}
                  <span className="ml-1 inline-block h-[0.9em] w-[2px] rounded-full bg-primary animate-pulse" />
                </span>{' '}
                before your first coffee cools.
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
              >
                Drop in a GitHub URL. Get a living, interactive architecture map — AI-explained,
                priority-ranked, and ownership-mapped. No setup required.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => navigate('/signup')}
                  className="group relative overflow-hidden px-7 shadow-xl shadow-primary/20"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Analyze a Repo
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-500 group-hover:translate-x-full" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('views')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group gap-2"
                >
                  Watch Demo
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex items-center gap-6">
                <div className="flex -space-x-2">
                  {['A', 'B', 'C', 'D'].map((l, i) => (
                    <div
                      key={l}
                      className="flex size-8 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white"
                      style={{ background: `hsl(${265 + i * 18} 80% 55%)`, zIndex: 4 - i }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Trusted by <strong className="text-foreground">12,000+</strong> developers
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: Inverted dependency tree */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="relative h-[460px] lg:h-[540px]"
            >
              <InvertedTree />
            </motion.div>
          </div>
        </section>

        {/* ── Ticker ── */}
        <section className="noise-section relative overflow-hidden border-y border-border bg-card/60 py-3.5 backdrop-blur-sm">
          <div className="flex gap-0 overflow-hidden">
            <motion.div
              className="flex shrink-0 gap-0"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            >
              {Array.from({ length: 2 }).flatMap((_, copy) =>
                ['60-second analysis', '40+ languages', '3 graph views', 'AI-powered insights', 'Open source friendly', 'Priority ranking', 'Ownership mapping', 'Dead code detection'].map((item) => (
                  <span
                    key={`${copy}-${item}`}
                    className="flex items-center gap-3 whitespace-nowrap px-6 font-mono text-sm text-muted-foreground"
                  >
                    <span className="inline-block size-1.5 rounded-full bg-primary/60" />
                    {item}
                  </span>
                )),
              )}
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FEATURES
        ══════════════════════════════════════ */}
        <section id="features" className="noise-section mx-auto max-w-7xl px-5 py-24">
          <SectionHeading
            eyebrow="Feature Set"
            title="A map that answers back."
            subtitle="Everything you need to understand a codebase, built into a single interactive canvas."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="interactive-card group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                {/* Card noise grain */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  backgroundSize: '180px 180px',
                }} />
                {/* Gradient corner glow on hover */}
                <div className={`absolute -right-8 -top-8 size-32 rounded-full bg-gradient-to-br ${feature.color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20`} />

                <div className={`mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} shadow-lg`}>
                  <feature.icon className="size-6 text-white" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{feature.copy}</p>
                <MiniPreview index={index} />
                <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Learn more <ArrowRight className="size-3" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════ */}
        <section
          ref={howSectionRef}
          className="noise-section relative overflow-hidden border-y border-border bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 px-5 py-24"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-primary/10 blur-3xl"
            animate={{ x: [0, 36, 0], y: [0, -12, 0], opacity: [0.3, 0.45, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-20 bottom-8 size-80 rounded-full bg-primary/10 blur-3xl"
            animate={{ x: [0, -28, 0], y: [0, 10, 0], opacity: [0.26, 0.4, 0.26] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="How It Works"
              title="Three steps to clarity."
              subtitle="From URL to interactive architecture map in under 60 seconds."
            />
            <div className="mt-10 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/75 px-3 py-1.5 backdrop-blur">
                <span className={`inline-flex size-2 rounded-full ${isHowPaused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                  {isHowPaused ? 'Playback Paused' : 'Live Auto Tour'}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsHowPaused((prev) => !prev)}
                className="min-w-24"
              >
                {isHowPaused ? 'Resume' : 'Pause'}
              </Button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div
                className="space-y-4"
                onMouseEnter={() => setIsHowPaused(true)}
                onMouseLeave={() => setIsHowPaused(false)}
              >
                {steps.map((item, index) => {
                  const isActive = index === activeHowStep
                  return (
                    <motion.button
                      key={item.step}
                      type="button"
                      initial={{ opacity: 0, x: -18 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08, duration: 0.45 }}
                      onMouseEnter={() => setActiveHowStep(index)}
                      onFocus={() => setActiveHowStep(index)}
                      onClick={() => setActiveHowStep(index)}
                      className={`group relative w-full overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300 ${
                        isActive
                          ? 'border-primary/50 bg-white shadow-lg shadow-primary/12'
                          : 'border-border bg-white/80 hover:border-primary/30 hover:bg-white/95'
                      }`}
                      animate={isActive ? { y: -2, scale: 1.01 } : { y: 0, scale: 1 }}
                    >
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
                        background: `linear-gradient(120deg, transparent 0%, rgba(99,102,241,0.08) 50%, transparent 100%)`,
                      }} />
                      <div className="relative flex items-start gap-4">
                        <span className="font-mono text-5xl leading-none text-primary/14">{item.step}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-bold">{item.title}</h3>
                            <div className={`inline-flex size-10 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-md shadow-primary/15`}>
                              <item.icon className="size-5 text-white" />
                            </div>
                          </div>
                          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                            <motion.div
                              className="h-full rounded-full bg-linear-to-r from-primary to-primary/60"
                              animate={{ width: isActive ? '100%' : '32%' }}
                              transition={{ duration: isActive ? 3.0 : 0.35, ease: 'easeInOut' }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <motion.div
                layout
                onMouseEnter={() => setIsHowPaused(true)}
                onMouseLeave={() => setIsHowPaused(false)}
                className="relative overflow-hidden rounded-3xl border border-primary/20 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-primary/20"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-rose-400/80" />
                    <span className="size-2.5 rounded-full bg-amber-400/80" />
                    <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Interactive Demo</span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHowStepItem.step}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28 }}
                    className="mt-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/90">
                        {activeHowStepItem.badge}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                        Step {activeHowStepItem.step} / 03
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 font-mono text-xs text-primary">
                      {activeHowStepItem.command}
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {activeHowStepItem.output.map((line, idx) => (
                        <motion.div
                          key={`${activeHowStepItem.step}-${line}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="flex items-start gap-2"
                        >
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                          <span className="text-sm text-slate-200/92">{line}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{activeHowStepItem.metricLabel}</p>
                        <motion.p
                          key={`metric-${activeHowStepItem.step}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-1 font-heading text-2xl font-bold text-white"
                        >
                          {activeHowStepItem.metricValue}
                        </motion.p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Pipeline</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                          <motion.div
                            className="h-full rounded-full bg-linear-to-r from-primary via-indigo-400 to-fuchsia-400"
                            animate={{ width: `${((activeHowStep + 1) / steps.length) * 100}%` }}
                            transition={{ duration: 0.45, ease: 'easeOut' }}
                          />
                        </div>
                        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-slate-300">
                          {activeHowStep + 1}/{steps.length} stages active
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            GRAPH VIEWS
        ══════════════════════════════════════ */}
        <section id="views" className="mx-auto max-w-7xl px-5 py-24">
          <SectionHeading
            eyebrow="Graph Views"
            title="Switch the same map into three mental models."
            subtitle="Color, rank, and filter the same architecture through a different lens."
          />
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <GraphMockup />
            <div className="space-y-4">
              {[
                { name: 'Dependency Graph', desc: 'See every import chain and module boundary at a glance.', active: true },
                { name: 'Ownership Graph', desc: 'Color nodes by team, commit history, or CODEOWNERS patterns.' },
                { name: 'Priority Graph', desc: 'Surface the highest-impact files by centrality and complexity.' },
              ].map((view) => (
                <motion.div
                  key={view.name}
                  whileHover={{ x: 4 }}
                  className={`group cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
                    view.active
                      ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/8'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-primary/3'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{view.name}</h3>
                    <ChevronRight className={`size-4 transition-transform group-hover:translate-x-1 ${view.active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{view.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            DEEP DIVES
        ══════════════════════════════════════ */}
        <section
          id="flow"
          className="noise-section relative overflow-hidden border-y border-border py-24"
          style={{
            background: 'linear-gradient(135deg, oklch(0.97 0.01 265) 0%, oklch(0.95 0.02 280) 50%, oklch(0.97 0.01 265) 100%)',
          }}
        >
          <div className="mx-auto max-w-7xl px-5">
            <SectionHeading
              eyebrow="Deep Dives"
              title="Built for the exact questions senior engineers ask."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {deepDives.map(({ title, copy, icon: Icon }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="interactive-card group rounded-2xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur-sm"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="size-5 text-primary transition-colors group-hover:text-white" />
                  </div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            TESTIMONIALS
        ══════════════════════════════════════ */}
        <section className="mx-auto max-w-7xl px-5 py-24">
          <SectionHeading
            eyebrow="Developers"
            title="Feels like a tool, not a pitch deck."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, index) => (
              <motion.div
                key={t.quote}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="interactive-card group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  backgroundSize: '180px 180px',
                }} />
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="font-mono text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div
                    className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: `hsl(${265 + index * 20} 70% 55%)` }}
                  >
                    {t.role[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.role}</p>
                    <p className="text-xs text-muted-foreground">{t.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            CTA BANNER
        ══════════════════════════════════════ */}
        <section className="px-5 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="noise-section relative mx-auto max-w-7xl overflow-hidden rounded-3xl p-px shadow-2xl shadow-primary/20"
            style={{
              background: 'conic-gradient(from 180deg at 50% 50%, oklch(0.50 0.22 265), oklch(0.55 0.22 290), oklch(0.60 0.20 310), oklch(0.50 0.22 265))',
            }}
          >
            <div
              className="relative rounded-[calc(1.5rem-1px)] p-10 md:p-14"
              style={{
                background: 'linear-gradient(135deg, oklch(0.40 0.22 265), oklch(0.50 0.24 285), oklch(0.44 0.22 260))',
              }}
            >
              {/* Noise texture */}
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: '180px 180px',
                borderRadius: 'inherit',
              }} />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="font-mono text-sm text-white/70">Map your first repo in 60 seconds.</p>
                  <h2 className="mt-2 font-heading text-4xl font-bold text-white md:text-5xl">Get started free.</h2>
                  <p className="mt-3 text-white/70">No credit card. No setup. Just understanding.</p>
                </div>
                <RepoUrlInput compact inverted />
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card/50 px-5 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GittsuriLogo className="size-3.5" />
              </span>
              <span className="brand-gradient-text font-heading text-lg font-bold">Gittsurī</span>
            </Link>
            <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
              {['Features', 'Docs', 'GitHub', 'Privacy'].map((l) => (
                <a key={l} href="#" className="transition-colors hover:text-foreground">{l}</a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Built for DevClash 2026 · MIT License</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <motion.p
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary"
      >
        <span className="inline-block size-4 rounded-full bg-primary/15 text-center text-[8px] leading-4">✦</span>
        {eyebrow}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.08 }}
        className="mt-3 max-w-3xl font-heading text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl"
      >
        {title}
      </motion.h2>
      {subtitle ? (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.16 }}
          className="mt-4 max-w-2xl text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      ) : null}
    </div>
  )
}

function GraphMockup() {
  const lines: [number, number, number, number][] = [
    [120, 100, 290, 160],
    [290, 160, 480, 120],
    [290, 160, 420, 300],
    [120, 100, 170, 310],
    [480, 120, 560, 270],
    [420, 300, 560, 270],
  ]
  const nodes: [number, number, string, boolean][] = [
    [120, 100, 'router.tsx', true],
    [290, 160, 'GraphCanvas.tsx', true],
    [480, 120, 'socketService.ts', false],
    [420, 300, 'FileDetailPanel.tsx', false],
    [170, 310, 'priorityStore.ts', false],
    [560, 270, 'ownership.ts', false],
  ]
  return (
    <div className="dot-grid relative h-[460px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/8">
      <div className="flex h-12 items-center justify-between border-b border-border px-5">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-red-400/70" />
          <span className="size-3 rounded-full bg-amber-400/70" />
          <span className="size-3 rounded-full bg-green-400/70" />
        </div>
        <span className="font-mono text-xs text-muted-foreground">facebook/react · 128 nodes</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">Live</span>
      </div>
      <svg viewBox="0 0 680 400" className="h-full w-full">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {lines.map(([x1, y1, x2, y2], idx) => (
          <motion.line
            key={idx}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeOpacity="0.25"
            strokeDasharray="4 6"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1, duration: 0.6 }}
          />
        ))}
        {nodes.map(([x, y, label, primary], idx) => (
          <motion.g
            key={String(label)}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.08, type: 'spring' }}
          >
            <rect
              x={Number(x) - 70} y={Number(y) - 20} width="140" height="40" rx="10"
              fill="white"
              stroke={primary ? 'var(--primary)' : 'var(--border)'}
              strokeWidth={primary ? 1.5 : 1}
              filter={primary ? 'url(#glow)' : undefined}
            />
            {primary && (
              <rect
                x={Number(x) - 70} y={Number(y) - 20} width="140" height="40" rx="10"
                fill="var(--primary)" fillOpacity="0.06"
              />
            )}
            <text
              x={Number(x)} y={Number(y) + 5}
              textAnchor="middle"
              fill={primary ? 'var(--primary)' : 'var(--foreground)'}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fontWeight={primary ? '600' : '400'}
            >
              {String(label)}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  )
}

// ── Inverted dependency tree with file-name boxes ─────────────────────────
type TreeLevel = 0 | 1 | 2 | 3

type TreeNode = {
  id: number
  x: number
  y: number
  label: string
  level: TreeLevel
  delay: number
}

type TreeEdge = {
  from: number
  to: number
  delay: number
}

const FILE_NODES: TreeNode[] = [
  { id: 0, x: 380, y: 36,  label: 'index.tsx',          level: 0, delay: 0.00 },
  { id: 1, x: 144, y: 124, label: 'router.tsx',         level: 1, delay: 0.35 },
  { id: 2, x: 380, y: 124, label: 'GraphCanvas.tsx',    level: 1, delay: 0.50 },
  { id: 3, x: 616, y: 124, label: 'apiService.ts',      level: 1, delay: 0.65 },
  { id: 4, x: 85,  y: 212, label: 'AppShell.tsx',       level: 2, delay: 0.80 },
  { id: 5, x: 203, y: 212, label: 'layout.tsx',         level: 2, delay: 0.90 },
  { id: 6, x: 321, y: 212, label: 'graphStore.ts',      level: 2, delay: 1.00 },
  { id: 7, x: 439, y: 212, label: 'NodeCustom.tsx',     level: 2, delay: 1.10 },
  { id: 8, x: 557, y: 212, label: 'repoService.ts',     level: 2, delay: 1.20 },
  { id: 9, x: 675, y: 212, label: 'types.ts',           level: 2, delay: 1.30 },
  { id: 10, x: 85,  y: 296, label: 'Sidebar.tsx',       level: 3, delay: 1.40 },
  { id: 11, x: 203, y: 296, label: 'Topbar.tsx',        level: 3, delay: 1.48 },
  { id: 12, x: 321, y: 296, label: 'useGraph.ts',       level: 3, delay: 1.56 },
  { id: 13, x: 439, y: 296, label: 'graphUtils.ts',     level: 3, delay: 1.64 },
  { id: 14, x: 557, y: 296, label: 'api.ts',            level: 3, delay: 1.72 },
  { id: 15, x: 675, y: 296, label: 'types/index.ts',    level: 3, delay: 1.80 },
]

const FILE_EDGES: TreeEdge[] = [
  { from: 0, to: 1, delay: 0.16 },
  { from: 0, to: 2, delay: 0.22 },
  { from: 0, to: 3, delay: 0.28 },
  { from: 1, to: 4, delay: 0.52 },
  { from: 1, to: 5, delay: 0.58 },
  { from: 2, to: 6, delay: 0.64 },
  { from: 2, to: 7, delay: 0.70 },
  { from: 3, to: 8, delay: 0.76 },
  { from: 3, to: 9, delay: 0.82 },
  { from: 4, to: 10, delay: 0.96 },
  { from: 5, to: 11, delay: 1.02 },
  { from: 6, to: 12, delay: 1.08 },
  { from: 7, to: 13, delay: 1.14 },
  { from: 8, to: 14, delay: 1.20 },
  { from: 9, to: 15, delay: 1.26 },
]

const BOX_CFG: Record<TreeLevel, { minW: number; maxW: number; h: number; rx: number; fontSize: number }> = {
  0: { minW: 140, maxW: 176, h: 36, rx: 10, fontSize: 12.5 },
  1: { minW: 122, maxW: 160, h: 34, rx: 9,  fontSize: 11.5 },
  2: { minW: 102, maxW: 140, h: 31, rx: 8,  fontSize: 10.5 },
  3: { minW: 92,  maxW: 128, h: 28, rx: 7,  fontSize: 10 },
}

function getNodeWidth(label: string, level: TreeLevel) {
  const cfg = BOX_CFG[level]
  const roughCharWidth = level === 0 ? 7.2 : level === 1 ? 6.8 : 6.2
  const rawWidth = label.length * roughCharWidth + 24
  return Math.min(cfg.maxW, Math.max(cfg.minW, rawWidth))
}

function InvertedTree() {
  const [isRootHovered, setIsRootHovered] = useState(false)

  const nodeById = useMemo(
    () => new Map(FILE_NODES.map((node) => [node.id, node])),
    [],
  )

  const edgePaths = useMemo(
    () =>
      FILE_EDGES.map((edge) => {
        const from = nodeById.get(edge.from)!
        const to = nodeById.get(edge.to)!
        const fromH = BOX_CFG[from.level].h
        const toH = BOX_CFG[to.level].h
        const startY = from.y + fromH / 2
        const endY = to.y - toH / 2
        const midY = (startY + endY) / 2
        return {
          ...edge,
          d: `M${from.x},${startY} C${from.x},${midY} ${to.x},${midY} ${to.x},${endY}`,
        }
      }),
    [nodeById],
  )

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 760 332"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="hero-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hero-flow-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="flowBlur" />
            <feMerge><feMergeNode in="flowBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Base edges */}
        {edgePaths.map((edge, i) => (
          <motion.path
            key={`${edge.from}-${edge.to}`}
            d={edge.d}
            stroke="var(--primary)"
            strokeWidth="1.45"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: isRootHovered ? 0.42 : 0.24,
            }}
            transition={{
              delay: edge.delay,
              duration: 0.52,
              ease: 'easeOut',
            }}
          />
        ))}

        {/* Hover flow layer from root */}
        {edgePaths.map((edge, i) => (
          <motion.path
            key={`flow-${edge.from}-${edge.to}`}
            d={edge.d}
            stroke="var(--primary)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="8 10"
            filter="url(#hero-flow-glow)"
            initial={{ opacity: 0 }}
            animate={
              isRootHovered
                ? {
                    opacity: [0.12, 0.78, 0.12],
                    strokeDashoffset: [0, -48],
                  }
                : {
                    opacity: 0,
                    strokeDashoffset: 0,
                  }
            }
            transition={
              isRootHovered
                ? {
                    duration: 1.15,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.045,
                  }
                : { duration: 0.2 }
            }
          />
        ))}

        {/* File-name box nodes */}
        {FILE_NODES.map((node) => {
          const cfg = BOX_CFG[node.level]
          const width = getNodeWidth(node.label, node.level)
          const hw = width / 2
          const hh = cfg.h / 2
          const isRoot = node.level === 0
          const isL1 = node.level === 1
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.58 }}
              animate={{ opacity: 1, scale: isRoot && isRootHovered ? 1.03 : 1 }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              transition={{
                delay: node.delay,
                duration: 0.45,
                type: 'spring',
                stiffness: 290,
                damping: 24,
              }}
              onHoverStart={isRoot ? () => setIsRootHovered(true) : undefined}
              onHoverEnd={isRoot ? () => setIsRootHovered(false) : undefined}
              className={isRoot ? 'cursor-pointer' : undefined}
            >
              {isRoot && (
                <rect
                  x={node.x - hw - 6}
                  y={node.y - hh - 6}
                  width={width + 12}
                  height={cfg.h + 12}
                  rx={cfg.rx + 5}
                  fill="var(--primary)"
                  fillOpacity={isRootHovered ? 0.2 : 0.13}
                  style={{ filter: 'blur(7px)' }}
                />
              )}

              <rect
                x={node.x - hw}
                y={node.y - hh}
                width={width}
                height={cfg.h}
                rx={cfg.rx}
                fill="white"
                fillOpacity={isRoot ? 1 : isL1 ? 0.94 : 0.90}
                stroke={isRoot ? 'var(--primary)' : 'var(--border)'}
                strokeWidth={isRoot ? 1.6 : 1}
                filter={isRoot ? 'url(#hero-glow)' : undefined}
              />

              {isRoot && (
                <rect
                  x={node.x - hw}
                  y={node.y - hh}
                  width={width}
                  height={cfg.h}
                  rx={cfg.rx}
                  fill="var(--primary)"
                  fillOpacity={isRootHovered ? 0.11 : 0.07}
                />
              )}

              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isRoot ? 'var(--primary)' : 'var(--foreground)'}
                fontSize={cfg.fontSize}
                fontFamily="ui-monospace, 'Cascadia Code', Menlo, monospace"
                fontWeight={isRoot ? 650 : 500}
                letterSpacing={node.level >= 2 ? '0.15px' : '0.1px'}
                fillOpacity={isRoot ? 1 : isL1 ? 0.86 : 0.74}
              >
                {node.label}
              </text>
            </motion.g>
          )
        })}

        {/* Root pulse ring appears strongest on hover */}
        {(() => {
          const root = FILE_NODES[0]
          const rootCfg = BOX_CFG[root.level]
          const rootW = getNodeWidth(root.label, root.level)
          return (
            <motion.rect
              x={root.x - rootW / 2 - 10}
              y={root.y - rootCfg.h / 2 - 10}
              width={rootW + 20}
              height={rootCfg.h + 20}
              rx={rootCfg.rx + 8}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              animate={{
                strokeOpacity: isRootHovered ? [0.72, 0.08, 0.72] : [0.38, 0.02, 0.38],
                scale: isRootHovered ? [1, 1.04, 1] : [1, 1.02, 1],
              }}
              style={{ transformOrigin: `${root.x}px ${root.y}px` }}
              transition={{
                duration: isRootHovered ? 1.05 : 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 1.0,
              }}
            />
          )
        })()}
      </svg>
    </div>
  )
}

function MiniPreview({ index }: { index: number }) {
  return (
    <div className="mt-6 h-28 overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
      {index === 0 ? (
        <svg viewBox="0 0 240 80" className="h-full w-full">
          <line x1="40" y1="40" x2="120" y2="20" stroke="var(--primary)" strokeWidth="1.5" strokeOpacity="0.6" />
          <line x1="120" y1="20" x2="200" y2="52" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="40" y1="40" x2="120" y2="60" stroke="var(--border)" strokeWidth="1.5" />
          {[
            [40, 40, true], [120, 20, true], [200, 52, false], [120, 60, false],
          ].map(([cx, cy, primary], i) => (
            <circle
              key={i}
              cx={Number(cx)} cy={Number(cy)} r="12"
              fill="white"
              stroke={primary ? 'var(--primary)' : 'var(--border)'}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      ) : index === 1 ? (
        <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
          <div className="rounded-lg bg-white/80 px-2.5 py-1.5 text-primary">flowchart TD</div>
          <div className="rounded-lg bg-white/80 px-2.5 py-1.5">Parser -- edges --&gt; Graph</div>
          <div className="rounded-lg bg-white/80 px-2.5 py-1.5">AI --&gt; Priority</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {['#1 router.tsx', '#2 GraphCanvas.tsx', '#3 graphStore.ts'].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 font-mono text-xs">
              <CheckCircle2 className="size-3 shrink-0 text-primary" />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
