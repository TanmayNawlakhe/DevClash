import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronRight, Menu, Search } from 'lucide-react'
import { GittsuriLogo } from '../ui/Logo'
import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import * as DropdownMenu from '../ui/DropdownMenu'
import { StatusBadge } from '../ui/Badge'
import { useAuthStore } from '../../store/authStore'
import { useRepoStore } from '../../store/repoStore'
import { useUIStore } from '../../store/uiStore'
import { logoutUser } from '../../services/authService'

export function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const currentRepo = useRepoStore((state) => state.currentRepo)
  const status = useRepoStore((state) => state.analysisStatus)
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen)
  const [searchOpen, setSearchOpen] = useState(false)

  const crumbs = breadcrumb(location.pathname)
  const isAnalysis = location.pathname.startsWith('/analysis')

  function handleRepoSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchOpen ? event.currentTarget.search.value.trim() : ''
    const target = query ? `/repos?search=${encodeURIComponent(query)}` : '/repos'
    navigate(target)
    setSearchOpen(false)
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 sm:px-5 lg:px-8 backdrop-blur-xl">
      {/* Mobile menu */}
      <Button
        className="lg:hidden"
        variant="ghost"
        size="icon"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      {/* Logo (mobile) */}
      <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Go to landing page">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GittsuriLogo className="size-3.5" />
        </span>
        <span className="brand-gradient-text font-heading text-base font-bold">Gittsurī</span>
      </Link>

      {/* Breadcrumb */}
      <div className="hidden min-w-0 flex-1 lg:block">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3 shrink-0" />}
              <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : ''}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
        {isAnalysis && currentRepo ? (
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate font-mono text-sm font-semibold">
              {currentRepo.owner}/{currentRepo.name}
            </span>
            <StatusBadge status={status} />
          </div>
        ) : null}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1">
        {/* Search button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Search"
          className="relative hidden md:inline-flex"
        >
          <Search className="size-4" />
        </Button>

        {/* Search bar (expandable) */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleRepoSearch}>
                <input
                  autoFocus
                  name="search"
                  placeholder="Search repos..."
                  onBlur={() => setSearchOpen(false)}
                  className="h-9 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications */}
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background"
          />
        </Button>

        {/* Avatar dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="ml-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-transform hover:scale-105">
              <Avatar name={user?.name ?? 'Demo User'} src={user?.avatarUrl} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-52 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl shadow-primary/8 text-sm"
            >
              <div className="border-b border-border px-3 py-2.5 mb-1">
                <p className="font-semibold">{user?.name ?? 'Demo User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'avery@gittsuri.dev'}</p>
              </div>
              <DropdownMenu.Item className="rounded-xl px-3 py-2 outline-none transition-colors hover:bg-accent cursor-pointer">
                Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item className="rounded-xl px-3 py-2 outline-none transition-colors hover:bg-accent cursor-pointer">
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="rounded-xl px-3 py-2 outline-none text-destructive transition-colors hover:bg-destructive/8 cursor-pointer"
                onSelect={() => {
                  void handleSignOut()
                }}
              >
                Sign Out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}

function breadcrumb(pathname: string) {
  if (pathname.startsWith('/analysis')) return ['Home', 'Repos', 'Architecture Map']
  if (pathname.startsWith('/repos')) return ['Home', 'Repositories']
  if (pathname.startsWith('/dashboard')) return ['Home', 'Dashboard']
  return ['Home']
}
