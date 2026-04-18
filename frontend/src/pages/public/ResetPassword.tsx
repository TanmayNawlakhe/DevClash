import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { resetPasswordSchema } from '../../lib/validators'
import { resetPassword } from '../../services/authService'

type ResetValues = z.infer<typeof resetPasswordSchema>

export function ResetPassword() {
  const [done, setDone] = useState(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetPasswordSchema) })

  async function onSubmit(values: ResetValues) {
    await resetPassword({ token: params.get('token') ?? 'demo', password: values.password })
    setDone(true)
    window.setTimeout(() => navigate('/signin'), 1800)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-xl">
            <CheckCircle2 className="mx-auto mb-4 size-10 text-primary" />
            <h1 className="text-2xl font-semibold">Password updated</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sending you back to sign in.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={handleSubmit(onSubmit)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h1 className="text-2xl font-semibold">Choose a new password</h1>
            <div className="mt-6 space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">
                New Password
                <Input type="password" error={errors.password?.message} {...register('password')} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Confirm Password
                <Input type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              </label>
            </div>
            <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Reset Password
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  )
}
