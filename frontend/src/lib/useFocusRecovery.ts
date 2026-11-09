import { useEffect, useRef, type FocusEvent } from 'react'

/**
 * Keeps focus from dropping to <body> when part of a container is replaced and takes the focused
 * element with it, like a Retry button that goes away once its content has loaded. Focus then
 * moves to `findTarget(container)` as soon as that finds an element; it may find none while a
 * skeleton shows. Focus that has moved somewhere else in the meantime stays where it is.
 *
 * It checks after each render of the component that calls it, so call it in the component whose
 * render does the replacing. A descendant that removes its own focused element through its own
 * state isn't covered: focus stays on <body> until the calling component next renders, and only
 * then moves. Spread the returned handlers onto the container.
 */
export function useFocusRecovery(findTarget: (container: HTMLElement) => HTMLElement | null | undefined) {
  const containerRef = useRef<HTMLElement | null>(null)
  const focusedRef = useRef<Element | null>(null)

  // No dependency list: any render can be the one that removed the focused element.
  useEffect(() => {
    const focused = focusedRef.current
    if (!focused || focused.isConnected) return
    if (document.activeElement !== document.body) {
      focusedRef.current = null
      return
    }
    const container = containerRef.current
    const target = container?.isConnected ? findTarget(container) : null
    if (!target) return
    focusedRef.current = null
    target.focus({ preventScroll: true })
  })

  return {
    onFocus(event: FocusEvent<HTMLElement>) {
      containerRef.current = event.currentTarget
      focusedRef.current = event.target
    },
    onBlur(event: FocusEvent<HTMLElement>) {
      const { target, relatedTarget, currentTarget } = event
      if (relatedTarget) {
        // Moved to another element. Inside the container, onFocus records it.
        if (!currentTarget.contains(relatedTarget)) focusedRef.current = null
        return
      }
      // Focus went nowhere. After a click on something that can't take focus, forget the element.
      // Keep it while it is still the document's focused element: the window lost focus, and it
      // may be removed before the user is back. Keep it too if it has left the document, in case
      // a removal outside React blurs it (React drops the blur for the removals it makes).
      queueMicrotask(() => {
        const keep = !target.isConnected || document.activeElement === target
        if (!keep && focusedRef.current === target) focusedRef.current = null
      })
    },
  }
}
