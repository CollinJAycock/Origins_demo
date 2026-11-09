import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button, ButtonLink } from '../components/ui/Button'
import { PageTitle } from '../components/ui/PageTitle'
import { focusPageHeading } from '../lib/focusPageHeading'
import { useFocusOnMount } from '../lib/useFocusOnMount'

/** Shown by the router when rendering a page throws. */
export function RouteErrorPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The page it replaces can be the one that was already showing, with focus in it.
  useFocusOnMount(headingRef)

  // Leaving for the same address, e.g. "Back to events" after the list crashed, puts the page back without the
  // change of page that moves focus to its heading, and the control that had focus here goes with this page.
  useEffect(
    () => () => {
      if (document.activeElement === document.body) focusPageHeading(document.querySelector('main'))
    },
    [],
  )

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <PageTitle>Something went wrong</PageTitle>
      <div className="flex size-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-bold tracking-tight text-slate-900 outline-none">
        Something went wrong
      </h1>
      <p className="mt-2 text-slate-600">An unexpected error occurred. Reloading the page usually fixes it.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={() => window.location.reload()}>Reload page</Button>
        <ButtonLink variant="secondary" to="/">
          Back to events
        </ButtonLink>
      </div>
    </div>
  )
}
