import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Toaster } from '../components/ui/Toaster'
import type { BackState } from '../lib/navigation'
import { eventKeys } from '../queries/keys'
import { makeEvent, makePage } from '../test/fixtures'
import { jsonResponse, mockFetch, problemResponse } from '../test/utils'
import { EditEventPage } from './EditEventPage'

const workshop = makeEvent({ id: 'evt-1', title: 'Workshop' })

/** The edit page, opened from `entries` (the last one is the edit page itself). */
function renderEditPage(entries: InitialEntry[] = ['/events/evt-1', '/events/evt-1/edit']) {
  // renderWithProviders has a single route; saving has to leave the edit page for the details page.
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Events</h1> },
      { path: '/events/:eventId', element: <h1>Details</h1> },
      { path: '/events/:eventId/edit', element: <EditEventPage /> },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  )
  return { router, queryClient, user: userEvent.setup() }
}

describe('EditEventPage', () => {
  it('returns to the page it came from after saving, without adding a history entry', async () => {
    const fetchSpy = mockFetch(({ method, body }) =>
      jsonResponse(method === 'PUT' ? { ...workshop, ...(body as object) } : workshop),
    )
    const { router, user } = renderEditPage()

    const title = await screen.findByLabelText('Title', { exact: false })
    await user.clear(title)
    await user.type(title, 'Workshop, part two')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/evt-1')
    // Back, not a replace: browser Back now leaves the event instead of showing it a second time.
    expect(router.state.historyAction).toBe('POP')
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true)
  })

  it('stays where the user went if they leave while the changes are saving', async () => {
    let respondToSave: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(({ method }) =>
      method === 'PUT'
        ? new Promise<Response>((resolve) => {
            respondToSave = resolve
          })
        : jsonResponse(workshop),
    )
    const { router, user } = renderEditPage(['/', '/events/evt-1', '/events/evt-1/edit'])

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'PUT' })),
    )
    // Browser Back while the request is in flight.
    await act(() => router.navigate(-1))
    expect(await screen.findByRole('heading', { name: 'Details' })).toBeInTheDocument()

    respondToSave(jsonResponse(workshop))

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    // Going back once more would have taken them past the event to the list.
    expect(router.state.location.pathname).toBe('/events/evt-1')
  })

  it('refreshes the cached list pages when the save is refused as out of date', async () => {
    mockFetch(({ method }) =>
      method === 'PUT'
        ? problemResponse(409, { detail: "Past events can't be edited.", code: 'event_in_past' })
        : jsonResponse(workshop),
    )
    const { queryClient, user } = renderEditPage()
    const listKey = eventKeys.list({ status: 'upcoming', search: '', page: 1, pageSize: 12 })
    queryClient.setQueryData(listKey, makePage([workshop]))

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Past events can't be edited.")
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it('links back to the list it was opened from when the event no longer exists', async () => {
    mockFetch(() => problemResponse(404, { detail: "Event 'evt-1' was not found.", code: 'event_not_found' }))
    const backState: BackState = { backTo: '/?status=past&page=2' }
    renderEditPage([{ pathname: '/events/evt-1/edit', state: backState }])

    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to events' })).toHaveAttribute('href', '/?status=past&page=2')
  })
})
