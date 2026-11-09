import { useNavigate } from 'react-router'
import { EventForm } from '../components/events/EventForm'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageTitle } from '../components/ui/PageTitle'
import { useGoBack } from '../lib/navigation'
import { toast } from '../lib/toast'
import { useIsMounted } from '../lib/useIsMounted'
import { EMPTY_EVENT_FORM } from '../lib/validation'
import { useCreateEvent } from '../queries/events'

export function CreateEventPage() {
  const navigate = useNavigate()
  const goBack = useGoBack('/')
  const isMounted = useIsMounted()
  const createEvent = useCreateEvent()

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>New event</PageTitle>
      <PageHeader title="New event" description="Add the details people need to decide whether to attend." />
      <Card className="p-5 sm:p-6">
        <EventForm
          initialValues={EMPTY_EVENT_FORM}
          submitLabel="Create event"
          onSubmit={async (input) => {
            const event = await createEvent.mutateAsync(input)
            toast.success(`“${event.title}” was created.`)
            // Not if the user left while the request ran: that would pull them back. Replace the form
            // in the history, so "back" from the new event doesn't reopen it.
            if (isMounted()) void navigate(`/events/${event.id}`, { replace: true })
          }}
          failureSummary={(values) => `“${values.title.trim()}” wasn't created.`}
          onCancel={goBack}
        />
      </Card>
    </div>
  )
}
