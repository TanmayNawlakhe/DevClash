import * as TabsPrimitive from '@radix-ui/react-tabs'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

export function Tabs({
  value,
  onValueChange,
  tabs,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  tabs: Array<{ value: string; label: string; content: React.ReactNode }>
  className?: string
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List className="grid rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn('relative rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition data-[state=active]:text-foreground')}
          >
            {value === tab.value ? <motion.span layoutId="tab-indicator" className="absolute inset-0 rounded-md bg-card shadow-sm" /> : null}
            <span className="relative">{tab.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content key={tab.value} value={tab.value} className="mt-4">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
