import { Search, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { SEARCH_MAX_LENGTH } from '../../lib/eventListSearch'
import { useDebouncedCallback } from '../../lib/useDebouncedCallback'
import { useFocusRecovery } from '../../lib/useFocusRecovery'
import { Input } from '../ui/Input'

/** How long typing has to pause before the search is applied. */
export const SEARCH_DEBOUNCE_MS = 300

interface EventSearchProps {
  /** The search term currently applied (from the URL). */
  value: string
  /** Called with the trimmed term once typing pauses, or immediately when cleared. */
  onSearch: (value: string) => void
  /** The search box, so the page can also return focus to it. */
  inputRef: RefObject<HTMLInputElement | null>
}

export function EventSearch({ value, onSearch, inputRef }: EventSearchProps) {
  // What the user is typing; null shows the applied value.
  const [draft, setDraft] = useState<string | null>(null)
  // The term this box applied last, to tell its own commits from changes made elsewhere.
  const committedRef = useRef(value)
  const commit = useDebouncedCallback((term: string) => {
    committedRef.current = term.trim()
    onSearch(committedRef.current)
  }, SEARCH_DEBOUNCE_MS)

  // The applied value changed without typing (back/forward, "Clear search"): show it instead,
  // and drop a search that was still waiting to be applied. A layout effect, so the outdated
  // text is never painted.
  useLayoutEffect(() => {
    if (value === committedRef.current) return
    committedRef.current = value
    commit.cancel()
    setDraft(null)
  }, [value, commit])

  const inputValue = draft ?? value
  // Back or forward can empty the box, and so remove the clear button, while that has focus. Focus
  // then moves to the box, as when the button is pressed.
  const focusRecovery = useFocusRecovery(() => inputRef.current)

  function clear() {
    commit.cancel()
    committedRef.current = ''
    setDraft('')
    onSearch('')
    // The clear button disappears with the text, so keep focus in the search box.
    inputRef.current?.focus()
  }

  return (
    <div role="search" className="relative w-full sm:max-w-xs" {...focusRecovery}>
      <label htmlFor="event-search" className="sr-only">
        Search events
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <Input
        ref={inputRef}
        id="event-search"
        type="search"
        value={inputValue}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Search events"
        autoComplete="off"
        onChange={(event) => {
          setDraft(event.target.value)
          commit(event.target.value)
        }}
        className="pr-10 pl-9"
      />
      {inputValue && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
