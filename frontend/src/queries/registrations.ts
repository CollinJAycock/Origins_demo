import { queryOptions, useMutation, usePrefetchQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { createRegistration, deleteRegistration, listRegistrations } from '../api/registrations'
import type { EventDto, RegistrationDto, RegistrationInput } from '../api/types'
import { isStaleEventError } from './events'
import { eventKeys } from './keys'

const registrationsQuery = (eventId: string) =>
  queryOptions({
    queryKey: eventKeys.registrations(eventId),
    queryFn: ({ signal }) => listRegistrations(eventId, signal),
  })

export function useRegistrations(eventId: string) {
  return useQuery(registrationsQuery(eventId))
}

/**
 * Starts loading the attendees alongside the event. The list only mounts once the event has
 * loaded, so without this the two requests would run one after the other.
 */
export function usePrefetchRegistrations(eventId: string) {
  usePrefetchQuery(registrationsQuery(eventId))
}

export function useRegister(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegistrationInput) => createRegistration(eventId, input),
    onSuccess: (registration) => {
      // Registrations are ordered oldest first, so the new one goes at the end, unless a refresh that finished
      // first has already brought it in.
      queryClient.setQueryData<RegistrationDto[]>(eventKeys.registrations(eventId), (registrations) =>
        !registrations || registrations.some((item) => item.id === registration.id)
          ? registrations
          : [...registrations, registration],
      )
      // Counts, availability and "full" are computed by the server: refetch just the event.
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId), exact: true })
      void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
    },
    onError: (error) => {
      // Full, started, deleted or registered elsewhere: refresh the event so the page shows the real
      // state, and the list pages, which show the same counts.
      if (isStaleEventError(error)) {
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) })
        void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
      }
    },
  })
}

/** Removes a registration optimistically and rolls back if the server refuses. */
export function useUnregister(eventId: string) {
  const queryClient = useQueryClient()
  const mutationKey = [...eventKeys.detail(eventId), 'unregister']
  const eventKey = eventKeys.detail(eventId)
  const registrationsKey = eventKeys.registrations(eventId)

  return useMutation({
    mutationKey,
    mutationFn: (registration: RegistrationDto) => deleteRegistration(eventId, registration.id),
    onMutate: async (registration) => {
      // Make sure an in-flight refetch can't overwrite the optimistic state.
      await queryClient.cancelQueries({ queryKey: eventKey })
      queryClient.setQueryData<RegistrationDto[]>(registrationsKey, (registrations) =>
        registrations?.filter((item) => item.id !== registration.id),
      )
      queryClient.setQueryData<EventDto>(eventKey, (event) =>
        event && withRegisteredCount(event, event.registeredCount - 1),
      )
    },
    onError: (error, registration) => {
      // Already removed elsewhere, so the optimistic state is right after all.
      if (isAlreadyUnregisteredError(error)) return
      // Put back only this registration: restoring a snapshot would also undo other unregisters
      // that are still in flight.
      const registrations = queryClient.getQueryData<RegistrationDto[]>(registrationsKey)
      if (!registrations || registrations.some((item) => item.id === registration.id)) return
      queryClient.setQueryData(registrationsKey, [...registrations, registration].sort(byRegisteredAt))
      queryClient.setQueryData<EventDto>(eventKey, (event) =>
        event && withRegisteredCount(event, event.registeredCount + 1),
      )
    },
    onSettled: () => {
      // With several unregisters in flight, only the last one refetches; an earlier refetch
      // would briefly bring back rows that are still being removed.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: eventKey })
        void queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
      }
    },
  })
}

/** The registration was removed elsewhere in the meantime (e.g. in another tab). */
export function isAlreadyUnregisteredError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'registration_not_found'
}

/** The event with `count` registrations, and the spots and "full" flag that follow from it. */
function withRegisteredCount(event: EventDto, count: number): EventDto {
  const registeredCount = Math.min(Math.max(0, count), event.maxCapacity)
  const availableSpots = event.maxCapacity - registeredCount
  return { ...event, registeredCount, availableSpots, isFull: availableSpots === 0 }
}

/** The order the API lists registrations in: oldest first. */
function byRegisteredAt(a: RegistrationDto, b: RegistrationDto): number {
  return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
}
