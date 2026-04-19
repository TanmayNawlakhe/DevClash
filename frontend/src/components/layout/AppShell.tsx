import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { fetchRepos } from '../../services/repoService'
import { useRepoStore } from '../../store/repoStore'

export function AppShell() {
  const location = useLocation()
  const setRepos = useRepoStore((state) => state.setRepos)

  const reposQuery = useQuery({
    queryKey: ['repos'],
    queryFn: fetchRepos,
    staleTime: 15000,
  })

  useEffect(() => {
    if (reposQuery.data) {
      setRepos(reposQuery.data)
    }
  }, [reposQuery.data, setRepos])

  return (
    <div className="app-surface flex h-dvh overflow-hidden text-foreground">
      <Sidebar />
      <MobileNav />
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <Topbar />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="min-h-[calc(100dvh-4rem)]"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}
