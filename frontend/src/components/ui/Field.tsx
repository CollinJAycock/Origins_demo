import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Accessibility attributes the field passes to its control. */
export interface FieldControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

interface FieldProps {
  label: string
  /** Adds "(optional)" to the label; fields are required unless marked. */
  optional?: boolean
  hint?: ReactNode
  error?: string
  /** Shown opposite the label, e.g. a character counter. */
  aside?: ReactNode
  children: (control: FieldControlProps) => ReactNode
}

/** Label, hint and error message wired to a form control via id / aria-describedby. */
export function Field({ label, optional = false, hint, error, aside, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
          {optional && <span className="font-normal text-slate-500"> (optional)</span>}
        </label>
        {aside}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {/* Server messages can quote long input, e.g. an email address: let it wrap. */}
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}

export function CharacterCount({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn('text-xs tabular-nums', length > max ? 'font-medium text-rose-700' : 'text-slate-500')}>
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  )
}
