import { useEffect, type RefObject } from 'react'

/**
 * Moves focus to the element in `ref` when it mounts, if focus is on <body> or around the element
 * (like <main>). For a message that can replace a page that was already showing and take the
 * focused element with it, like an event that turns out to have been deleted. Focus that is
 * somewhere specific, e.g. in the header, stays where it is.
 */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current
    const focused = document.activeElement
    if (element && (!focused?.isConnected || focused.contains(element))) element.focus()
  }, [ref])
}
