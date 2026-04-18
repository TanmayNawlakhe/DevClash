import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { ANALYSIS_STAGES } from '../../../lib/constants'
import { useRepoStore } from '../../../store/repoStore'
import { Button } from '../../ui/Button'
import { ProgressRing } from '../../ui/ProgressRing'

export function AnalysisProgress({
  canCancel = false,
  isCancelling = false,
  onCancel,
}: {
  canCancel?: boolean
  isCancelling?: boolean
  onCancel?: () => void
}) {
  const status = useRepoStore((state) => state.analysisStatus)
  const progress = useRepoStore((state) => state.analysisProgress)
  const stage = useRepoStore((state) => state.currentStage)
  const liveLog = useRepoStore((state) => state.liveLog)

  if (['complete', 'idle', 'failed', 'cancelled'].includes(status)) return null

  const currentIndex = ANALYSIS_STAGES.findIndex((item) => item.key === status)

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/72 p-6 backdrop-blur-xl">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel w-full max-w-2xl rounded-lg p-8 text-center">
        <ProgressRing progress={progress} label="analysis" />
        <h2 className="mt-6 text-2xl font-semibold">{stage}</h2>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {ANALYSIS_STAGES.map((item, index) => (
            <div key={item.key} className="text-center">
              <div className={`mx-auto h-1 rounded-full ${index <= currentIndex ? 'bg-primary' : 'bg-muted'}`} />
              <p className="mt-2 text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 max-h-36 overflow-hidden rounded-lg border border-border bg-background/70 p-3 text-left font-mono text-xs text-muted-foreground">
          {liveLog.map((line, index) => (
            <motion.div key={`${line}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {`> ${line}`}
            </motion.div>
          ))}
        </div>
        {canCancel && onCancel ? (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={onCancel} disabled={isCancelling}>
              <X className="size-4" />
              {isCancelling ? 'Cancelling...' : 'Cancel Analysis'}
            </Button>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
