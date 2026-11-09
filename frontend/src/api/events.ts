import { requestJson, requestVoid } from './client'
import type { EventDto, EventInput, EventListParams, PagedResult } from './types'

export const eventPath = (eventId: string) => `/api/events/${encodeURIComponent(eventId)}`

export function listEvents({ status, search, page, pageSize }: EventListParams, signal?: AbortSignal) {
  return requestJson<PagedResult<EventDto>>('/api/events', {
    query: { status, search, page, pageSize },
    signal,
  })
}

export function getEvent(eventId: string, signal?: AbortSignal) {
  return requestJson<EventDto>(eventPath(eventId), { signal })
}

export function createEvent(input: EventInput) {
  return requestJson<EventDto>('/api/events', { method: 'POST', body: input })
}

export function updateEvent(eventId: string, input: EventInput) {
  return requestJson<EventDto>(eventPath(eventId), { method: 'PUT', body: input })
}

export function deleteEvent(eventId: string) {
  return requestVoid(eventPath(eventId), { method: 'DELETE' })
}
