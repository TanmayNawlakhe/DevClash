import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={`/signin?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <>{children}</>
}
