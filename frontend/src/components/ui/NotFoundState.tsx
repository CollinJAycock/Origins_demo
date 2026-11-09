import { ArrowLeft, CalendarX } from 'lucide-react'
import { useRef } from 'react'
import { useFocusOnMount } from '../../lib/useFocusOnMount'
import { ButtonLink } from './Button'

interface NotFoundStateProps {
  title: string
  description: string
  linkTo?: string
}

/** Page-level "not found" message with a way back. */
export function NotFoundState({ title, description, linkTo = '/' }: NotFoundStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // This can replace a page that was already showing, like an event that turns out to have been
  // deleted, and take the focused element with it.
  useFocusOnMount(headingRef)

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <CalendarX className="size-7" aria-hidden="true" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-bold tracking-tight text-slate-900 outline-none">
        {title}
      </h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <ButtonLink to={linkTo} className="mt-8">
        <ArrowLeft aria-hidden="true" />
        Back to events
      </ButtonLink>
    </div>
  )
}
