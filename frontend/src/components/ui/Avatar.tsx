import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, initials } from '../../lib/utils'

export function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  return (
    <AvatarPrimitive.Root className={cn('inline-flex size-9 items-center justify-center overflow-hidden rounded-lg bg-accent text-accent-foreground', className)}>
      <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
      <AvatarPrimitive.Fallback className="font-mono text-xs">{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
