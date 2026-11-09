import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title: string
  message: string
  /** Retrying puts the query back into its loading state, so the caller's skeleton takes over. */
  onRetry: () => void
}

/** Replaces content that failed to load, with a way to try again. */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-rose-200 bg-white px-6 py-14 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      {/* Focusable so focus can move here when this state replaces the control that had it. */}
      <h2 tabIndex={-1} className="mt-4 text-base font-semibold text-slate-900 outline-none">
        {title}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{message}</p>
      <Button variant="secondary" className="mt-6" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Retry
      </Button>
    </div>
  )
}
