import { UserMinus, Users } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { RegistrationDto } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatShortDateTime } from '../../lib/dates'
import { getErrorMessage } from '../../lib/serverErrors'
import { toast } from '../../lib/toast'
import { useFocusRecovery } from '../../lib/useFocusRecovery'
import { isAlreadyUnregisteredError, useRegistrations, useUnregister } from '../../queries/registrations'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Skeleton } from '../ui/Skeleton'
import { StaleDataAlert } from '../ui/StaleDataAlert'

interface AttendeeListProps {
  eventId: string
  eventTitle: string
  /** Registrations of past events are locked, so unregistering is not offered. */
  isPast: boolean
  className?: string
}

export function AttendeeList({ eventId, eventTitle, isPast, className }: AttendeeListProps) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { data: registrations, error, isPending, isRefetching, refetch } = useRegistrations(eventId)
  const unregister = useUnregister(eventId)
  // The dialog keeps showing the last attendee while it closes, so `target` outlives `isDialogOpen`.
  const [target, setTarget] = useState<RegistrationDto | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // Retry, on the error or on the out-of-date warning, goes away once the attendees have loaded, as
  // does a row that a refresh removes. Focus then moves to the heading.
  const focusRecovery = useFocusRecovery(() => headingRef.current)

  function askToUnregister(registration: RegistrationDto) {
    setTarget(registration)
    setIsDialogOpen(true)
  }

  function confirmUnregister() {
    if (!target) return
    const registration = target
    // The row disappears optimistically, so focus can't return to its button: close the dialog
    // now and park focus on the list heading instead.
    flushSync(() => setIsDialogOpen(false))
    headingRef.current?.focus()
    // Not mutate()'s callbacks: those only run for the latest call, and several unregisters can be
    // in flight at once.
    void unregister.mutateAsync(registration).then(
      () => toast.success(`${registration.name} was unregistered.`),
      (mutationError: unknown) => {
        if (isAlreadyUnregisteredError(mutationError)) toast.success(`${registration.name} was already unregistered.`)
        else toast.error(getErrorMessage(mutationError))
      },
    )
  }

  let content: ReactNode
  if (isPending) {
    content = <AttendeeListSkeleton />
  } else if (!registrations) {
    content = (
      <Alert
        className="mt-4"
        action={
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      >
        Couldn't load attendees. {getErrorMessage(error)}
      </Alert>
    )
  } else if (registrations.length === 0) {
    content = (
      <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
        <Users className="size-6 text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-slate-900">No one has registered yet</p>
        {!isPast && <p className="mt-1 text-sm text-slate-500">New registrations will appear here.</p>}
      </div>
    )
  } else {
    content = (
      <ul role="list" className="mt-2 divide-y divide-slate-100">
        {registrations.map((registration) => (
          <AttendeeRow
            key={registration.id}
            registration={registration}
            onUnregister={isPast ? undefined : askToUnregister}
          />
        ))}
      </ul>
    )
  }

  return (
    <Card as="section" aria-labelledby={headingId} className={cn('p-5 sm:p-6', className)} {...focusRecovery}>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-base font-semibold text-slate-900 outline-none"
      >
        Attendees
        {registrations && <Badge>{registrations.length.toLocaleString()}</Badge>}
      </h2>
      {isPast && <p className="mt-1 text-sm text-slate-500">Registrations for past events can't be changed.</p>}

      {registrations && error && (
        <StaleDataAlert
          subject="the attendee list"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
          className="mt-4"
        />
      )}

      {content}

      <ConfirmDialog
        open={isDialogOpen}
        title={`Unregister ${target?.name ?? 'attendee'}?`}
        confirmLabel="Unregister"
        onConfirm={confirmUnregister}
        onClose={() => setIsDialogOpen(false)}
        // While the dialog is open, a refresh can remove the row it was opened from, and the event
        // starting removes every Unregister button.
        fallbackFocusRef={headingRef}
      >
        {target && (
          <>
            {target.email} will lose their spot at “{eventTitle}”.
          </>
        )}
      </ConfirmDialog>
    </Card>
  )
}

interface AttendeeRowProps {
  registration: RegistrationDto
  onUnregister?: (registration: RegistrationDto) => void
}

function AttendeeRow({ registration, onUnregister }: AttendeeRowProps) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
      >
        {getInitials(registration.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{registration.name}</p>
        {/* Email and registration time stack on small screens and share a line from sm up. */}
        <p className="flex flex-col text-sm text-slate-500 sm:flex-row sm:gap-x-2">
          <span className="min-w-0 truncate">{registration.email}</span>
          <span className="shrink-0 text-xs sm:text-sm">
            <span aria-hidden="true" className="hidden sm:inline">
              ·{' '}
            </span>
            Registered <time dateTime={registration.registeredAt}>{formatShortDateTime(registration.registeredAt)}</time>
          </span>
        </p>
      </div>
      {onUnregister && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUnregister(registration)}
          aria-label={`Unregister ${registration.name}`}
        >
          <UserMinus aria-hidden="true" />
          <span className="hidden sm:inline">Unregister</span>
        </Button>
      )}
    </li>
  )
}

function AttendeeListSkeleton() {
  return (
    <div role="status" className="mt-2 divide-y divide-slate-100">
      <span className="sr-only">Loading attendees…</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
