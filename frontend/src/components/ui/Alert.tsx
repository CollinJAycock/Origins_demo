import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AlertTone = 'error' | 'warning' | 'info'

const TONES: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  error: { className: 'border-rose-200 bg-rose-50 text-rose-800', icon: CircleAlert },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
  info: { className: 'border-slate-200 bg-slate-50 text-slate-700', icon: Info },
}

interface AlertProps {
  tone?: AlertTone
  /** Optional control on the right, e.g. a Retry button. */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** Inline message. Errors use role="alert" so they are announced when they appear. */
export function Alert({ tone = 'error', action, className, children }: AlertProps) {
  const { className: toneClassName, icon: Icon } = TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', toneClassName, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action}
    </div>
  )
}
