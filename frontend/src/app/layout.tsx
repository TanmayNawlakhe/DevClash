import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { useSocket } from '../hooks/useSocket'

function RuntimeEffects() {
  const darkMode = useUIStore((state) => state.darkMode)
  useSocket()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeEffects />
      {children}
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  )
}
