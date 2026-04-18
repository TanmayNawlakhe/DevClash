import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../../ui/Button'
import { registerSchema } from '../../../lib/validators'
import { registerUser } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'

type RegisterValues = z.infer<typeof registerSchema>

const strengthColors = ['bg-destructive', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

export function RegisterForm() {
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const password = watch('password')
  const strength = useMemo(() => passwordStrength(password), [password])
  const strengthLevel = Math.round(strength / 25) // 0-4

  async function onSubmit(values: RegisterValues) {
    try {
      const response = await registerUser(values)
      login(response.token, response.user)
      toast.success('Account created.')
      navigate('/dashboard')
    } catch {
      toast.error('That email is already registered.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">01 / Get started</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your first repo analysis is one URL away. No credit card required.
        </p>
      </div>

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Full name</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <User className="size-4" />
            </div>
            <input
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-4 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.name ? 'border-destructive' : 'border-border'}`}
              placeholder="Jane Smith"
              {...register('name')}
            />
          </div>
          {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email address</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Mail className="size-4" />
            </div>
            <input
              type="email"
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-4 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.email ? 'border-destructive' : 'border-border'}`}
              placeholder="you@company.com"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock className="size-4" />
            </div>
            <input
              type={showPwd ? 'text' : 'password'}
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-12 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.password ? 'border-destructive' : 'border-border'}`}
              placeholder="Minimum 8 characters"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPwd((v) => !v)}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {/* Strength bar */}
          {password && (
            <div className="mt-2.5">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < strengthLevel ? strengthColors[strengthLevel] : 'bg-muted'
                    }`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ transformOrigin: 'left' }}
                  />
                ))}
              </div>
              {strengthLevel > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Password strength:{' '}
                  <span className="font-medium text-foreground">{strengthLabels[strengthLevel]}</span>
                </p>
              )}
            </div>
          )}
          {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {/* Confirm password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Confirm password</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock className="size-4" />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-12 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.confirmPassword ? 'border-destructive' : 'border-border'}`}
              placeholder="Repeat your password"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1.5 text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <Button
        className="mt-7 h-11 w-full text-sm font-semibold relative overflow-hidden group"
        type="submit"
        disabled={isSubmitting}
      >
        <span className="relative z-10 flex items-center gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? 'Creating account...' : 'Create free account'}
        </span>
        <span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-500 group-hover:translate-x-full" />
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/signin" className="font-medium text-primary transition-colors hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

function passwordStrength(value: string) {
  let score = 0
  if (value.length >= 8) score += 25
  if (/[A-Z]/.test(value)) score += 25
  if (/[0-9]/.test(value)) score += 25
  if (/[^A-Za-z0-9]/.test(value)) score += 25
  return Math.min(100, score)
}
