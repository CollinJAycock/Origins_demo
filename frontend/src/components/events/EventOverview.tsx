import { CalendarDays, Users } from 'lucide-react'
import type { EventDto } from '../../api/types'
import { cn } from '../../lib/cn'
import { formatEventDateTime, formatRelativeTime, getLocalTimeZone } from '../../lib/dates'
import { formatSpotsLeft, type EventStatus } from '../../lib/eventStatus'
import { Card } from '../ui/Card'
import { CapacityMeter } from './CapacityMeter'
import { EventActions } from './EventActions'
import { EventStatusBadge } from './EventStatusBadge'

interface EventOverviewProps {
  event: EventDto
  status: EventStatus
  now: Date
  className?: string
}

/** Title, schedule, capacity and description of an event, with its Edit/Delete actions. */
export function EventOverview({ event, status, now, className }: EventOverviewProps) {
  const isPast = status.kind === 'past'
  const relative = formatRelativeTime(event.date, now)

  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <EventStatusBadge status={status} />
          <h1
            tabIndex={-1}
            className="mt-2 text-2xl font-bold tracking-tight break-words text-slate-900 outline-none sm:text-3xl"
          >
            {event.title}
          </h1>
        </div>
        <EventActions event={event} isPast={isPast} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="min-w-0">
            <time dateTime={event.date} className="block font-medium text-slate-900">
              {formatEventDateTime(event.date)}
            </time>
            <span className="text-sm text-slate-500">
              {isPast ? 'Started' : 'Starts'} {relative} · {getLocalTimeZone()} time
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
          <CapacityMeter
            className="min-w-0 flex-1"
            registeredCount={event.registeredCount}
            maxCapacity={event.maxCapacity}
            status={status}
            aside={
              !isPast && (
                <span className="text-sm whitespace-nowrap text-slate-500">{formatSpotsLeft(event.availableSpots)}</span>
              )
            }
          />
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">About this event</h2>
        {event.description ? (
          <p className="mt-2 break-words whitespace-pre-line text-slate-700">{event.description}</p>
        ) : (
          <p className="mt-2 text-slate-500 italic">No description provided.</p>
        )}
      </div>
    </Card>
  )
}
