import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NETWORK_ERROR_MESSAGE } from '../../api/client'
import type { BackState } from '../../lib/navigation'
import { eventKeys } from '../../queries/keys'
import { makeEvent, makePage } from '../../test/fixtures'
import { mockFetch, problemResponse } from '../../test/utils'
import { Toaster } from '../ui/Toaster'
import { DeleteEventButton } from './DeleteEventButton'

const workshop = makeEvent({ id: 'evt-1', title: 'Workshop' })
const pitchNight = makeEvent({ id: 'evt-2', title: 'Pitch night' })
// Two cached list pages that both show the event.
const listKeys = [
  eventKeys.list({ status: 'upcoming', search: '', page: 1, pageSize: 12 }),
  eventKeys.list({ status: 'all', search: '', page: 2, pageSize: 12 }),
]

/** The delete button on the event's page, opened from the second page of all events. */
function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(eventKeys.detail('evt-1'), workshop)
  for (const listKey of listKeys) queryClient.setQueryData(listKey, makePage([workshop, pitchNight]))
  const backState: BackState = { backTo: '/?status=all&page=2' }
  // renderWithProviders has a single route; deleting leaves the event for the list.
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Events</h1> },
      { path: '/events/:eventId', element: <DeleteEventButton event={workshop} /> },
    ],
    { initialEntries: [{ pathname: '/events/evt-1', state: backState }] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  )
  return { queryClient, router, user: userEvent.setup() }
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete “Workshop”?' })
  await user.click(within(dialog).getByRole('button', { name: 'Delete event' }))
  return dialog
}

describe('DeleteEventButton', () => {
  it('deletes the event, drops it from the cached lists and returns to the list it came from', async () => {
    const fetchSpy = mockFetch(() => new Response(null, { status: 204 }))
    const { queryClient, router, user } = renderButton()

    await confirmDelete(user)

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(router.state.location).toMatchObject({ pathname: '/', search: '?status=all&page=2' })
    // A replace, so browser Back doesn't lead to the deleted event.
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByText('“Workshop” was deleted.')).toBeInTheDocument()
    for (const listKey of listKeys) expect(queryClient.getQueryData(listKey)).toMatchObject({ items: [pitchNight] })
    expect(queryClient.getQueryData(eventKeys.detail('evt-1'))).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith('/api/events/evt-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('treats an event that was already deleted elsewhere as deleted', async () => {
    mockFetch(() => problemResponse(404, { detail: "Event 'evt-1' was not found.", code: 'event_not_found' }))
    const { queryClient, router, user } = renderButton()

    await confirmDelete(user)

    expect(await screen.findByText('“Workshop” was already deleted.')).toBeInTheDocument()
    expect(screen.queryByText(/was not found/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location).toMatchObject({ pathname: '/', search: '?status=all&page=2' })
    for (const listKey of listKeys) expect(queryClient.getQueryData(listKey)).toMatchObject({ items: [pitchNight] })
  })

  it('keeps the dialog open and shows the error when the delete fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const { queryClient, router, user } = renderButton()

    const dialog = await confirmDelete(user)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(NETWORK_ERROR_MESSAGE)
    expect(dialog).toHaveAttribute('open')
    // Ready to try again.
    expect(within(dialog).getByRole('button', { name: 'Delete event' })).not.toHaveAttribute('aria-disabled')
    expect(router.state.location.pathname).toBe('/events/evt-1')
    for (const listKey of listKeys) {
      expect(queryClient.getQueryData(listKey)).toMatchObject({ items: [workshop, pitchNight] })
    }
  })
})
