import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useSearchParams } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorPage } from './RouteErrorPage'

/** A page with a bug: pressing its button makes the next render throw. */
function BrokenPage() {
  const [broken, setBroken] = useState(false)
  if (broken) throw new Error('Render failed')
  return (
    <button type="button" onClick={() => setBroken(true)}>
      Break
    </button>
  )
}

/** Like the events list, at "/", with a bug that only one search triggers. */
function ListPage() {
  const [searchParams] = useSearchParams()
  if (searchParams.has('broken')) throw new Error('Render failed')
  return <h1 tabIndex={-1}>Events</h1>
}

/** The crash page in place of the list, inside a layout like the app's: a header, then the main content. */
function renderCrashedList() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <header>
              <Link to="/">Event Manager</Link>
            </header>
            <main tabIndex={-1}>
              <Outlet />
            </main>
          </>
        ),
        children: [{ path: '/', element: <ListPage />, errorElement: <RouteErrorPage /> }],
      },
    ],
    { initialEntries: ['/?broken'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RouteErrorPage', () => {
  it('takes focus when it replaces the page that had it', async () => {
    // React and the router both log the error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <BrokenPage />, errorElement: <RouteErrorPage /> }])
    render(<RouterProvider router={router} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Break' }))

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus()
  })

  it('moves focus to the page that comes back when leaving for the same address', async () => {
    const router = renderCrashedList()
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus()

    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to events' }))

    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('heading', { name: 'Events' })).toHaveFocus()
  })

  it('leaves focus on the header link that went to the same address', async () => {
    const router = renderCrashedList()

    await userEvent.setup().click(screen.getByRole('link', { name: 'Event Manager' }))

    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Event Manager' })).toHaveFocus()
  })
})
