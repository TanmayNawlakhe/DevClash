import { createBrowserRouter, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const AppShell = lazy(() => import('../components/layout/AppShell').then((module) => ({ default: module.AppShell })))
const AuthGuard = lazy(() => import('../components/features/auth/AuthGuard').then((module) => ({ default: module.AuthGuard })))
const PublicOnlyGuard = lazy(() => import('../components/features/auth/PublicOnlyGuard').then((module) => ({ default: module.PublicOnlyGuard })))
const Landing = lazy(() => import('../pages/public/Landing').then((module) => ({ default: module.Landing })))
const SignIn = lazy(() => import('../pages/public/SignIn').then((module) => ({ default: module.SignIn })))
const SignUp = lazy(() => import('../pages/public/SignUp').then((module) => ({ default: module.SignUp })))
const ForgotPassword = lazy(() => import('../pages/public/ForgotPassword').then((module) => ({ default: module.ForgotPassword })))
const ResetPassword = lazy(() => import('../pages/public/ResetPassword').then((module) => ({ default: module.ResetPassword })))
const Dashboard = lazy(() => import('../pages/app/Dashboard').then((module) => ({ default: module.Dashboard })))
const RepoAnalysis = lazy(() => import('../pages/app/RepoAnalysis').then((module) => ({ default: module.RepoAnalysis })))
const RepoHistory = lazy(() => import('../pages/app/RepoHistory').then((module) => ({ default: module.RepoHistory })))
const NotFound = lazy(() => import('../pages/shared/NotFound').then((module) => ({ default: module.NotFound })))
const Unauthorized = lazy(() => import('../pages/shared/Unauthorized').then((module) => ({ default: module.Unauthorized })))

function WithSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function PublicOnlyOutlet() {
  return (
    <PublicOnlyGuard>
      <Outlet />
    </PublicOnlyGuard>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <WithSuspense><Landing /></WithSuspense> },
  {
    element: (
      <WithSuspense>
        <PublicOnlyOutlet />
      </WithSuspense>
    ),
    children: [
      { path: '/signin', element: <WithSuspense><SignIn /></WithSuspense> },
      { path: '/signup', element: <WithSuspense><SignUp /></WithSuspense> },
      { path: '/forgot-password', element: <WithSuspense><ForgotPassword /></WithSuspense> },
      { path: '/reset-password', element: <WithSuspense><ResetPassword /></WithSuspense> },
    ],
  },
  { path: '/unauthorized', element: <WithSuspense><Unauthorized /></WithSuspense> },
  {
    element: (
      <WithSuspense>
        <AuthGuard>
          <AppShell />
        </AuthGuard>
      </WithSuspense>
    ),
    children: [
      { path: '/dashboard', element: <WithSuspense><Dashboard /></WithSuspense> },
      { path: '/repos', element: <WithSuspense><RepoHistory /></WithSuspense> },
      { path: '/analysis/:repoId', element: <WithSuspense><RepoAnalysis /></WithSuspense> },
      { path: '/analysis', element: <WithSuspense><RepoAnalysis /></WithSuspense> },
    ],
  },
  { path: '*', element: <WithSuspense><NotFound /></WithSuspense> },
])
