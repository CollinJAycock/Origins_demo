import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent, { type Options as UserEventOptions } from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'

interface RenderOptions {
  path?: string
  route?: string
  /** For the returned `user`, e.g. `advanceTimers` in a test with fake timers. */
  userOptions?: UserEventOptions
}

/** Renders `ui` at `path` with a fresh query client (no retries) and an in-memory router. */
export function renderWithProviders(ui: ReactElement, { path = '/', route = path, userOptions }: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] })
  return {
    user: userEvent.setup(userOptions),
    queryClient,
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}

type FetchHandler = (request: { method: string; url: URL; body: unknown }) => Response | Promise<Response>

/** Replaces `fetch` with a handler that sees the method, the parsed URL and the JSON body. */
export function mockFetch(handler: FetchHandler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost')
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    return handler({ method: init?.method ?? 'GET', url, body })
  })
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function problemResponse(status: number, problem: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ status, traceId: '00-test', ...problem }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
