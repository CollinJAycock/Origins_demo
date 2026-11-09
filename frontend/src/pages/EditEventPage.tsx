import { Lock } from 'lucide-react'
import { useLocation } from 'react-router'
import { EventForm } from '../components/events/EventForm'
import { EventFormSkeleton } from '../components/events/EventFormSkeleton'
import { EventQueryState } from '../components/events/EventQueryState'
import { BackLink } from '../components/ui/BackLink'
import { ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageTitle } from '../components/ui/PageTitle'
import { isEventPast } from '../lib/eventStatus'
import { useEventIdParam, useGoBack } from '../lib/navigation'
import { toast } from '../lib/toast'
import { useIsMounted } from '../lib/useIsMounted'
import { useNow } from '../lib/useNow'
import { eventToFormValues } from '../lib/validation'
import { useEvent, useUpdateEvent } from '../queries/events'

export function EditEventPage() {
  const eventId = useEventIdParam()
  const detailsPath = `/events/${eventId}`
  const location = useLocation()
  const goBack = useGoBack(detailsPath)
  const isMounted = useIsMounted()
  const now = useNow()
  const eventQuery = useEvent(eventId)
  const updateEvent = useUpdateEvent(eventId)

  return (
    <div className="mx-auto max-w-2xl">
      <EventQueryState
        query={eventQuery}
        title="Edit event"
        backLink={
          <BackLink to={detailsPath} state={location.state}>
            Back to event
          </BackLink>
        }
        skeleton={<EventFormSkeleton />}
        // Wait for the fresh copy rather than prefilling the form from a possibly stale list entry.
        waitForFreshCopy
      >
        {(event) => (
          <>
            <PageTitle>{`Edit ${event.title}`}</PageTitle>
            <div className="mt-4">
              <PageHeader title="Edit event" description={<span className="break-words">{event.title}</span>} />
            </div>
            {isEventPast(event, now) ? (
              <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:p-6">
                <Lock className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="flex-1">
                  <h2 className="font-semibold text-slate-900">Past events can't be edited</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This event has already started, so its details are locked.
                  </p>
                </div>
                <ButtonLink variant="secondary" to={detailsPath} state={location.state}>
                  View event
                </ButtonLink>
              </Card>
            ) : (
              <Card className="p-5 sm:p-6">
                <EventForm
                  key={event.id}
                  initialValues={eventToFormValues(event)}
                  originalDate={event.date}
                  registeredCount={event.registeredCount}
                  submitLabel="Save changes"
                  onSubmit={async (input) => {
                    await updateEvent.mutateAsync(input)
                    toast.success('Changes saved.')
                    // Not if the user left while the request ran: going back from where they are now
                    // would take them one step too far.
                    if (isMounted()) goBack()
                  }}
                  failureSummary={() => `Changes to “${event.title}” weren't saved.`}
                  onCancel={goBack}
                />
              </Card>
            )}
          </>
        )}
      </EventQueryState>
    </div>
  )
}
