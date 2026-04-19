import { zodResolver } from '@hookform/resolvers/zod'
import * as Checkbox from '@radix-ui/react-checkbox'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../../ui/Button'
import { loginSchema } from '../../../lib/validators'
import { loginUser, loginWithGoogle } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [shake, setShake] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })

  const remember = watch('remember')

  async function onSubmit(values: LoginValues) {
    try {
      const response = await loginUser({ email: values.email, password: values.password })
      login(response.token, response.user)
      toast.success('Signed in. Your repo maps are ready.')
      navigate(params.get('redirect') || '/dashboard')
    } catch {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
      toast.error('Invalid credentials.')
    }
  }

  async function onGoogleSignIn() {
    try {
      setIsGoogleLoading(true)
      const response = await loginWithGoogle()
      login(response.token, response.user)
      toast.success('Signed in with Google.')
      navigate(params.get('redirect') || '/dashboard')
    } catch {
      toast.error('Google sign-in failed. Please try again.')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <motion.form
      animate={shake ? { x: [0, -10, 10, -7, 7, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit(onSubmit)}
      className="w-full"
    >
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">Secure workspace</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue mapping architecture, ownership, and onboarding paths.
        </p>
      </div>

      {/* Fields */}
      <div className="space-y-5">
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email address</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Mail className="size-4" />
            </div>
            <input
              type="email"
              autoComplete="email"
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-4 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.email ? 'border-destructive focus:ring-destructive/15' : 'border-border'}`}
              placeholder="you@company.com"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock className="size-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`h-11 w-full rounded-xl border bg-card pl-10 pr-12 text-sm outline-none transition-all duration-200
                placeholder:text-muted-foreground
                focus:border-primary focus:ring-3 focus:ring-primary/15
                ${errors.password ? 'border-destructive focus:ring-destructive/15' : 'border-border'}`}
              placeholder="••••••••"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <motion.span
                animate={{ rotate: showPassword ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </motion.span>
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
      </div>

      {/* Remember & forgot */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox.Root
            checked={remember}
            onCheckedChange={(checked) => setValue('remember', checked === true)}
            className="flex size-4 items-center justify-center rounded border border-input bg-card transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          >
            <Checkbox.Indicator>
              <Check className="size-3" />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <span className="text-muted-foreground">Remember me</span>
        </label>
        <Link
          className="text-primary text-sm font-medium transition-colors hover:text-primary/80 hover:underline"
          to="/forgot-password"
        >
          Forgot password?
        </Link>
      </div>

      {/* Submit */}
      <Button
        className="mt-7 w-full h-11 text-sm font-semibold relative overflow-hidden group"
        type="submit"
        disabled={isSubmitting || isGoogleLoading}
      >
        <span className="relative z-10 flex items-center gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? 'Signing in...' : 'Sign in to Gittsurī'}
        </span>
        <span className="absolute inset-0 -translate-x-full bg-white/15 transition-transform duration-500 group-hover:translate-x-full" />
      </Button>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>OR</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 text-sm font-semibold"
        onClick={() => {
          void onGoogleSignIn()
        }}
        disabled={isSubmitting || isGoogleLoading}
      >
        {isGoogleLoading ? <Loader2 className="size-4 animate-spin" /> : <span className="font-mono text-xs">G</span>}
        {isGoogleLoading ? 'Connecting Google...' : 'Continue with Google'}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/signup" className="font-medium text-primary transition-colors hover:text-primary/80 hover:underline">
          Create one free
        </Link>
      </p>
    </motion.form>
  )
}
