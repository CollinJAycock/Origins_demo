import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusOnMount } from './useFocusOnMount'

function Message() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(headingRef)
  return (
    <h1 ref={headingRef} tabIndex={-1}>
      Event not found
    </h1>
  )
}

function Page({ showMessage }: { showMessage: boolean }) {
  return (
    <>
      <button type="button">New event</button>
      <main tabIndex={-1}>{showMessage && <Message />}</main>
    </>
  )
}

describe('useFocusOnMount', () => {
  it('takes focus from <body>', () => {
    const { rerender } = render(<Page showMessage={false} />)

    rerender(<Page showMessage />)

    expect(screen.getByRole('heading', { name: 'Event not found' })).toHaveFocus()
  })

  it('takes focus from the content around it', () => {
    const { rerender } = render(<Page showMessage={false} />)
    act(() => screen.getByRole('main').focus())

    rerender(<Page showMessage />)

    expect(screen.getByRole('heading', { name: 'Event not found' })).toHaveFocus()
  })

  it('leaves focus that is somewhere specific', () => {
    const { rerender } = render(<Page showMessage={false} />)
    const newEvent = screen.getByRole('button', { name: 'New event' })
    act(() => newEvent.focus())

    rerender(<Page showMessage />)

    expect(newEvent).toHaveFocus()
  })
})
