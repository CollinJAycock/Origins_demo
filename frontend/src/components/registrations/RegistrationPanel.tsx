import { CalendarCheck, Lock, type LucideIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import type { EventDto } from '../../api/types'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../lib/eventStatus'
import { useFocusRecovery } from '../../lib/useFocusRecovery'
import { Card } from '../ui/Card'
import { RegistrationForm } from './RegistrationForm'

interface RegistrationPanelProps {
  event: EventDto
  status: EventStatus
  className?: string
}

/** The registration form, or an explanation of why registration is closed. */
export function RegistrationPanel({ event, status, className }: RegistrationPanelProps) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The form goes away when the event fills up or starts, for one right after registering for the
  // last spot. Focus then moves to the notice that replaces it.
  const focusRecovery = useFocusRecovery((panel) => panel.querySelector<HTMLElement>('h3') ?? headingRef.current)

  return (
    <Card as="section" aria-labelledby={headingId} className={cn('p-5 sm:p-6', className)} {...focusRecovery}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-base font-semibold text-slate-900 outline-none">
        Register
      </h2>
      {status.kind === 'past' ? (
        <ClosedNotice
          icon={Lock}
          title="Registration is closed"
          message="This event has already started, so registrations can no longer change."
        />
      ) : status.kind === 'full' ? (
        <ClosedNotice
          icon={CalendarCheck}
          title="This event is full"
          message={`${
            event.maxCapacity === 1 ? 'The only spot is' : `All ${event.maxCapacity.toLocaleString()} spots are`
          } taken. A spot opens up if someone unregisters.`}
        />
      ) : (
        <>
          <p className="mt-1 mb-5 text-sm text-slate-600">Reserve a spot with a name and email address.</p>
          <RegistrationForm eventId={event.id} />
        </>
      )}
    </Card>
  )
}

function ClosedNotice({ icon: Icon, title, message }: { icon: LucideIcon; title: string; message: string }) {
  return (
    <div className="mt-4 flex gap-3 rounded-lg bg-slate-50 p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
      <div>
        <h3 tabIndex={-1} className="font-medium text-slate-900 outline-none">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  )
}
