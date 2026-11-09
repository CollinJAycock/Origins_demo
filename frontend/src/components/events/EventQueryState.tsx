import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { EventDto } from '../../api/types'
import { getBackTo } from '../../lib/navigation'
import { getErrorMessage, isNotFoundError } from '../../lib/serverErrors'
import { useFocusRecovery } from '../../lib/useFocusRecovery'
import { ErrorState } from '../ui/ErrorState'
import { PageTitle } from '../ui/PageTitle'
import { StaleDataAlert } from '../ui/StaleDataAlert'
import { EventNotFound } from './EventNotFound'

interface EventQueryStateProps {
  /** The page's `useEvent` result. */
  query: UseQueryResult<EventDto>
  /** Document title until the event has loaded; from then on the page sets its own. */
  title: string
  /** Shown above the skeleton, the error and the event. */
  backLink: ReactNode
  skeleton: ReactNode
  /** Keep showing the skeleton, rather than the list's copy of the event, until the fresh copy arrives. */
  waitForFreshCopy?: boolean
  children: (event: EventDto) => ReactNode
}

/**
 * The states shared by the pages about one event: not found (with a way back to the list the user
 * came from), loading, and failed to load. Once the event is shown, a failed background refresh
 * adds a warning that it may be out of date.
 */
export function EventQueryState({
  query,
  title,
  backLink,
  skeleton,
  waitForFreshCopy = false,
  children,
}: EventQueryStateProps) {
  const backTo = getBackTo(useLocation().state)
  const { data: event, error, isPending, isPlaceholderData, isRefetching, refetch } = query
  // Retry, on the error or on the out-of-date warning, goes away once the event has loaded. Focus
  // then moves to the page's heading (or the error's, if it fails again).
  const focusRecovery = useFocusRecovery((page) => page.querySelector<HTMLElement>('h1, h2'))

  // The back link comes first in every state that has one, so it stays mounted, and keeps focus,
  // as they change. PageTitle renders into <head>, so its place doesn't matter.
  let content: ReactNode
  if (isNotFoundError(error)) {
    content = <EventNotFound backTo={backTo} />
  } else if (isPending || (waitForFreshCopy && isPlaceholderData)) {
    content = (
      <>
        {backLink}
        <PageTitle>{title}</PageTitle>
        {skeleton}
      </>
    )
  } else if (!event) {
    content = (
      <>
        {backLink}
        <PageTitle>{title}</PageTitle>
        <div className="mt-4">
          <ErrorState title="Couldn't load this event" message={getErrorMessage(error)} onRetry={() => void refetch()} />
        </div>
      </>
    )
  } else {
    content = (
      <>
        {backLink}
        {error && (
          <StaleDataAlert
            subject="this event"
            message={getErrorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
            className="mt-4"
          />
        )}
        {children(event)}
      </>
    )
  }

  return <div {...focusRecovery}>{content}</div>
}
