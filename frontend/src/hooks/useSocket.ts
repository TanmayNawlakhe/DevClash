import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { connectSocket, disconnectSocket } from '../services/socketService'

export function useSocket() {
  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    if (!token) return
    connectSocket(token)
    return () => disconnectSocket()
  }, [token])
}
