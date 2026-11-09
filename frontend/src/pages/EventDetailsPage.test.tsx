import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NETWORK_ERROR_MESSAGE } from '../api/client'
import type { EventDto, PagedResult } from '../api/types'
import type { BackState } from '../lib/navigation'
import { eventKeys } from '../queries/keys'
import { makeEvent, makePage, makeRegistration } from '../test/fixtures'
import { jsonResponse, mockFetch, problemResponse, renderWithProviders } from '../test/utils'
import { EventDetailsPage } from './EventDetailsPage'

const workshop = makeEvent({ id: 'evt-1', title: 'Workshop', description: 'Bring a laptop.' })
const ada = makeRegistration({ id: 'reg-1', name: 'Ada Lovelace' })
const grace = makeRegistration({ id: 'reg-2', name: 'Grace Hopper' })

/** Serves the attendees, and the event while `eventAvailable()` is true (a network failure otherwise). */
function mockApi(eventAvailable: () => boolean = () => true) {
  return mockFetch(({ url }) => {
    if (url.pathname.endsWith('/registrations')) return jsonResponse([ada, grace])
    return eventAvailable() ? jsonResponse(workshop) : Promise.reject(new TypeError('Failed to fetch'))
  })
}

function renderPage() {
  return renderWithProviders(<EventDetailsPage />, { path: '/events/:eventId', route: '/events/evt-1' })
}

describe('EventDetailsPage', () => {
  it('shows the event with its attendees', async () => {
    mockApi()
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Workshop' })).toBeInTheDocument()
    expect(screen.getByText('Bring a laptop.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All events' })).toHaveAttribute('href', '/')
  })

  it('links back to the list it was opened from when the event does not exist, with focus on the message', async () => {
    mockFetch(() => problemResponse(404, { detail: "Event 'evt-1' was not found.", code: 'event_not_found' }))
    const backState: BackState = { backTo: '/?status=past&page=2' }
    // renderWithProviders can't open a route with router state.
    const router = createMemoryRouter([{ path: '/events/:eventId', element: <EventDetailsPage /> }], {
      initialEntries: [{ pathname: '/events/evt-1', state: backState }],
    })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    // Nothing had focus while the event loaded, so the message itself takes it.
    expect(await screen.findByRole('heading', { name: 'Event not found' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Back to events' })).toHaveAttribute('href', '/?status=past&page=2')
  })

  it('drops an event deleted elsewhere from the cached lists, and keeps focus on the page', async () => {
    let respondWithEvent: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(({ url }) =>
      url.pathname.endsWith('/registrations')
        ? jsonResponse([])
        : new Promise<Response>((resolve) => {
            respondWithEvent = resolve
          }),
    )
    // Opened from a list fetched moments ago, which still has the event.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = eventKeys.list({ status: 'upcoming', search: '', page: 1, pageSize: 12 })
    queryClient.setQueryData(listKey, makePage([workshop]))
    const router = createMemoryRouter([{ path: '/events/:eventId', element: <EventDetailsPage /> }], {
      initialEntries: ['/events/evt-1'],
    })
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    // The list's copy shows while the event loads, with focus on its heading as after any navigation.
    const listCopyHeading = await screen.findByRole('heading', { level: 1, name: 'Workshop' })
    listCopyHeading.focus()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/events/evt-1', expect.anything()))
    respondWithEvent(problemResponse(404, { detail: "Event 'evt-1' was not found.", code: 'event_not_found' }))

    expect(await screen.findByRole('heading', { name: 'Event not found' })).toHaveFocus()
    expect(queryClient.getQueryData<PagedResult<EventDto>>(listKey)?.items).toEqual([])
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it('offers a retry when the event fails to load', async () => {
    let available = false
    mockApi(() => available)
    const { user } = renderPage()

    expect(await screen.findByRole('heading', { name: "Couldn't load this event" })).toBeInTheDocument()
    expect(screen.getByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument()

    available = true
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Workshop' })).toBeInTheDocument()
    // Retry went with the error, so focus moves to the event's heading.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workshop' })).toHaveFocus())
  })

  it('moves focus to the error when the retry fails too', async () => {
    let failRetry: (error: Error) => void = () => {}
    let eventRequests = 0
    mockFetch(({ url }) => {
      if (url.pathname.endsWith('/registrations')) return jsonResponse([])
      eventRequests += 1
      return eventRequests === 1
        ? Promise.reject(new TypeError('Failed to fetch'))
        : new Promise<Response>((_, reject) => {
            failRetry = reject
          })
    })
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    // Retry went with the error, and the skeleton has nothing to take focus.
    expect(await screen.findByText('Loading event…')).toBeInTheDocument()
    expect(document.body).toHaveFocus()
    failRetry(new TypeError('Failed to fetch'))

    await waitFor(() => expect(screen.getByRole('heading', { name: "Couldn't load this event" })).toHaveFocus())
  })

  it.each<[string, string, (resolve: (response: Response) => void, reject: (error: Error) => void) => void]>([
    ['finishes loading', 'Workshop', (resolve) => resolve(jsonResponse(workshop))],
    ['fails to load', "Couldn't load this event", (_, reject) => reject(new TypeError('Failed to fetch'))],
  ])('keeps focus on the back link when the event %s', async (_, heading, settle) => {
    let settleRequest = () => {}
    const fetchSpy = mockFetch(({ url }) =>
      url.pathname.endsWith('/registrations')
        ? jsonResponse([])
        : new Promise<Response>((resolve, reject) => {
            settleRequest = () => settle(resolve, reject)
          }),
    )
    renderPage()
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/events/evt-1', expect.anything()))
    const backLink = screen.getByRole('link', { name: 'All events' })
    act(() => backLink.focus())

    settleRequest()

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(backLink).toHaveFocus()
  })

  it('keeps showing the event, with a warning, when a refresh fails', async () => {
    let available = true
    mockApi(() => available)
    const { user, queryClient } = renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Workshop' })

    available = false
    await act(() => queryClient.refetchQueries({ queryKey: eventKeys.detail('evt-1'), exact: true }))

    expect(await screen.findByText(/Couldn't refresh this event, so it may be out of date\./)).toHaveTextContent(
      NETWORK_ERROR_MESSAGE,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Workshop' })).toBeInTheDocument()

    available = true
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.queryByText(/Couldn't refresh this event/)).not.toBeInTheDocument())
    // Retry went with the warning, so focus moves to the event's heading.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workshop' })).toHaveFocus())
  })

  it('moves focus to the notice that replaces the form after registering for the last spot', async () => {
    let event = makeEvent({ id: 'evt-1', title: 'Workshop', maxCapacity: 1, registeredCount: 0 })
    mockFetch(({ method, url }) => {
      if (!url.pathname.endsWith('/registrations')) return jsonResponse(event)
      if (method !== 'POST') return jsonResponse([])
      event = makeEvent({ id: 'evt-1', title: 'Workshop', maxCapacity: 1, registeredCount: 1 })
      return jsonResponse(makeRegistration({ name: 'Grace Hopper', email: 'grace@example.com' }), 201)
    })
    const { user } = renderPage()

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'This event is full' })).toHaveFocus())
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
  })
})
