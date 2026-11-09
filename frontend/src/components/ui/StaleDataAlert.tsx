import { Alert } from './Alert'
import { Button } from './Button'

interface StaleDataAlertProps {
  /** What failed to refresh, as it reads in a sentence, e.g. "the list". */
  subject: string
  message: string
  onRetry: () => void
  retrying: boolean
  className?: string
}

/** Shown above data that stays on screen after a background refresh failed. */
export function StaleDataAlert({ subject, message, onRetry, retrying, className }: StaleDataAlertProps) {
  return (
    <Alert
      tone="warning"
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry} pending={retrying}>
          Retry
        </Button>
      }
    >
      Couldn't refresh {subject}, so it may be out of date. {message}
    </Alert>
  )
}
