import { FolderGit2, LayoutDashboard, Plus } from 'lucide-react'
import { GittsuriLogo } from '../ui/Logo'
import { Link, useLocation } from 'react-router-dom'
import { Drawer } from '../ui/Drawer'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'

const items = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'analysis', to: '/analysis', label: 'New Analysis', icon: Plus },
  { key: 'repos', to: '/repos', label: 'My Repos', icon: FolderGit2 },
]

type NavItemKey = (typeof items)[number]['key']

export function MobileNav() {
  const open = useUIStore((state) => state.mobileNavOpen)
  const setOpen = useUIStore((state) => state.setMobileNavOpen)
  const location = useLocation()

  function isItemActive(key: NavItemKey) {
    if (key === 'dashboard') return location.pathname === '/dashboard'
    if (key === 'analysis') return location.pathname.startsWith('/analysis')
    if (key === 'repos') return location.pathname.startsWith('/repos')
    return false
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} title="Gittsurī" side="left">
      <Link to="/" onClick={() => setOpen(false)} className="mb-6 flex items-center gap-3" aria-label="Go to landing page">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GittsuriLogo className="size-4" />
        </div>
        <span className="brand-gradient-text font-serif text-xl font-bold">Gittsurī</span>
      </Link>
      <nav className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isItemActive(item.key)
                ? 'bg-primary/10 text-primary'
                : 'text-foreground/80 hover:bg-accent hover:text-foreground',
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </Drawer>
  )
}
