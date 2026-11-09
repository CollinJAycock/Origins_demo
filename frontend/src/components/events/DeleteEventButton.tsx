import { Trash } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { EventDto } from '../../api/types'
import { getBackTo } from '../../lib/navigation'
import { getErrorMessage } from '../../lib/serverErrors'
import { toast } from '../../lib/toast'
import { useDeleteEvent } from '../../queries/events'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/**
 * Delete button with its confirmation dialog. It owns the delete mutation so that only this
 * component re-renders while the request runs.
 */
export function DeleteEventButton({ event }: { event: EventDto }) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteEvent = useDeleteEvent()
  const navigate = useNavigate()
  const location = useLocation()
  const registrations = event.registeredCount

  function open() {
    deleteEvent.reset()
    setIsOpen(true)
  }

  function confirm() {
    deleteEvent.mutate(event.id, {
      onSuccess: ({ alreadyDeleted }) => {
        toast.success(`“${event.title}” was ${alreadyDeleted ? 'already deleted' : 'deleted'}.`)
        void navigate(getBackTo(location.state), { replace: true })
      },
    })
  }

  return (
    <>
      <Button variant="danger-secondary" onClick={open}>
        <Trash aria-hidden="true" />
        Delete
      </Button>
      <ConfirmDialog
        open={isOpen}
        title={`Delete “${event.title}”?`}
        confirmLabel="Delete event"
        pendingLabel="Deleting…"
        isPending={deleteEvent.isPending}
        error={deleteEvent.isError ? getErrorMessage(deleteEvent.error) : undefined}
        onConfirm={confirm}
        onClose={() => setIsOpen(false)}
      >
        {registrations > 0
          ? `This permanently deletes the event and removes its ${registrations.toLocaleString()} ${
              registrations === 1 ? 'registration' : 'registrations'
            }. This can't be undone.`
          : "This permanently deletes the event. This can't be undone."}
      </ConfirmDialog>
    </>
  )
}
