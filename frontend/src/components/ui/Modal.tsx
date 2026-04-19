import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useId } from 'react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const descriptionId = useId()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-2xl data-[state=closed]:animate-out data-[state=open]:animate-in',
            className,
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close modal">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description id={descriptionId} className="mb-4 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
