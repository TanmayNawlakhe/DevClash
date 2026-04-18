import { motion, useMotionTemplate, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight, Bot, Brain, CheckCircle2, ChevronRight, GitBranch,
  Radar, Route, Search, ShieldAlert, Sparkles, Star, Zap
} from 'lucide-react'
import { useRef } from 'react'
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
  { step: '01', title: 'Paste URL', desc: 'Drop any GitHub repository URL into Gittsurī and let the engine take over.', icon: GitBranch },
  { step: '02', title: 'Watch Analysis', desc: 'Follow parser, graph builder, AI summarizer, and priority ranker — live.', icon: Zap },
  { step: '03', title: 'Explore Graph', desc: 'Click nodes, ask questions, trace ownership, and navigate like never before.', icon: Sparkles },
]

const testimonials = [
  { quote: 'The graph finally made our monolith legible.', role: 'Principal Engineer', company: 'Stripe', rating: 5 },
  { quote: 'Priority mode shaved days off our onboarding process.', role: 'Engineering Manager', company: 'Vercel', rating: 5 },
  { quote: 'Ownership view answered who to ask in literal seconds.', role: 'Staff Engineer', company: 'Linear', rating: 5 },
]

export function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const { scrollY } = useScroll()
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
              <motion.div
                variants={fadeUp}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 text-xs font-medium text-primary"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Built for DevClash 2026 · Now in beta
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="font-heading text-5xl font-bold leading-[1.08] tracking-tight text-balance md:text-6xl lg:text-7xl"
              >
                Understand any{' '}
                <span className="brand-gradient-text">codebase</span>{' '}
                in 10 minutes.
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
        <section className="noise-section relative overflow-hidden border-y border-border bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30 px-5 py-24">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="How It Works"
              title="Three steps to clarity."
              subtitle="From URL to interactive architecture map in under 60 seconds."
            />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.12, duration: 0.5 }}
                  className="relative"
                >
                  {index < steps.length - 1 && (
                    <div className="absolute left-full top-10 z-10 hidden w-full items-center md:flex">
                      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                      <ChevronRight className="size-4 shrink-0 text-border" />
                    </div>
                  )}
                  <div className="rounded-2xl border border-border bg-white/80 p-7 shadow-sm backdrop-blur-sm">
                    <div className="mb-5 flex items-center gap-4">
                      <span className="font-mono text-5xl font-bold text-primary/12 leading-none">{item.step}</span>
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                        <item.icon className="size-5 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
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

// ── Inverted dependency tree with pulsating nodes ──────────────────────────
const TREE_NODES: Array<{ x: number; y: number; r: number; delay: number; level: number }> = [
  // root
  { x: 250, y: 30,  r: 9,   delay: 0,    level: 0 },
  // level 1
  { x: 100, y: 108, r: 7,   delay: 0.20, level: 1 },
  { x: 250, y: 108, r: 7,   delay: 0.55, level: 1 },
  { x: 400, y: 108, r: 7,   delay: 0.90, level: 1 },
  // level 2
  { x: 42,  y: 196, r: 5.5, delay: 0.35, level: 2 },
  { x: 158, y: 196, r: 5.5, delay: 0.75, level: 2 },
  { x: 215, y: 196, r: 5.5, delay: 1.10, level: 2 },
  { x: 288, y: 196, r: 5.5, delay: 0.45, level: 2 },
  { x: 350, y: 196, r: 5.5, delay: 0.95, level: 2 },
  { x: 455, y: 196, r: 5.5, delay: 0.65, level: 2 },
  // level 3
  { x: 18,  y: 282, r: 4,   delay: 0.60, level: 3 },
  { x: 68,  y: 282, r: 4,   delay: 1.30, level: 3 },
  { x: 148, y: 282, r: 4,   delay: 0.85, level: 3 },
  { x: 200, y: 282, r: 4,   delay: 0.25, level: 3 },
  { x: 255, y: 282, r: 4,   delay: 1.55, level: 3 },
  { x: 310, y: 282, r: 4,   delay: 0.70, level: 3 },
  { x: 360, y: 282, r: 4,   delay: 1.05, level: 3 },
  { x: 418, y: 282, r: 4,   delay: 0.40, level: 3 },
  { x: 470, y: 282, r: 4,   delay: 1.00, level: 3 },
  // level 4 (leaves)
  { x: 10,  y: 366, r: 3,   delay: 0.80, level: 4 },
  { x: 42,  y: 366, r: 3,   delay: 1.40, level: 4 },
  { x: 82,  y: 366, r: 3,   delay: 0.50, level: 4 },
  { x: 138, y: 366, r: 3,   delay: 1.65, level: 4 },
  { x: 240, y: 366, r: 3,   delay: 0.75, level: 4 },
  { x: 272, y: 366, r: 3,   delay: 1.20, level: 4 },
  { x: 345, y: 366, r: 3,   delay: 0.55, level: 4 },
  { x: 400, y: 366, r: 3,   delay: 1.50, level: 4 },
  { x: 435, y: 366, r: 3,   delay: 0.30, level: 4 },
  { x: 476, y: 366, r: 3,   delay: 1.80, level: 4 },
]

const TREE_EDGES: [number, number, number, number][] = [
  // root → L1
  [250,30, 100,108], [250,30, 250,108], [250,30, 400,108],
  // L1a → L2
  [100,108, 42,196], [100,108, 158,196],
  // L1b → L2
  [250,108, 215,196], [250,108, 288,196],
  // L1c → L2
  [400,108, 350,196], [400,108, 455,196],
  // L2 → L3
  [42,196, 18,282], [42,196, 68,282],
  [158,196, 148,282],
  [215,196, 200,282],
  [288,196, 255,282], [288,196, 310,282],
  [350,196, 360,282],
  [455,196, 418,282], [455,196, 470,282],
  // L3 → L4
  [18,282, 10,366], [18,282, 42,366],
  [68,282, 82,366],
  [148,282, 138,366],
  [255,282, 240,366], [255,282, 272,366],
  [360,282, 345,366],
  [418,282, 400,366], [418,282, 435,366],
  [470,282, 476,366],
]

// Opacity stepped by level — root is darkest/most opaque, leaves lightest
const LEVEL_OPACITY = [1, 0.88, 0.75, 0.62, 0.50]

function InvertedTree() {
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 500 400"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: 'visible' }}
      >
        {/* Branch lines — use primary CSS var via style */}
        {TREE_EDGES.map(([x1, y1, x2, y2], i) => {
          const cx = (x1 + x2) / 2
          const cy = y1 + (y2 - y1) * 0.38
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${cx},${cy} ${cx},${y2 - (y2 - y1) * 0.38} ${x2},${y2}`}
              style={{ stroke: 'var(--primary)', opacity: 0.22 }}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          )
        })}

        {/* Nodes */}
        {TREE_NODES.map((node, i) => (
          <g key={i}>
            {/* Pulsing outer ring */}
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.r + 4}
              fill="none"
              style={{ stroke: 'var(--primary)' }}
              animate={{
                r: [node.r + 3, node.r + 12, node.r + 3],
                strokeOpacity: [LEVEL_OPACITY[node.level] * 0.6, 0, LEVEL_OPACITY[node.level] * 0.6],
              }}
              transition={{ duration: 2.6, delay: node.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Core filled node */}
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              style={{ fill: 'var(--primary)' }}
              animate={{
                r: [node.r, node.r * 1.14, node.r],
                fillOpacity: [LEVEL_OPACITY[node.level] * 0.8, LEVEL_OPACITY[node.level], LEVEL_OPACITY[node.level] * 0.8],
              }}
              transition={{ duration: 2.6, delay: node.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          </g>
        ))}
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
