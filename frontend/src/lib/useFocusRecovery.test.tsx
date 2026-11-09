import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusRecovery } from './useFocusRecovery'

interface HarnessProps {
  /** The button that has focus at first, and is removed when this turns false. */
  showRetry?: boolean
  /** The heading focus should move to; missing while "loading". */
  showHeading?: boolean
  /** Mounts an input that takes focus, as another component might in the same render. */
  showSearch?: boolean
  /** Sends focus back to where it came from instead of to the heading. */
  toOrigin?: boolean
}

function Harness({ showRetry = true, showHeading = true, showSearch = false, toOrigin = false }: HarnessProps) {
  const focusRecovery = useFocusRecovery((container, cameFrom) =>
    toOrigin ? cameFrom : container.querySelector<HTMLElement>('h2'),
  )
  return (
    <>
      <div {...focusRecovery}>
        {showHeading && <h2 tabIndex={-1}>Attendees</h2>}
        {showRetry && <button type="button">Retry</button>}
      </div>
      <button type="button">Elsewhere</button>
      {showSearch && <FocusedOnMount />}
    </>
  )
}

function FocusedOnMount() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return <input ref={ref} aria-label="Search" />
}

describe('useFocusRecovery', () => {
  it('moves focus to the target when the focused element is removed', () => {
    const { rerender } = render(<Harness />)
    act(() => screen.getByRole('button', { name: 'Retry' }).focus())

    rerender(<Harness showRetry={false} />)

    expect(screen.getByRole('heading', { name: 'Attendees' })).toHaveFocus()
  })

  it('waits for the target to render', () => {
    const { rerender } = render(<Harness />)
    act(() => screen.getByRole('button', { name: 'Retry' }).focus())

    rerender(<Harness showRetry={false} showHeading={false} />)
    expect(document.body).toHaveFocus()
    rerender(<Harness showRetry={false} />)

    expect(screen.getByRole('heading', { name: 'Attendees' })).toHaveFocus()
  })

  it('does nothing when the removed element did not have focus', () => {
    const { rerender } = render(<Harness />)

    rerender(<Harness showRetry={false} />)

    expect(document.body).toHaveFocus()
  })

  it('leaves focus where another component put it in the same render', () => {
    const { rerender } = render(<Harness />)
    act(() => screen.getByRole('button', { name: 'Retry' }).focus())

    rerender(<Harness showRetry={false} showSearch />)

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
  })

  it('tells the target finder where focus came from', () => {
    const { rerender } = render(<Harness toOrigin />)
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    act(() => elsewhere.focus())
    act(() => screen.getByRole('button', { name: 'Retry' }).focus())

    rerender(<Harness toOrigin showRetry={false} />)

    expect(elsewhere).toHaveFocus()
  })

  it('still knows where focus came from after the window was in the background', async () => {
    const { rerender } = render(<Harness toOrigin />)
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    const retry = screen.getByRole('button', { name: 'Retry' })
    act(() => elsewhere.focus())
    act(() => retry.focus())

    // Leaving the window blurs the element, and coming back focuses it again, from nowhere.
    fireEvent.focusOut(retry)
    await act(() => Promise.resolve())
    fireEvent.focusIn(retry)
    rerender(<Harness toOrigin showRetry={false} />)

    expect(elsewhere).toHaveFocus()
  })

  it('forgets the element once focus has moved out of the container', () => {
    const { rerender } = render(<Harness />)
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    act(() => screen.getByRole('button', { name: 'Retry' }).focus())

    act(() => elsewhere.focus())
    // Focus drops to <body> for a reason that has nothing to do with the container.
    act(() => elsewhere.blur())
    rerender(<Harness showRetry={false} />)

    expect(document.body).toHaveFocus()
  })

  it('forgets the element once focus has gone nowhere, as after a click on the page', async () => {
    const { rerender } = render(<Harness />)
    const retry = screen.getByRole('button', { name: 'Retry' })
    act(() => retry.focus())

    act(() => retry.blur())
    // The element goes away in a later task, after the blur has been handled.
    await act(() => Promise.resolve())
    rerender(<Harness showRetry={false} />)

    expect(document.body).toHaveFocus()
  })

  it('keeps track of the element while the window is in the background', async () => {
    const { rerender } = render(<Harness />)
    const retry = screen.getByRole('button', { name: 'Retry' })
    act(() => retry.focus())

    // Leaving the window blurs the element, but it stays the document's focused element, and
    // focus comes back to it on return.
    fireEvent.focusOut(retry)
    await act(() => Promise.resolve())
    rerender(<Harness showRetry={false} />)

    expect(screen.getByRole('heading', { name: 'Attendees' })).toHaveFocus()
  })
})
