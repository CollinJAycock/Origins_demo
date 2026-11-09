import { cn } from '../../lib/cn'
import { getMonthAndDay } from '../../lib/dates'

interface DateBlockProps {
  date: string
  now: Date
  muted?: boolean
}

/** Calendar-page style month/day badge. Decorative: the date is also given as text nearby. */
export function DateBlock({ date, now, muted = false }: DateBlockProps) {
  const { month, day } = getMonthAndDay(date)
  // Only events outside the current year need the year to be unambiguous.
  const year = new Date(date).getFullYear()

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5',
        muted ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-brand-100 bg-brand-50 text-brand-700',
      )}
    >
      <span className="text-xs font-semibold tracking-wide uppercase">{month}</span>
      <span className={cn('text-xl leading-tight font-bold', muted ? 'text-slate-600' : 'text-slate-900')}>{day}</span>
      {year !== now.getFullYear() && <span className="text-xs font-medium">{year}</span>}
    </div>
  )
}
