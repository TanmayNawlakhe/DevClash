import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { requestPasswordReset } from '../../services/authService'

const schema = z.object({ email: z.string().email('Enter a valid email.') })

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

  async function onSubmit(values: z.infer<typeof schema>) {
    await requestPasswordReset(values.email)
    setSent(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        {sent ? (
          <div className="text-center">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" />
            </motion.div>
            <h1 className="text-2xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">A reset link is on its way.</p>
            <Button asChild className="mt-6" variant="secondary">
              <Link to="/signin">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter your email and we will send a reset link.</p>
            <label className="mt-6 block space-y-1.5 text-sm font-medium">
              Email
              <Input type="email" error={errors.email?.message} {...register('email')} />
            </label>
            <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
