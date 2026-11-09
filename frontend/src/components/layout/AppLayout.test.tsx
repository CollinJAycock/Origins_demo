import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageHeader } from '../ui/PageHeader'
import { AppLayout } from './AppLayout'

/** Like the events list: typing in the search box updates the query string. */
function ListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  return (
    <>
      <PageHeader title="Events" />
      <input
        type="search"
        aria-label="Search events"
        value={searchParams.get('q') ?? ''}
        onChange={(event) => setSearchParams({ q: event.target.value })}
      />
      <Link to="/events/evt-1">Workshop</Link>
    </>
  )
}

function renderApp() {
  const router = createMemoryRouter([
    {
      element: <AppLayout />,
      children: [
        { index: true, element: <ListPage /> },
        { path: 'events/:eventId', element: <PageHeader title="Workshop" /> },
        // A page that is still loading and has no heading yet.
        { path: 'events/:eventId/edit', element: <p>Loading…</p> },
      ],
    },
  ])
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

describe('AppLayout', () => {
  beforeEach(() => {
    // ScrollRestoration scrolls on every navigation, which jsdom doesn't implement.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('leaves focus alone on the first page', () => {
    renderApp()
    expect(document.body).toHaveFocus()
  })

  it("moves focus to the new page's heading after navigating, including back", async () => {
    const { user, router } = renderApp()

    await user.click(screen.getByRole('link', { name: 'Workshop' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Workshop' })).toHaveFocus()

    await act(() => router.navigate(-1))
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toHaveFocus()
  })

  it('focuses the main content when the new page has no heading yet', async () => {
    const { router } = renderApp()

    await act(() => router.navigate('/events/evt-1/edit'))

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('keeps focus in the search box when only the query string changes', async () => {
    const { user, router } = renderApp()
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })

    await user.type(searchBox, 'work')

    expect(router.state.location.search).toBe('?q=work')
    expect(searchBox).toHaveFocus()
  })
})
