import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Toaster } from '../components/ui/Toaster'
import { toDateTimeLocalValue } from '../lib/dates'
import { createQueryClient } from '../queries/queryClient'
import { makeEvent } from '../test/fixtures'
import { jsonResponse, mockFetch } from '../test/utils'
import { CreateEventPage } from './CreateEventPage'
import { EventDetailsPage } from './EventDetailsPage'

const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
nextWeek.setSeconds(0, 0)

const created = makeEvent({
  id: 'evt-new',
  title: 'Team offsite',
  description: null,
  date: nextWeek.toISOString(),
  maxCapacity: 40,
  registeredCount: 0,
})

/** The create page, opened from the list, with the details page it leads to. */
function renderCreatePage() {
  // The app's query defaults: whether the new event's page refetches depends on their staleTime.
  const queryClient = createQueryClient()
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Events</h1> },
      { path: '/events/new', element: <CreateEventPage /> },
      { path: '/events/:eventId', element: <EventDetailsPage /> },
    ],
    { initialEntries: ['/', '/events/new'], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  )
  return { router, user: userEvent.setup() }
}

async function createTeamOffsite(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Title', { exact: false }), 'Team offsite')
  fireEvent.change(screen.getByLabelText('Date and time', { exact: false }), {
    target: { value: toDateTimeLocalValue(nextWeek) },
  })
  await user.type(screen.getByLabelText('Max capacity', { exact: false }), '40')
  await user.click(screen.getByRole('button', { name: 'Create event' }))
}

describe('CreateEventPage', () => {
  it('opens the new event from the cache, without fetching it or its attendees again', async () => {
    const requests: string[] = []
    mockFetch(({ method, url }) => {
      requests.push(`${method} ${url.pathname}`)
      if (method === 'POST') return jsonResponse(created, 201)
      return jsonResponse(url.pathname.endsWith('/registrations') ? [] : created)
    })
    const { router, user } = renderCreatePage()

    await createTeamOffsite(user)

    expect(await screen.findByRole('heading', { level: 1, name: 'Team offsite' })).toBeInTheDocument()
    expect(screen.getByText('No one has registered yet')).toBeInTheDocument()
    expect(screen.getByText('“Team offsite” was created.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/evt-new')
    // The form is replaced in the history, so Back from the new event returns to the list.
    expect(router.state.historyAction).toBe('REPLACE')
    expect(requests).toEqual(['POST /api/events'])
  })

  it('stays where the user went if they leave while the event is being created', async () => {
    let respondToCreate: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          respondToCreate = resolve
        }),
    )
    const { router, user } = renderCreatePage()

    await createTeamOffsite(user)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    // Browser Back while the request is in flight.
    await act(() => router.navigate(-1))
    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()

    respondToCreate(jsonResponse(created, 201))

    expect(await screen.findByText('“Team offsite” was created.')).toBeInTheDocument()
    // Opening the new event now would pull them away from the list.
    expect(router.state.location.pathname).toBe('/')
  })
})
