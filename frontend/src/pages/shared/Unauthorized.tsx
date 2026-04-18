import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

export function Unauthorized() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-xl">
        <h1 className="text-2xl font-semibold">Access requires a session</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue mapping repositories.</p>
        <Button asChild className="mt-6">
          <Link to="/signin">Sign In</Link>
        </Button>
      </div>
    </main>
  )
}
