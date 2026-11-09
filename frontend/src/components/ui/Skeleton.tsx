import { cn } from '../../lib/cn'

/** Placeholder block shown while content loads. Pair it with a visually hidden loading message. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-md bg-slate-200/70 motion-safe:animate-pulse', className)} />
}
