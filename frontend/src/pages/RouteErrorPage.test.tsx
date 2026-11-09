import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
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

describe('RouteErrorPage', () => {
  it('takes focus when it replaces the page that had it', async () => {
    // React and the router both log the error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <BrokenPage />, errorElement: <RouteErrorPage /> }])
    render(<RouterProvider router={router} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Break' }))

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus()
  })
})
