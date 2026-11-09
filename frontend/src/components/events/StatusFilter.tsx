import { useId } from 'react'
import type { EventStatusFilter } from '../../api/types'

const OPTIONS: ReadonlyArray<{ value: EventStatusFilter; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

interface StatusFilterProps {
  value: EventStatusFilter
  onChange: (value: EventStatusFilter) => void
}

/** Segmented control built from native radio buttons (arrow keys move between options). */
export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const name = useId()
  return (
    <fieldset>
      <legend className="sr-only">Show events</legend>
      <div className="flex rounded-lg bg-slate-200/70 p-1">
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex-1 sm:flex-none">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block cursor-pointer rounded-md px-4 py-1.5 text-center text-sm font-medium text-slate-600 transition-colors peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-brand-600 hover:text-slate-900">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
