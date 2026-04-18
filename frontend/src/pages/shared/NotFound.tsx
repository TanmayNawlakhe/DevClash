import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

export function NotFound() {
  return (
    <main className="dot-grid flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="text-center">
        <p className="font-mono text-8xl font-semibold text-primary">404</p>
        <h1 className="mt-4 text-3xl font-semibold">This node is not on the map.</h1>
        <p className="mt-2 text-muted-foreground">The route may have moved, or the graph never generated it.</p>
        <Button asChild className="mt-6">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    </main>
  )
}
