import { motion } from 'framer-motion'

export function BlastRadiusOverlay({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <motion.div
        className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-destructive"
        animate={{ scale: [1, 2.5], opacity: [0.25, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
      />
    </div>
  )
}
