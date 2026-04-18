import { motion } from 'framer-motion'
import { Brain, Code2, GitBranch, Route } from 'lucide-react'
import { GittsuriLogo } from '../../components/ui/Logo'
import { Link } from 'react-router-dom'
import { RegisterForm } from '../../components/features/auth/RegisterForm'

export function SignUp() {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1fr]">
      {/* ── Left brand panel ── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{
          background: 'linear-gradient(145deg, oklch(0.38 0.22 295) 0%, oklch(0.44 0.24 280) 50%, oklch(0.35 0.20 265) 100%)',
        }}
      >
        {/* Noise grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />
        {/* Scan lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.018) 3px, rgba(255,255,255,0.018) 4px)',
          }}
        />
        {/* Glow blobs */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 9, repeat: Infinity }}
          className="absolute right-0 top-1/3 size-72 rounded-full bg-violet-400/25 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 11, repeat: Infinity, delay: 3 }}
          className="absolute -bottom-16 left-0 size-64 rounded-full bg-indigo-300/20 blur-3xl"
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <GittsuriLogo className="size-5 text-white" />
            </span>
            <span className="font-heading text-2xl font-bold text-white">Gittsurī</span>
          </Link>
        </div>

        {/* Center */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="max-w-md font-heading text-4xl font-bold leading-tight text-white text-balance"
            >
              Start with a clean map. Grow from there.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-5 max-w-sm text-white/65 leading-relaxed"
            >
              Your first repo analysis is 60 seconds away. No credit card, no setup.
            </motion.p>

            {/* Feature list */}
            <div className="mt-10 space-y-3">
              {[
                { icon: GitBranch, text: 'Interactive dependency graph' },
                { icon: Brain, text: 'AI-generated file summaries' },
                { icon: Code2, text: 'Priority-ranked onboarding path' },
                { icon: Route, text: 'Blast radius analysis before pushing' },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="size-4 text-white/90" />
                  </span>
                  <span className="text-sm text-white/80">{text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom legal */}
        <p className="relative z-10 text-xs text-white/40">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex items-center justify-center p-5">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GittsuriLogo className="size-4" />
            </span>
            <span className="brand-gradient-text font-heading text-xl font-bold">Gittsurī</span>
          </Link>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
