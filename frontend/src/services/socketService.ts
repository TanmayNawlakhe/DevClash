import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string) => {
  socket = io(import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? '', {
    auth: { token },
    transports: ['websocket'],
    autoConnect: Boolean(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL),
  })
  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

export const joinRepoRoom = (repoId: string) => {
  socket?.emit('join', { room: `repo:${repoId}` })
}

export const onAnalysisProgress = (
  callback: (data: { stage: string; percent: number; current_file: string }) => void,
) => {
  socket?.on('analysis:progress', callback)
}

export const onGraphReady = (callback: (data: { node_count: number; edge_count: number }) => void) => {
  socket?.on('analysis:graph_ready', callback)
}

export const onSummaryBatch = (callback: (data: { file_ids: string[]; summaries: Record<string, string> }) => void) => {
  socket?.on('ai:summary_batch', callback)
}

export const onAnalysisComplete = (callback: (data: { repo_id: string }) => void) => {
  socket?.on('analysis:complete', callback)
}

export const onOwnershipReady = (callback: (data: { repo_id: string }) => void) => {
  socket?.on('ownership:ready', callback)
}

export const onPriorityReady = (callback: (data: { repo_id: string }) => void) => {
  socket?.on('priority:ready', callback)
}

export const onError = (callback: (data: { message: string }) => void) => {
  socket?.on('analysis:error', callback)
}
