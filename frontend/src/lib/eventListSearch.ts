import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import type { EventStatusFilter } from '../api/types'

/** List filters as they appear in the URL: `?status=&q=&page=`. */
export interface EventListSearch {
  status: EventStatusFilter
  q: string
  page: number
}

const STATUSES: readonly EventStatusFilter[] = ['upcoming', 'past', 'all']
export const DEFAULT_STATUS: EventStatusFilter = 'upcoming'
/** The API rejects longer search terms. */
export const SEARCH_MAX_LENGTH = 100
/** The API's page numbers are 32-bit integers; a larger one in the URL is a 400. */
const MAX_PAGE = 2_147_483_647

/** Reads list filters from the URL, falling back to defaults for missing or invalid values. */
export function parseEventListSearch(params: URLSearchParams): EventListSearch {
  const rawStatus = params.get('status')?.toLowerCase()
  const page = Number(params.get('page'))
  return {
    status: STATUSES.find((status) => status === rawStatus) ?? DEFAULT_STATUS,
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH),
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  }
}

/** Builds the query string for list filters, leaving out defaults so URLs stay short. */
export function toEventListQuery({ status, q, page }: EventListSearch): string {
  const params = new URLSearchParams()
  if (status !== DEFAULT_STATUS) params.set('status', status)
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** List filters backed by the URL, so refresh, back/forward and shared links all work. */
export function useEventListSearch() {
  const [searchParams, setSearchParams] = useSearchParams()

  const update = useCallback(
    (changes: Partial<EventListSearch>, { replace = false }: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => new URLSearchParams(toEventListQuery({ ...parseEventListSearch(current), ...changes })),
        { replace, preventScrollReset: true },
      )
    },
    [setSearchParams],
  )

  return { ...parseEventListSearch(searchParams), update }
}
