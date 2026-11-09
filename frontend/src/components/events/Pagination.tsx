import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useHref, useLinkClickHandler, type To } from 'react-router'
import { buttonStyles } from '../ui/buttonStyles'

interface PaginationProps {
  page: number
  totalPages: number
  /** Location of a given page with the current filters kept. */
  pageLink: (page: number) => To
}

/** Previous/next links, so pages can be bookmarked and opened in new tabs. */
export function Pagination({ page, totalPages, pageLink }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4">
      <PageLink to={page > 1 ? pageLink(page - 1) : null}>
        <ChevronLeft aria-hidden="true" />
        Previous
      </PageLink>
      <p className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </p>
      <PageLink to={page < totalPages ? pageLink(page + 1) : null}>
        Next
        <ChevronRight aria-hidden="true" />
      </PageLink>
    </nav>
  )
}

/**
 * A link to another page or, at either end, the same element as an unavailable placeholder. It has
 * to stay one element: following "Next" to the last page makes that link unavailable while it has
 * focus, and replacing it would drop focus to <body>.
 */
function PageLink({ to, children }: { to: To | null; children: ReactNode }) {
  // Not <Link>, which always renders an href. Hooks can't be skipped, so without a page to link to
  // they get '.', this route's own path, which goes unused.
  const href = useHref(to ?? '.')
  const followLink = useLinkClickHandler(to ?? '.')
  const className = buttonStyles({ variant: 'secondary' })

  if (to === null) {
    // HTML's placeholder link: an <a> without an href stands where a link would otherwise be. The
    // lint rules assume every <a> has an href, but without one it is a generic element, not a link,
    // so role="link" is what keeps it announced as an (unavailable) link. tabIndex -1 keeps it
    // focusable, so focus can stay on it, but out of the tab order.
    return (
      // oxlint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/no-redundant-roles -- see above
      <a role="link" aria-disabled="true" tabIndex={-1} className={className}>
        {children}
      </a>
    )
  }
  return (
    <a href={href} onClick={followLink} className={className}>
      {children}
    </a>
  )
}
