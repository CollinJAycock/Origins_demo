import { Pencil } from 'lucide-react'
import { useId } from 'react'
import { useLocation } from 'react-router'
import type { EventDto } from '../../api/types'
import { Button, ButtonLink } from '../ui/Button'
import { DeleteEventButton } from './DeleteEventButton'

export function EventActions({ event, isPast }: { event: EventDto; isPast: boolean }) {
  const location = useLocation()
  const reasonId = useId()

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
      <div className="flex gap-2">
        {isPast ? (
          <Button variant="secondary" disabled aria-describedby={reasonId}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        ) : (
          // Pass the list location along so "back" links keep working after editing.
          <ButtonLink variant="secondary" to={`/events/${event.id}/edit`} state={location.state}>
            <Pencil aria-hidden="true" />
            Edit
          </ButtonLink>
        )}
        <DeleteEventButton event={event} />
      </div>
      {isPast && (
        <p id={reasonId} className="text-xs text-slate-500">
          Past events can't be edited.
        </p>
      )}
    </div>
  )
}
