import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

/** Like the attendee list: confirming removes the trigger, after moving focus somewhere else. */
function RemovableItem() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRemoved, setIsRemoved] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  function confirm() {
    flushSync(() => setIsOpen(false))
    nextRef.current?.focus()
    setIsRemoved(true)
  }

  return (
    <>
      <h2 ref={headingRef} tabIndex={-1}>
        Items
      </h2>
      {!isRemoved && (
        <button type="button" onClick={() => setIsOpen(true)}>
          Remove item
        </button>
      )}
      <button type="button" ref={nextRef}>
        Next item
      </button>
      <ConfirmDialog
        open={isOpen}
        title="Remove item?"
        confirmLabel="Remove"
        onConfirm={confirm}
        onClose={() => setIsOpen(false)}
        fallbackFocusRef={headingRef}
      >
        It goes for good.
      </ConfirmDialog>
    </>
  )
}

describe('ConfirmDialog', () => {
  it('leaves focus where the parent moved it, even though the trigger has gone', async () => {
    render(<RemovableItem />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Remove item?' })).getByRole('button', { name: 'Remove' }))
    // The close event comes in a later task.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)))

    expect(screen.queryByRole('button', { name: 'Remove item' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next item' })).toHaveFocus()
  })
})
