import type { EventStatusFilter } from '../../api/types'

/**
 * Title of the empty events list, e.g. "No upcoming events match “zzz”". Shared by the empty state
 * and the status message that announces it.
 */
export function getEventsEmptyTitle(status: EventStatusFilter, search: string): string {
  if (search) return status === 'all' ? `No events match “${search}”` : `No ${status} events match “${search}”`
  if (status === 'past') return 'No past events'
  return status === 'upcoming' ? 'No upcoming events' : 'No events yet'
}
