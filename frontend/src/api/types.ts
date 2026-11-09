// DTOs mirroring the API contract. All date-times are ISO 8601 strings in UTC.

export interface EventDto {
  id: string
  title: string
  description: string | null
  /** Start date-time of the event. */
  date: string
  maxCapacity: number
  registeredCount: number
  availableSpots: number
  isFull: boolean
  /** True once the event has started (as of the server's clock when the response was built). */
  isPast: boolean
  createdAt: string
  updatedAt: string
}

export interface RegistrationDto {
  id: string
  eventId: string
  name: string
  email: string
  registeredAt: string
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  /** 0 when there are no items. */
  totalPages: number
}

export type EventStatusFilter = 'upcoming' | 'past' | 'all'

export interface EventListParams {
  status: EventStatusFilter
  /** Case-insensitive match on title or description; empty for no filter. */
  search: string
  page: number
  pageSize: number
}

/** Body of `POST /api/events` and `PUT /api/events/{id}`. */
export interface EventInput {
  title: string
  description: string | null
  date: string
  maxCapacity: number
}

/** Body of `POST /api/events/{id}/registrations`. */
export interface RegistrationInput {
  name: string
  email: string
}

/** RFC 9457 problem details plus the API's `code` and `traceId` extension members. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  traceId?: string
  /** Validation messages keyed by camelCase field name. */
  errors?: Record<string, string[]>
}
