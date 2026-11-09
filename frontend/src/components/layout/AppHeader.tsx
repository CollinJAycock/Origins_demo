import { CalendarDays, Plus } from 'lucide-react'
import { Link, useMatch } from 'react-router'
import { ButtonLink } from '../ui/Button'

export function AppHeader() {
  const isCreating = useMatch('/events/new') !== null

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-md font-semibold text-slate-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarDays className="size-4.5" aria-hidden="true" />
          </span>
          Event Manager
        </Link>
        {!isCreating && (
          <ButtonLink to="/events/new">
            <Plus aria-hidden="true" />
            New event
          </ButtonLink>
        )}
      </div>
    </header>
  )
}
