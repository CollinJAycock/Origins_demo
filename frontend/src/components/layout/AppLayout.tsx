import { useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toaster } from '../ui/Toaster'
import { AppHeader } from './AppHeader'

export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPathnameRef = useRef(pathname)

  // A new page replaces the old one without a page load, so focus would drop to <body> unannounced.
  // Move it to the new page's heading (or the main content until there is one). Query-string
  // changes alone, like the list's filters, keep focus where it is, e.g. in the search box.
  useEffect(() => {
    if (pathname === previousPathnameRef.current) return
    previousPathnameRef.current = pathname
    const target = mainRef.current?.querySelector('h1') ?? mainRef.current
    // Without scrolling: ScrollRestoration has already put the page where it belongs.
    target?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-white text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <AppHeader />
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-10"
      >
        <Outlet />
      </main>
      <Toaster />
      <ScrollRestoration />
    </div>
  )
}
