import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from '../api/events'
import type { EventDto, EventInput, EventListParams, PagedResult, RegistrationDto } from '../api/types'
import { isNotFoundError } from '../lib/serverErrors'
import { eventKeys } from './keys'

export function useEventList(params: EventListParams) {
  return useQuery({
    queryKey: eventKeys.list(params),
    queryFn: ({ signal }) => listEvents(params, signal),
    // Keep showing the current page while the next page or filter loads (no flash of skeletons).
    placeholderData: keepPreviousData,
  })
}

export function useEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: async ({ signal }) => {
      try {
        return await getEvent(eventId, signal)
      } catch (error) {
        // Deleted elsewhere, e.g. in another tab. The cached lists would keep offering it, and their
        // copy would show here again while the next attempt loads.
        if (isNotFoundError(error)) removeEventFromLists(queryClient, eventId)
        throw error
      }
    },
    // Opened from the list: render the list's copy immediately while the fresh copy loads.
    placeholderData: () => findEventInLists(queryClient, eventId),
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: (event) => {
      // The details page opens next: give it the event and its (necessarily empty) attendee list.
      queryClient.setQueryData<EventDto>(eventKeys.detail(event.id), event)
      queryClient.setQueryData<RegistrationDto[]>(eventKeys.registrations(event.id), [])
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
    },
  })
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventInput) => updateEvent(eventId, input),
    onSuccess: (event) => {
      queryClient.setQueryData<EventDto>(eventKeys.detail(eventId), event)
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
    },
    onError: (error) => {
      // Our copy is stale: the event was deleted, has started, or gained registrations. The list
      // pages show the same copy, so refresh them too.
      if (isStaleEventError(error)) {
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId), exact: true })
        void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
      }
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string) => {
      try {
        await deleteEvent(eventId)
        return { alreadyDeleted: false }
      } catch (error) {
        // Deleted elsewhere in the meantime (e.g. in another tab): the event is gone, as the user
        // wanted, so this ends like a successful delete.
        if (isNotFoundError(error)) return { alreadyDeleted: true }
        throw error
      }
    },
    onSuccess: (_result, eventId) => {
      queryClient.removeQueries({ queryKey: eventKeys.detail(eventId) })
      removeEventFromLists(queryClient, eventId)
    },
  })
}

/** A 404 or 409 means the cached event no longer matches the server. */
export function isStaleEventError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 409)
}

/** Drops a deleted event from the cached list pages right away, so it can't flash back while they refetch. */
function removeEventFromLists(queryClient: QueryClient, eventId: string) {
  queryClient.setQueriesData<PagedResult<EventDto>>({ queryKey: eventKeys.lists() }, (page) =>
    page ? { ...page, items: page.items.filter((event) => event.id !== eventId) } : page,
  )
  void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
}

function findEventInLists(queryClient: QueryClient, eventId: string): EventDto | undefined {
  for (const [, page] of queryClient.getQueriesData<PagedResult<EventDto>>({ queryKey: eventKeys.lists() })) {
    const event = page?.items.find((item) => item.id === eventId)
    if (event) return event
  }
  return undefined
}
