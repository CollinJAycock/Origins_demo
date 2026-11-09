import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { formatRegistrations, getFillPercent, type EventStatus } from '../../lib/eventStatus'

const BAR_COLORS: Record<EventStatus['kind'], string> = {
  past: 'bg-slate-400',
  full: 'bg-rose-500',
  filling: 'bg-amber-500',
  open: 'bg-brand-500',
}

interface CapacityMeterProps {
  registeredCount: number
  maxCapacity: number
  status: EventStatus
  /** Shown opposite the "18 / 30 registered" label. */
  aside?: ReactNode
  className?: string
}

/** Registrations against capacity. The bar is decorative; the label carries the numbers. */
export function CapacityMeter({ registeredCount, maxCapacity, status, aside, className }: CapacityMeterProps) {
  return (
    <div className={className}>
      {/* When space runs out, the aside moves to its own line instead of either text breaking mid-phrase. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium whitespace-nowrap text-slate-700">
          {formatRegistrations(registeredCount, maxCapacity)}
        </span>
        {aside}
      </div>
      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300', BAR_COLORS[status.kind])}
          style={{ width: `${getFillPercent(registeredCount, maxCapacity)}%` }}
        />
      </div>
    </div>
  )
}
