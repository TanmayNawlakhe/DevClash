import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, FolderGit2, LayoutDashboard,
  LogOut, Plus, Sparkles
} from 'lucide-react'
import { GittsuriLogo } from '../ui/Logo'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'
import { logoutUser } from '../../services/authService'

const navItems = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'analysis', to: '/analysis', label: 'New Analysis', icon: Plus },
  { key: 'repos', to: '/repos', label: 'My Repos', icon: FolderGit2 },
]

type NavItemKey = (typeof navItems)[number]['key']

export function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const location = useLocation()
  const navigate = useNavigate()

  function isNavItemActive(key: NavItemKey) {
    if (key === 'dashboard') return location.pathname === '/dashboard'
    if (key === 'analysis') return location.pathname.startsWith('/analysis')
    if (key === 'repos') return location.pathname.startsWith('/repos')
    return false
  }

  async function handleSignOut() {
    try {
      await logoutUser()
    } catch {
      // Keep local logout fallback even if Firebase request fails.
    } finally {
      logout()
      navigate('/signin')
    }
  }

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0, width: sidebarOpen ? 240 : 68 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative hidden h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-hidden border-r border-sidebar-border bg-sidebar lg:flex"
      style={{
        background: 'linear-gradient(180deg, var(--sidebar) 0%, color-mix(in oklch, var(--sidebar) 95%, var(--accent)) 100%)',
      }}
    >
      {/* Subtle noise grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
        }}
      />

      {/* Logo row */}
      <div className="relative flex h-16 items-center gap-3 px-4">
        <Link
          to="/"
          aria-label="Go to landing page"
          className={cn('flex min-w-0 items-center gap-3', !sidebarOpen && 'w-full justify-center')}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <GittsuriLogo className="size-5" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="brand-gradient-text overflow-hidden whitespace-nowrap font-heading text-xl font-bold"
              >
                Gittsurī
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="absolute right-[-10px] top-[4.56 rem] z-20 flex size-7 items-center justify-center rounded-full border border-border bg-card shadow-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {sidebarOpen ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 space-y-1 px-2.5 py-2">
        {navItems.map((item, index) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Link
              to={item.to}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200',
                isNavItemActive(item.key)
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-accent hover:text-foreground',
                !sidebarOpen && 'justify-center px-0',
              )}
            >
              {isNavItemActive(item.key) && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon
                className={cn(
                  'relative size-4.5 shrink-0 transition-colors',
                  isNavItemActive(item.key) ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-foreground',
                )}
              />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isNavItemActive(item.key) && sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative ml-auto size-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          </motion.div>
        ))}
      </nav>

      {/* Pro badge */}
{/*       {sidebarOpen && (
        <div className="mx-2.5 mb-3 rounded-xl border border-primary/20 bg-primary/6 p-3">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="size-3.5 text-primary" />
            <span className="font-medium text-primary">DevClash 2026</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-tight">
            Built with Three.js + React + AI
          </p>
        </div>
      )}
 */}
      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
          <Avatar name={user?.name ?? 'Demo User'} src={user?.avatarUrl} />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold">{user?.name ?? 'Demo User'}</p>
                <button
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => {
                    void handleSignOut()
                  }}
                >
                  <LogOut className="size-3" />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
