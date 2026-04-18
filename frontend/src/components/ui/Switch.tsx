import * as SwitchPrimitive from '@radix-ui/react-switch'

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label ? <span>{label}</span> : null}
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-5 w-9 rounded-full bg-muted transition data-[state=checked]:bg-primary"
      >
        <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-card shadow transition data-[state=checked]:translate-x-4" />
      </SwitchPrimitive.Root>
    </label>
  )
}
