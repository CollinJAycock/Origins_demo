import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'

const MAX_RETRIES = 2

/** Client errors (4xx) will fail the same way again; network errors and 5xx get two more tries. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < MAX_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Events change rarely and every mutation updates the cache, so brief caching is safe.
        staleTime: 30_000,
        retry: shouldRetry,
      },
    },
  })
}
