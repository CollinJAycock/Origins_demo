import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

/**
 * Router state carried from the events list to the pages behind it, so "back" links return to
 * the list with the same filters, search and page.
 */
export interface BackState {
  backTo: string
}

export function getBackTo(state: unknown, fallback = '/'): string {
  if (typeof state === 'object' && state !== null && 'backTo' in state && typeof state.backTo === 'string') {
    return state.backTo
  }
  return fallback
}

/** Goes back one history entry, or to `fallback` when the app was opened directly on this page. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    // The router gives the very first history entry of the session the key "default".
    if (location.key === 'default') void navigate(fallback, { replace: true })
    else void navigate(-1)
  }, [fallback, location.key, navigate])
}

/** The `:eventId` route parameter (always present on the routes that use this hook). */
export function useEventIdParam(): string {
  const { eventId } = useParams()
  if (!eventId) throw new Error('This route requires an :eventId parameter.')
  return eventId
}
