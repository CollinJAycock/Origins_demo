import { Link, useLocation } from 'react-router'
import type { EventDto } from '../../api/types'
import { formatDate, formatRelativeTime, formatWeekdayAndTime } from '../../lib/dates'
import { getEventStatus } from '../../lib/eventStatus'
import type { BackState } from '../../lib/navigation'
import { Card } from '../ui/Card'
import { CapacityMeter } from './CapacityMeter'
import { DateBlock } from './DateBlock'
import { EventStatusBadge } from './EventStatusBadge'

export function EventCard({ event, now }: { event: EventDto; now: Date }) {
  const location = useLocation()
  const status = getEventStatus(event, now)
  const backState: BackState = { backTo: `${location.pathname}${location.search}` }

  return (
    <Card
      as="article"
      className="relative flex h-full flex-col p-5 transition-shadow has-[a:hover]:border-slate-300 has-[a:hover]:shadow-md"
    >
      <div className="flex gap-4">
        <DateBlock date={event.date} now={now} muted={status.kind === 'past'} />
        <div className="min-w-0 flex-1">
          <h2 className="leading-snug font-semibold break-words text-slate-900">
            {/* The link covers the whole card (via ::after), so the card is one large target. */}
            <Link
              to={`/events/${event.id}`}
              state={backState}
              className="outline-none after:absolute after:inset-0 after:rounded-xl hover:text-brand-700 focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-600"
            >
              {event.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <time dateTime={event.date}>
              <span className="sr-only">{formatDate(event.date)}, </span>
              {formatWeekdayAndTime(event.date)}
            </time>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {formatRelativeTime(event.date, now)}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm break-words text-slate-600">
        {event.description ?? <span className="text-slate-500 italic">No description</span>}
      </p>
      <CapacityMeter
        className="mt-auto pt-4"
        registeredCount={event.registeredCount}
        maxCapacity={event.maxCapacity}
        status={status}
        aside={<EventStatusBadge status={status} />}
      />
    </Card>
  )
}
