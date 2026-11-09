import { CalendarClock, CalendarPlus, Plus, SearchX } from 'lucide-react'
import type { EventStatusFilter } from '../../api/types'
import { Button, ButtonLink } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { getEventsEmptyTitle } from './eventsEmptyTitle'

interface EventsEmptyStateProps {
  status: EventStatusFilter
  search: string
  onClearSearch: () => void
  onSearchAll: () => void
}

/** Explains why the list is empty and offers the most useful next step. */
export function EventsEmptyState({ status, search, onClearSearch, onSearchAll }: EventsEmptyStateProps) {
  const title = getEventsEmptyTitle(status, search)

  if (search && status !== 'all') {
    // The Upcoming or Past filter, rather than the spelling, may be what hides the matches.
    return (
      <EmptyState
        icon={SearchX}
        title={title}
        description="Try searching all events, or check the spelling."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={onSearchAll}>Search all events</Button>
            <Button variant="secondary" onClick={onClearSearch}>
              Clear search
            </Button>
          </div>
        }
      />
    )
  }

  if (search) {
    return (
      <EmptyState
        icon={SearchX}
        title={title}
        description="Check the spelling or try a different word."
        action={
          <Button variant="secondary" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    )
  }

  if (status === 'past') {
    return (
      <EmptyState
        icon={CalendarClock}
        title={title}
        description="Events show up here once they have started."
        action={
          <ButtonLink variant="secondary" to="/">
            See upcoming events
          </ButtonLink>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={CalendarPlus}
      title={title}
      description="Create an event to start taking registrations."
      action={
        <ButtonLink to="/events/new">
          <Plus aria-hidden="true" />
          Create an event
        </ButtonLink>
      }
    />
  )
}
