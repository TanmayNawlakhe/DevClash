import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | string) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return new Intl.NumberFormat('en-US').format(numeric)
}

export function truncatePath(path: string, max = 42) {
  if (path.length <= max) return path
  const parts = path.split('/')
  const fileName = parts.at(-1) ?? path
  const prefix = parts.slice(0, 2).join('/')
  const candidate = `${prefix}/.../${fileName}`
  return candidate.length <= max ? candidate : `.../${fileName}`
}

export function fileName(path: string) {
  return path.split('/').at(-1) ?? path
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
