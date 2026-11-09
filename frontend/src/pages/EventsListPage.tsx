import { useRef } from 'react'
import { EventResults } from '../components/events/EventResults'
import { EventSearch } from '../components/events/EventSearch'
import { StatusFilter } from '../components/events/StatusFilter'
import { PageHeader } from '../components/ui/PageHeader'
import { PageTitle } from '../components/ui/PageTitle'
import { useEventListSearch } from '../lib/eventListSearch'
import { useNow } from '../lib/useNow'

export function EventsListPage() {
  const { status, q, page, update } = useEventListSearch()
  const now = useNow()
  const searchInputRef = useRef<HTMLInputElement>(null)

  function clearSearch() {
    update({ q: '', page: 1 })
    // The "Clear search" button disappears with the empty state, so continue from the search box.
    searchInputRef.current?.focus()
  }

  function searchAll() {
    update({ status: 'all', page: 1 })
    // Like "Clear search", the button disappears with the empty state.
    searchInputRef.current?.focus()
  }

  return (
    <>
      <PageTitle>Events</PageTitle>
      <PageHeader title="Events" description="Browse events and manage who's attending." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusFilter value={status} onChange={(next) => update({ status: next, page: 1 })} />
        <EventSearch
          inputRef={searchInputRef}
          value={q}
          onSearch={(term) => {
            // Typing shouldn't flood the history, so search terms replace the current entry.
            if (term !== q) update({ q: term, page: 1 }, { replace: true })
          }}
        />
      </div>

      <EventResults filters={{ status, q, page }} now={now} onClearSearch={clearSearch} onSearchAll={searchAll} />
    </>
  )
}
