import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NETWORK_ERROR_MESSAGE } from '../api/client'
import { SEARCH_DEBOUNCE_MS } from '../components/events/EventSearch'
import { makeEvent, makePage } from '../test/fixtures'
import { jsonResponse, mockFetch, problemResponse, renderWithProviders } from '../test/utils'
import { EventsListPage } from './EventsListPage'

const workshop = makeEvent({ id: 'evt-1', title: 'Workshop', maxCapacity: 30, registeredCount: 18 })
const pitchNight = makeEvent({ id: 'evt-2', title: 'Pitch night', maxCapacity: 8, registeredCount: 8 })

/**
 * Serves "Event 1" to "Event 13", 12 per page: two pages. A test can pass a smaller count, which is
 * read on every request, to delete events between requests.
 */
function mockPages(eventCount: () => number = () => 13) {
  const events = Array.from({ length: 13 }, (_, index) =>
    makeEvent({ id: `evt-${index + 1}`, title: `Event ${index + 1}` }),
  )
  return mockFetch(({ url }) => {
    const page = Number(url.searchParams.get('page'))
    const remaining = events.slice(0, eventCount())
    return jsonResponse(
      makePage(remaining.slice((page - 1) * 12, page * 12), {
        page,
        totalCount: remaining.length,
        totalPages: Math.ceil(remaining.length / 12),
      }),
    )
  })
}

/** The Previous or Next link, available or not. */
const pageLink = (name: 'Previous' | 'Next') =>
  within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('link', { name })

describe('EventsListPage', () => {
  it('lists upcoming events by default', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(makePage([workshop, pitchNight])))
    renderWithProviders(<EventsListPage />)

    expect(await screen.findByRole('link', { name: 'Workshop' })).toHaveAttribute('href', '/events/evt-1')
    expect(screen.getByRole('region', { name: 'Events' })).toHaveTextContent('Showing 1–2 of 2 events')
    expect(screen.getByText('18 / 30 registered')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Upcoming' })).toBeChecked()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/events?status=upcoming&page=1&pageSize=12')
    // Results arriving on their own don't take focus.
    expect(document.body).toHaveFocus()
  })

  it('takes its filters from the URL', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(makePage([], { page: 2 })))
    renderWithProviders(<EventsListPage />, { route: '/?status=past&q=night&page=2' })

    await waitFor(() =>
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/events?status=past&search=night&page=2&pageSize=12'),
    )
    expect(screen.getByRole('radio', { name: 'Past' })).toBeChecked()
    expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveValue('night')
  })

  it('moves between pages with the pagination links', async () => {
    const fetchSpy = mockPages()
    const { user, router } = renderWithProviders(<EventsListPage />)
    const pagination = () => screen.getByRole('navigation', { name: 'Pagination' })

    expect(await screen.findByRole('link', { name: 'Event 12' })).toBeInTheDocument()
    expect(pagination()).toHaveTextContent('Page 1 of 2')
    expect(pageLink('Previous')).toHaveAttribute('aria-disabled', 'true')
    expect(pageLink('Previous')).not.toHaveAttribute('href')
    expect(pageLink('Next')).toHaveAttribute('href', '/?page=2')
    await user.click(pageLink('Next'))

    expect(await screen.findByRole('link', { name: 'Event 13' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
    expect(fetchSpy.mock.lastCall?.[0]).toBe('/api/events?status=upcoming&page=2&pageSize=12')
    expect(pagination()).toHaveTextContent('Page 2 of 2')
    expect(pageLink('Next')).toHaveAttribute('aria-disabled', 'true')
    expect(pageLink('Next')).not.toHaveAttribute('href')
    // An unavailable link goes nowhere.
    await user.click(pageLink('Next'))
    expect(router.state.location.search).toBe('?page=2')
    await user.click(pageLink('Previous'))

    expect(await screen.findByRole('link', { name: 'Event 1' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('keeps focus on Next or Previous when following it makes it unavailable', async () => {
    mockPages()
    const { user, router } = renderWithProviders(<EventsListPage />)
    await screen.findByRole('link', { name: 'Event 12' })

    // Following Next to the last page leaves it unavailable, and focused rather than replaced.
    const next = pageLink('Next')
    expect(next).not.toHaveAttribute('aria-disabled')
    next.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('link', { name: 'Event 13' })
    expect(next).toHaveFocus()
    expect(next).toHaveAttribute('aria-disabled', 'true')
    // Still focusable without its href, though out of the tab order. (jsdom wouldn't move focus off
    // an element that stops being focusable, as browsers do.)
    expect(next).toHaveAttribute('tabindex', '-1')

    // Previous, one step back from there, does the same on the first page.
    await user.tab({ shift: true })
    const previous = pageLink('Previous')
    expect(previous).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('link', { name: 'Event 1' })
    expect(router.state.location.search).toBe('')
    expect(previous).toHaveFocus()
    expect(previous).toHaveAttribute('aria-disabled', 'true')
  })

  it('moves focus to the empty state when Next leads to a page that has emptied since', async () => {
    let eventCount = 13
    mockPages(() => eventCount)
    const { user } = renderWithProviders(<EventsListPage />)
    await screen.findByRole('link', { name: 'Event 12' })

    eventCount = 12 // deleted elsewhere
    pageLink('Next').focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'This page is empty' })).toHaveFocus())
  })

  it('moves focus to the results when Previous leads to the only page left', async () => {
    let eventCount = 13
    mockPages(() => eventCount)
    const { user } = renderWithProviders(<EventsListPage />, { route: '/?page=2' })
    await screen.findByRole('link', { name: 'Event 13' })

    eventCount = 12 // deleted elsewhere
    pageLink('Previous').focus()
    await user.keyboard('{Enter}')

    await screen.findByRole('link', { name: 'Event 1' })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('region', { name: 'Events' })).toHaveFocus())
  })

  it('moves focus to the error when the next page fails to load', async () => {
    const events = Array.from({ length: 12 }, (_, index) => makeEvent({ id: `evt-${index + 1}` }))
    mockFetch(({ url }) =>
      url.searchParams.get('page') === '2'
        ? problemResponse(500, { title: 'An unexpected error occurred.', code: 'internal_server_error' })
        : jsonResponse(makePage(events, { totalCount: 13, totalPages: 2 })),
    )
    const { user } = renderWithProviders(<EventsListPage />)
    await screen.findByRole('navigation', { name: 'Pagination' })

    pageLink('Next').focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByRole('heading', { name: "Couldn't load events" })).toHaveFocus())
  })

  it('offers the last page when the page in the URL is past the end', async () => {
    const fetchSpy = mockFetch(({ url }) => {
      const page = Number(url.searchParams.get('page'))
      return jsonResponse(makePage(page === 2 ? [workshop] : [], { page, totalCount: 13, totalPages: 2 }))
    })
    const { user, router } = renderWithProviders(<EventsListPage />, { route: '/?q=work&page=5' })

    expect(await screen.findByRole('heading', { name: 'This page is empty' })).toBeInTheDocument()
    expect(screen.getByText('There are only 2 pages of results.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('This page is empty')
    await user.click(screen.getByRole('link', { name: 'Go to the last page' }))

    expect(await screen.findByRole('link', { name: 'Workshop' })).toBeInTheDocument()
    // The search is kept.
    expect(router.state.location.search).toBe('?q=work&page=2')
    expect(fetchSpy.mock.lastCall?.[0]).toBe('/api/events?status=upcoming&search=work&page=2&pageSize=12')
    // The link went with the empty state, so focus continues from the results.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Events' })).toHaveFocus())
  })

  it('shows an error with a Retry button that recovers', async () => {
    let attempt = 0
    mockFetch(() => {
      attempt += 1
      return attempt === 1 ? Promise.reject(new TypeError('Failed to fetch')) : jsonResponse(makePage([workshop]))
    })
    const { user } = renderWithProviders(<EventsListPage />)

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: 'Workshop' })).toBeInTheDocument()
    // Retry went with the error, so focus continues from the results.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Events' })).toHaveFocus())
  })

  it('debounces the search, resets to page 1 and offers to clear an empty result', async () => {
    const fetchSpy = mockFetch(({ url }) =>
      jsonResponse(url.searchParams.has('search') ? makePage([]) : makePage([workshop])),
    )
    const { user, router } = renderWithProviders(<EventsListPage />, { route: '/?page=2' })
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })

    await user.type(searchBox, 'zzz')

    await waitFor(() => expect(router.state.location.search).toBe('?q=zzz'))
    const emptyStateTitle = await screen.findByRole('heading', { name: 'No upcoming events match “zzz”' })
    expect(screen.getByRole('status')).toHaveTextContent('No upcoming events match “zzz”')
    const searches = fetchSpy.mock.calls.filter(([input]) => String(input).includes('search='))
    expect(searches).toHaveLength(1)

    // Scoped to the empty state: the search box has a "Clear search" button of its own.
    const emptyState = emptyStateTitle.parentElement ?? document.body
    await user.click(within(emptyState).getByRole('button', { name: 'Clear search' }))

    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(searchBox).toHaveValue('')
    // The clicked button is gone with the empty state, so focus continues from the search box.
    expect(searchBox).toHaveFocus()
    expect(await screen.findByRole('link', { name: 'Workshop' })).toBeInTheDocument()
  })

  it('offers to search all events when the status filter hides every match', async () => {
    mockFetch(() => jsonResponse(makePage([])))
    const { user, router } = renderWithProviders(<EventsListPage />, { route: '/?q=work&page=2' })

    expect(await screen.findByRole('heading', { name: 'No upcoming events match “work”' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Search all events' }))

    await waitFor(() => expect(router.state.location.search).toBe('?status=all&q=work'))
    // The clicked button is gone with the empty state, so focus continues from the search box.
    expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveFocus()
    expect(await screen.findByRole('heading', { name: 'No events match “work”' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Search all events' })).not.toBeInTheDocument()
  })

  it('shows the loading state, not the previous empty result, while a new search loads', async () => {
    let respondToWork: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(({ url }) =>
      url.searchParams.get('search') === 'work'
        ? new Promise<Response>((resolve) => {
            respondToWork = resolve
          })
        : jsonResponse(makePage([])),
    )
    const { user } = renderWithProviders(<EventsListPage />, { route: '/?q=zzz' })
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })
    await screen.findByRole('heading', { name: 'No upcoming events match “zzz”' })

    await user.clear(searchBox)
    await user.type(searchBox, 'work')

    expect(await screen.findByText('Loading events…')).toBeInTheDocument()
    expect(screen.queryByText('No upcoming events match “work”')).not.toBeInTheDocument()
    // The skeleton can show before the request goes out, and answering it before then does nothing.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('search=work'), expect.anything()))
    respondToWork(jsonResponse(makePage([workshop])))
    expect(await screen.findByRole('link', { name: 'Workshop' })).toBeInTheDocument()
  })

  it('announces what a search found once its results are in', async () => {
    let respondToPitch: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(({ url }) =>
      url.searchParams.get('search') === 'pitch'
        ? new Promise<Response>((resolve) => {
            respondToPitch = resolve
          })
        : jsonResponse(makePage([workshop, pitchNight])),
    )
    const { user } = renderWithProviders(<EventsListPage />)
    await screen.findByRole('link', { name: 'Workshop' })
    // Kept for the whole test: a live region only announces changes if it stays mounted.
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Showing 1–2 of 2 upcoming events')

    await user.type(screen.getByRole('searchbox', { name: 'Search events' }), 'pitch')

    // The previous results stay on screen while the search runs, but they aren't what it found.
    await waitFor(() => expect(status).toBeEmptyDOMElement())
    expect(screen.getByRole('link', { name: 'Workshop' })).toBeInTheDocument()
    // The region can empty before the request goes out, and answering it before then does nothing.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('search=pitch'), expect.anything()))
    respondToPitch(jsonResponse(makePage([pitchNight])))
    await waitFor(() => expect(status).toHaveTextContent('Showing 1–1 of 1 upcoming event matching “pitch”'))
  })

  it('names the filters in the announcement, so a cached result with the same counts is still read out', async () => {
    mockFetch(() => jsonResponse(makePage([workshop, pitchNight])))
    const { user } = renderWithProviders(<EventsListPage />)
    await screen.findByRole('link', { name: 'Workshop' })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Showing 1–2 of 2 upcoming events')

    await user.click(screen.getByRole('radio', { name: 'All' }))
    await waitFor(() => expect(status).toHaveTextContent(/^Showing 1–2 of 2 events$/))

    // Upcoming is cached, so its result shows at once: only the filter's name tells it apart.
    await user.click(screen.getByRole('radio', { name: 'Upcoming' }))
    expect(status).toHaveTextContent('Showing 1–2 of 2 upcoming events')
  })

  it('clears the search from the search box and keeps focus there', async () => {
    mockFetch(() => jsonResponse(makePage([workshop])))
    const { user, router } = renderWithProviders(<EventsListPage />, { route: '/?q=work' })
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })
    expect(searchBox).toHaveValue('work')

    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }))

    expect(searchBox).toHaveValue('')
    expect(searchBox).toHaveFocus()
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('drops a search that is still pending when the user goes back', async () => {
    // Fake timers decide when the debounce runs out; they also advance on their own, which
    // Testing Library's async helpers rely on.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch(() => jsonResponse(makePage([workshop])))
    const { user, router } = renderWithProviders(<EventsListPage />, {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    })
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })

    await user.click(screen.getByRole('radio', { name: 'All' }))
    await user.type(searchBox, 'pitch')
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS))
    expect(router.state.location.search).toBe('?status=all&q=pitch')
    await user.type(searchBox, ' n')
    await act(() => router.navigate(-1))
    // Run out the debounce, so an abandoned " n" would have been applied by now.
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS))

    expect(router.state.location.search).toBe('')
    expect(searchBox).toHaveValue('')
  })

  it('shows the year on the date badge only for events outside the current year', async () => {
    // Mid-year, so an event a few days away can't fall in the next year (as it would in late December).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 1, 12))
    const thisWeek = makeEvent({ id: 'evt-1', title: 'Workshop' })
    const nextYear = makeEvent({ id: 'evt-3', title: 'Conference', date: new Date(2027, 5, 10, 14).toISOString() })
    mockFetch(() => jsonResponse(makePage([thisWeek, nextYear])))
    renderWithProviders(<EventsListPage />)

    const conferenceCard = (await screen.findByRole('link', { name: 'Conference' })).closest('article')
    const workshopCard = screen.getByRole('link', { name: 'Workshop' }).closest('article')
    expect(conferenceCard).not.toBeNull()
    expect(workshopCard).not.toBeNull()
    expect(within(conferenceCard as HTMLElement).getByText('2027')).toBeInTheDocument()
    expect(within(workshopCard as HTMLElement).queryByText(/^\d{4}$/)).not.toBeInTheDocument()
  })

  it('suggests creating an event when there are none', async () => {
    mockFetch(() => jsonResponse(makePage([])))
    renderWithProviders(<EventsListPage />)

    expect(await screen.findByRole('heading', { name: 'No upcoming events' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an event' })).toHaveAttribute('href', '/events/new')
  })
})
