import type { EventListParams } from '../api/types'

/**
 * Query keys, organised so related data can be targeted by prefix: `lists()` matches every list
 * page, and `detail(id)` matches an event together with its registrations.
 */
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (params: EventListParams) => [...eventKeys.lists(), params] as const,
  detail: (eventId: string) => [...eventKeys.all, 'detail', eventId] as const,
  registrations: (eventId: string) => [...eventKeys.detail(eventId), 'registrations'] as const,
}
