import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EventSearch } from './EventSearch'

describe('EventSearch', () => {
  it('keeps typing that lands before its own search comes back as the applied value', async () => {
    const onSearch = vi.fn<(value: string) => void>()
    const inputRef = createRef<HTMLInputElement>()
    const user = userEvent.setup()
    const { rerender } = render(<EventSearch value="" onSearch={onSearch} inputRef={inputRef} />)
    const searchBox = screen.getByRole('searchbox', { name: 'Search events' })

    await user.type(searchBox, 'wor')
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('wor'))
    await user.type(searchBox, 'k')
    // The URL catches up with "wor" only after the next keystroke.
    rerender(<EventSearch value="wor" onSearch={onSearch} inputRef={inputRef} />)

    expect(searchBox).toHaveValue('work')
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith('work'))
  })

  it('moves focus to the search box when going back empties it while the clear button has focus', () => {
    const onSearch = vi.fn<(value: string) => void>()
    const inputRef = createRef<HTMLInputElement>()
    const { rerender } = render(<EventSearch value="js" onSearch={onSearch} inputRef={inputRef} />)
    act(() => screen.getByRole('button', { name: 'Clear search' }).focus())

    // Back to an entry without a search.
    rerender(<EventSearch value="" onSearch={onSearch} inputRef={inputRef} />)

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveFocus()
  })
})
