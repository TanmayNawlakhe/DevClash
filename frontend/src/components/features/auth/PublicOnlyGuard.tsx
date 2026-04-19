import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'

export function PublicOnlyGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)

  if (!hasHydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
