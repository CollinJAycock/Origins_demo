import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissAllToasts, toast } from '../../lib/toast'
import { SUCCESS_TOAST_MS, Toaster } from './Toaster'

const refusal = 'Registrations for past events can no longer be changed.'

function advanceTime(ms: number) {
  act(() => vi.advanceTimersByTime(ms))
}

function dismissButtonOf(message: string) {
  const toastElement = screen.getByText(message).parentElement as HTMLElement
  return within(toastElement).getByRole('button', { name: 'Dismiss notification' })
}

/** Main content with a button that focus can come to the toasts from, and the toasts. */
function PageWithOrigin({ showOrigin }: { showOrigin: boolean }) {
  return (
    <>
      <main tabIndex={-1}>{showOrigin && <button type="button">Origin</button>}</main>
      <Toaster />
    </>
  )
}

describe('Toaster', () => {
  beforeEach(() => {
    // The clock only moves when a test moves it, so timings are exact. Events go through fireEvent
    // because user-event would wait on that clock.
    vi.useFakeTimers()
  })

  it('dismisses a success toast after a few seconds', () => {
    render(<Toaster />)
    act(() => toast.success('Changes saved.'))

    advanceTime(SUCCESS_TOAST_MS - 1)
    expect(screen.getByText('Changes saved.')).toBeInTheDocument()
    advanceTime(1)
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
  })

  it('keeps an error toast until it is dismissed', () => {
    render(<Toaster />)
    act(() => toast.error(refusal))

    advanceTime(60_000)
    expect(screen.getByText(refusal)).toBeInTheDocument()
    fireEvent.click(dismissButtonOf(refusal))
    expect(screen.queryByText(refusal)).not.toBeInTheDocument()
  })

  it('pauses every toast while the pointer is over one, then resumes with the time that was left', () => {
    render(<Toaster />)
    act(() => {
      toast.success('Changes saved.')
      toast.success('“Workshop” was deleted.')
    })
    advanceTime(1000)

    fireEvent.pointerEnter(screen.getByText('“Workshop” was deleted.'))
    advanceTime(60_000)
    expect(screen.getByText('Changes saved.')).toBeInTheDocument()
    expect(screen.getByText('“Workshop” was deleted.')).toBeInTheDocument()

    fireEvent.pointerLeave(screen.getByText('“Workshop” was deleted.'))
    advanceTime(SUCCESS_TOAST_MS - 1000 - 1)
    expect(screen.getByText('Changes saved.')).toBeInTheDocument()
    advanceTime(1)
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
    expect(screen.queryByText('“Workshop” was deleted.')).not.toBeInTheDocument()
  })

  it('pauses while focus is in a toast', () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => toast.success('Changes saved.'))
    advanceTime(1000)

    act(() => dismissButtonOf('Changes saved.').focus())
    advanceTime(60_000)
    expect(screen.getByText('Changes saved.')).toBeInTheDocument()

    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus())
    advanceTime(SUCCESS_TOAST_MS - 1000)
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
    // Focus had already left, so the toast going away doesn't move it.
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
  })

  it('returns focus to where it was when the toast holding it is dismissed', () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    const dismiss = dismissButtonOf(refusal)

    act(() => elsewhere.focus())
    act(() => dismiss.focus())
    fireEvent.click(dismiss)

    expect(screen.queryByText(refusal)).not.toBeInTheDocument()
    expect(elsewhere).toHaveFocus()
  })

  it('moves focus to the main content when it came to the toast from nowhere', () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const dismiss = dismissButtonOf(refusal)

    act(() => dismiss.focus())
    fireEvent.click(dismiss)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('leaves focus alone when it left the toast for nowhere before the toast went away', async () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const dismiss = dismissButtonOf(refusal)

    act(() => dismiss.focus())
    // As when clicking somewhere that can't take focus.
    act(() => dismiss.blur())
    // The toast goes away in a later task, after the blur has been handled.
    await act(() => Promise.resolve())
    act(() => dismissAllToasts())

    expect(document.body).toHaveFocus()
  })

  it('leaves focus alone when it moved on from the toast before the toast went away', () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const elsewhere = document.body.appendChild(document.createElement('button'))

    act(() => dismissButtonOf(refusal).focus())
    act(() => elsewhere.focus())
    // Focus drops to <body> for a reason that has nothing to do with the toast.
    act(() => elsewhere.remove())
    act(() => dismissAllToasts())

    expect(document.body).toHaveFocus()
  })

  it('returns focus to where it was, not into another toast, after moving between toasts', async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => {
      toast.success('Changes saved.')
      toast.success('“Workshop” was deleted.')
    })
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    const first = dismissButtonOf('Changes saved.')
    const second = dismissButtonOf('“Workshop” was deleted.')

    act(() => elsewhere.focus())
    act(() => first.focus())
    // Tab to the other toast. When the user moves focus, the browser runs microtasks between the
    // blur and the focus, while document.activeElement is <body>.
    const activeElement = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body)
    fireEvent.focusOut(first, { relatedTarget: second })
    await act(() => Promise.resolve())
    activeElement.mockRestore()
    act(() => second.focus())
    fireEvent.click(second)

    expect(elsewhere).toHaveFocus()
    // Focus in the other toast would have kept it from timing out.
    advanceTime(SUCCESS_TOAST_MS)
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
  })

  it('forgets where focus came from once it has moved on to another element', () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <button type="button">First</button>
        <button type="button">Second</button>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const dismiss = dismissButtonOf(refusal)
    const second = screen.getByRole('button', { name: 'Second' })

    act(() => screen.getByRole('button', { name: 'First' }).focus())
    act(() => dismiss.focus())
    act(() => second.focus())
    // Later, focus goes nowhere, then comes to the toast from nowhere.
    act(() => second.blur())
    act(() => dismiss.focus())
    fireEvent.click(dismiss)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('moves focus to the main content when the element it came from has gone', () => {
    const { rerender } = render(<PageWithOrigin showOrigin />)
    act(() => toast.error(refusal))
    const dismiss = dismissButtonOf(refusal)

    act(() => screen.getByRole('button', { name: 'Origin' }).focus())
    act(() => dismiss.focus())
    rerender(<PageWithOrigin showOrigin={false} />)
    fireEvent.click(dismiss)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('forgets where focus came from once it has left the toasts for nowhere', async () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => toast.error(refusal))
    const dismiss = dismissButtonOf(refusal)

    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus())
    act(() => dismiss.focus())
    // As when clicking the message, which can't take focus.
    act(() => dismiss.blur())
    await act(() => Promise.resolve())
    // Later, focus comes to the toast from nowhere.
    act(() => dismiss.focus())
    fireEvent.click(dismiss)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('sends focus back to where it came from only once', () => {
    render(
      <>
        <main tabIndex={-1}>Content</main>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => {
      toast.error(refusal)
      toast.error('Couldn’t delete “Workshop”.')
    })
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })

    act(() => elsewhere.focus())
    act(() => dismissButtonOf(refusal).focus())
    fireEvent.click(dismissButtonOf(refusal))
    expect(elsewhere).toHaveFocus()

    // Focus then goes nowhere, which the toasts don't see, and later comes to a toast from nowhere.
    act(() => elsewhere.blur())
    const dismiss = dismissButtonOf('Couldn’t delete “Workshop”.')
    act(() => dismiss.focus())
    fireEvent.click(dismiss)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('returns focus to where it was when the toast times out while the window is in the background', async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Toaster />
      </>,
    )
    act(() => toast.success('Changes saved.'))
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    const dismiss = dismissButtonOf('Changes saved.')

    act(() => elsewhere.focus())
    act(() => dismiss.focus())
    // Leaving the window blurs the button, which lets the toast time out, but it stays the
    // document's focused element.
    fireEvent.focusOut(dismiss)
    await act(() => Promise.resolve())
    advanceTime(SUCCESS_TOAST_MS)

    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
    expect(elsewhere).toHaveFocus()
  })

  it('lets the other toasts time out once the focused one is dismissed', () => {
    render(<Toaster />)
    act(() => {
      toast.success('Changes saved.')
      toast.success('“Workshop” was deleted.')
    })

    const dismiss = dismissButtonOf('Changes saved.')
    act(() => dismiss.focus())
    fireEvent.click(dismiss)
    advanceTime(SUCCESS_TOAST_MS)

    expect(screen.queryByText('“Workshop” was deleted.')).not.toBeInTheDocument()
  })
})
