import { CalendarX, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EventDto, PagedResult } from '../../api/types'
import { cn } from '../../lib/cn'
import { toEventListQuery, type EventListSearch } from '../../lib/eventListSearch'
import { getErrorMessage } from '../../lib/serverErrors'
import { useFocusRecovery } from '../../lib/useFocusRecovery'
import { useEventList } from '../../queries/events'
import { ButtonLink } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { StaleDataAlert } from '../ui/StaleDataAlert'
import { EventCard } from './EventCard'
import { EventCardSkeleton } from './EventCardSkeleton'
import { EventsEmptyState } from './EventsEmptyState'
import { getEventsEmptyTitle } from './eventsEmptyTitle'
import { Pagination } from './Pagination'

const PAGE_SIZE = 12

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

interface EventResultsProps {
  filters: EventListSearch
  now: Date
  onClearSearch: () => void
  onSearchAll: () => void
}

/** The event grid for the current filters, with loading, error, empty and paging states. */
export function EventResults({ filters, now, onClearSearch, onSearchAll }: EventResultsProps) {
  const { status, q, page } = filters
  const { data, error, isError, isPending, isFetching, isRefetching, isPlaceholderData, refetch } = useEventList({
    status,
    search: q,
    page,
    pageSize: PAGE_SIZE,
  })
  // What shows here is replaced as results load, fail or come back empty, and the control that had
  // focus can go with it: a page link on a page that no longer exists, "Go to the last page", Retry.
  // Focus then continues from the start of what replaced it: the results, or the heading of an empty
  // or error state.
  const focusRecovery = useFocusRecovery((results) => results.querySelector<HTMLElement>('section, h2'))

  // Read out by the status region below: what the current filters found, once their results are
  // in, and empty until then. It names the filters, so it changes whenever they do, even when a
  // cached result shows at once with the same counts as the last one.
  let outcome = ''
  let content: ReactNode

  if (isPending) {
    content = <EventGridSkeleton />
  } else if (!data) {
    content = (
      <ErrorState title="Couldn't load events" message={getErrorMessage(error)} onRetry={() => void refetch()} />
    )
  } else if (isPlaceholderData && data.items.length === 0) {
    // An empty page kept from the previous filters would read as "no results" for the new ones.
    content = <EventGridSkeleton />
  } else if (data.items.length === 0 && data.totalCount === 0) {
    outcome = getEventsEmptyTitle(status, q)
    content = <EventsEmptyState status={status} search={q} onClearSearch={onClearSearch} onSearchAll={onSearchAll} />
  } else if (data.items.length === 0) {
    // A bookmarked or stale link can point past the last page.
    outcome = 'This page is empty'
    content = (
      <EmptyState
        icon={CalendarX}
        title={outcome}
        description={`There ${data.totalPages === 1 ? 'is only 1 page' : `are only ${data.totalPages} pages`} of results.`}
        action={
          <ButtonLink variant="secondary" to={{ search: toEventListQuery({ ...filters, page: data.totalPages }) }}>
            Go to the last page
          </ButtonLink>
        }
      />
    )
  } else {
    // Placeholder data still describes the previous filters.
    if (!isPlaceholderData) outcome = formatSummary(data, filters)

    content = (
      <section aria-label="Events" aria-busy={isFetching} tabIndex={-1} className="outline-none">
        <div className="mb-3 flex min-h-6 items-center justify-between gap-3 text-sm text-slate-600">
          <p>{formatSummary(data)}</p>
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex items-center gap-1.5 text-slate-500 transition-opacity',
              isFetching ? 'opacity-100' : 'opacity-0',
            )}
          >
            <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
            Updating…
          </span>
        </div>

        {isError && (
          <StaleDataAlert
            subject="the list"
            message={getErrorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
            className="mb-4"
          />
        )}

        <ul role="list" className={cn(GRID, 'transition-opacity', isPlaceholderData && 'opacity-60')}>
          {data.items.map((event) => (
            <li key={event.id}>
              <EventCard event={event} now={now} />
            </li>
          ))}
        </ul>

        {data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            pageLink={(target) => ({ search: toEventListQuery({ ...filters, page: target }) })}
          />
        )}
      </section>
    )
  }

  return (
    <>
      {/* Rendered in every state, unlike the content below, so screen readers notice its changes. */}
      <p role="status" className="sr-only">
        {outcome}
      </p>
      <div {...focusRecovery}>{content}</div>
    </>
  )
}

/** "Showing 13–24 of 30 events", or naming the filters: "Showing 13–24 of 30 past events matching “a”" */
function formatSummary(
  { page, pageSize, items, totalCount }: PagedResult<EventDto>,
  filters?: Pick<EventListSearch, 'status' | 'q'>,
): string {
  const first = (page - 1) * pageSize + 1
  const last = first + items.length - 1
  const kind = filters && filters.status !== 'all' ? `${filters.status} ` : ''
  const matching = filters?.q ? ` matching “${filters.q}”` : ''
  return `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${totalCount.toLocaleString()} ${kind}${
    totalCount === 1 ? 'event' : 'events'
  }${matching}`
}

function EventGridSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading events…</span>
      {/* Same height as the "Showing x–y of z" row, so nothing shifts when results arrive. */}
      <div className="mb-3 min-h-6" />
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
