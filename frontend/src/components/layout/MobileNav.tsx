import { FolderGit2, LayoutDashboard, Plus, Settings } from 'lucide-react'
import { GittsuriLogo } from '../ui/Logo'
import { NavLink } from 'react-router-dom'
import { Drawer } from '../ui/Drawer'
import { useUIStore } from '../../store/uiStore'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analysis', label: 'New Analysis', icon: Plus },
  { to: '/repos', label: 'My Repos', icon: FolderGit2 },
  { to: '/dashboard?settings=true', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const open = useUIStore((state) => state.mobileNavOpen)
  const setOpen = useUIStore((state) => state.setMobileNavOpen)

  return (
    <Drawer open={open} onOpenChange={setOpen} title="Gittsurī" side="left">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GittsuriLogo className="size-4" />
        </div>
        <span className="brand-gradient-text font-serif text-xl font-bold">Gittsurī</span>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </Drawer>
  )
}
