import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
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
  const dialog = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Delete “Workshop”?' })
  await user.click(within(dialog).getByRole('button', { name: 'Delete event' }))
  return dialog
}

/** Holds the delete request; returns a function that fails it as an unreachable server would. */
function holdDelete() {
  let fail: (error: Error) => void = () => {}
  mockFetch(
    () =>
      new Promise<Response>((_resolve, reject) => {
        fail = reject
      }),
  )
  return () => fail(new TypeError('Failed to fetch'))
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

  it('still says the event was deleted when the user left the page meanwhile, and leaves them there', async () => {
    let respondToDelete: (response: Response) => void = () => {}
    mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          respondToDelete = resolve
        }),
    )
    const { router, user } = renderButton()

    await confirmDelete(user)
    // Browser Back, say, while the request runs.
    await act(() => router.navigate('/'))
    respondToDelete(new Response(null, { status: 204 }))

    expect(await screen.findByText('“Workshop” was deleted.')).toBeInTheDocument()
    expect(router.state.location).toMatchObject({ pathname: '/', search: '' })
  })

  it('says the delete failed when the user left the page meanwhile', async () => {
    const failDelete = holdDelete()
    const { router, user } = renderButton()

    await confirmDelete(user)
    await act(() => router.navigate('/'))
    failDelete()

    expect(await screen.findByText(`“Workshop” wasn't deleted. ${NETWORK_ERROR_MESSAGE}`)).toBeInTheDocument()
    expect(router.state.location).toMatchObject({ pathname: '/', search: '' })
  })

  it('says the delete failed when the dialog was closed while it ran', async () => {
    const failDelete = holdDelete()
    const { router, user } = renderButton()

    const dialog = await confirmDelete(user)
    // As a second Escape does in the browser. The close event follows in a later task.
    await act(async () => {
      dialog.close()
      await new Promise((resolve) => setTimeout(resolve))
    })
    failDelete()

    expect(await screen.findByText(`“Workshop” wasn't deleted. ${NETWORK_ERROR_MESSAGE}`)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/evt-1')
  })

  it('shows a delete that is still running when the dialog is opened again, and then how it ended', async () => {
    const failDelete = holdDelete()
    const { user } = renderButton()

    const dialog = await confirmDelete(user)
    await act(async () => {
      dialog.close()
      await new Promise((resolve) => setTimeout(resolve))
    })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(within(dialog).getByRole('button', { name: 'Deleting…' })).toBeInTheDocument()
    failDelete()

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(NETWORK_ERROR_MESSAGE)
    expect(screen.queryByText(/wasn't deleted/)).not.toBeInTheDocument()
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
    // Only the dialog says so.
    expect(screen.queryByText(/wasn't deleted/)).not.toBeInTheDocument()
  })
})
