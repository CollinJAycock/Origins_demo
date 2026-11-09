/**
 * Moves focus to the page's heading, or to the main content until there is one, as when another page has
 * opened. Without scrolling: the page is already where it belongs.
 */
export function focusPageHeading(main: HTMLElement | null) {
  const target = main?.querySelector<HTMLElement>('h1') ?? main
  target?.focus({ preventScroll: true })
}
