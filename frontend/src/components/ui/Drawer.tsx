import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  side?: 'left' | 'right'
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed top-0 z-50 h-dvh w-[min(88vw,360px)] border-border bg-card p-4 shadow-2xl data-[state=closed]:animate-out data-[state=open]:animate-in',
            side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            className,
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close drawer">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
