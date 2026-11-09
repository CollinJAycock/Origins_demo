import { Trash } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { EventDto } from '../../api/types'
import { getBackTo } from '../../lib/navigation'
import { getErrorMessage } from '../../lib/serverErrors'
import { toast } from '../../lib/toast'
import { useIsMounted } from '../../lib/useIsMounted'
import { useDeleteEvent } from '../../queries/events'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/**
 * Delete button with its confirmation dialog. It owns the delete mutation so that only this
 * component re-renders while the request runs.
 */
export function DeleteEventButton({ event }: { event: EventDto }) {
  const [isOpen, setIsOpen] = useState(false)
  // For a delete that settles later, whose callbacks only see the render that started it.
  const isOpenRef = useRef(false)
  const deleteEvent = useDeleteEvent()
  const navigate = useNavigate()
  const location = useLocation()
  const isMounted = useIsMounted()
  const registrations = event.registeredCount

  function open() {
    // A delete still running from an earlier opening stays on show: the dialog reports how it ends.
    if (!deleteEvent.isPending) deleteEvent.reset()
    isOpenRef.current = true
    setIsOpen(true)
  }

  function close() {
    isOpenRef.current = false
    setIsOpen(false)
  }

  function confirm() {
    // Not mutate()'s own callbacks, which are skipped once this page has gone: the user who left while the
    // request ran should still hear how it went.
    void deleteEvent.mutateAsync(event.id).then(
      ({ alreadyDeleted }) => {
        toast.success(`“${event.title}” was ${alreadyDeleted ? 'already deleted' : 'deleted'}.`)
        // Not if the user left while the request ran: that would move them a second time.
        if (isMounted()) void navigate(getBackTo(location.state), { replace: true })
      },
      (error: unknown) => {
        // The dialog shows the error and stays open for another try, unless it has gone in the meantime: the user
        // left the page, or closed the dialog (browsers let a second Escape close it even while the request runs).
        if (!isMounted() || !isOpenRef.current) {
          toast.error(`“${event.title}” wasn't deleted. ${getErrorMessage(error)}`)
        }
      },
    )
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
        onClose={close}
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
