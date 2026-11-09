import { useLocation } from 'react-router'
import type { EventDto } from '../api/types'
import { EventDetailsSkeleton } from '../components/events/EventDetailsSkeleton'
import { EventOverview } from '../components/events/EventOverview'
import { EventQueryState } from '../components/events/EventQueryState'
import { AttendeeList } from '../components/registrations/AttendeeList'
import { RegistrationPanel } from '../components/registrations/RegistrationPanel'
import { BackLink } from '../components/ui/BackLink'
import { PageTitle } from '../components/ui/PageTitle'
import { getEventStatus } from '../lib/eventStatus'
import { getBackTo, useEventIdParam } from '../lib/navigation'
import { useNow } from '../lib/useNow'
import { useEvent } from '../queries/events'
import { usePrefetchRegistrations } from '../queries/registrations'

export function EventDetailsPage() {
  const eventId = useEventIdParam()
  const backTo = getBackTo(useLocation().state)
  const now = useNow()
  const eventQuery = useEvent(eventId)
  usePrefetchRegistrations(eventId)

  return (
    <EventQueryState
      query={eventQuery}
      title="Event"
      backLink={<BackLink to={backTo}>All events</BackLink>}
      skeleton={<EventDetailsSkeleton />}
    >
      {(event) => <EventDetails event={event} now={now} />}
    </EventQueryState>
  )
}

function EventDetails({ event, now }: { event: EventDto; now: Date }) {
  const status = getEventStatus(event, now)

  return (
    <>
      <PageTitle>{event.title}</PageTitle>
      {/* One column on small screens (details, register, attendees); the form sits in a sticky
          side column on large screens. Keyed so form state never carries over to another event. */}
      <div key={event.id} className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <EventOverview event={event} status={status} now={now} className="lg:col-span-2" />
        <RegistrationPanel
          event={event}
          status={status}
          className="lg:sticky lg:top-24 lg:col-start-3 lg:row-span-2 lg:row-start-1"
        />
        <AttendeeList
          eventId={event.id}
          eventTitle={event.title}
          isPast={status.kind === 'past'}
          className="lg:col-span-2"
        />
      </div>
    </>
  )
}
