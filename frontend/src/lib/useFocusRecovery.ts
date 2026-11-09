import { useEffect, useRef, type FocusEvent } from 'react'

/**
 * Keeps focus from dropping to <body> when part of a container is replaced and takes the focused
 * element with it, like a Retry button that goes away once its content has loaded. Focus then
 * moves to `findTarget(container, cameFrom)` as soon as that finds an element; it may find none
 * while a skeleton shows. `cameFrom` is where focus was before it entered the container: an element
 * outside it, or null if it came from nowhere. Focus that has moved somewhere else in the meantime
 * stays where it is.
 *
 * It checks after each render of the component that calls it, so call it in the component whose
 * render does the replacing. A descendant that removes its own focused element through its own
 * state isn't covered: focus stays on <body> until the calling component next renders, and only
 * then moves. Spread the returned handlers onto the container.
 */
export function useFocusRecovery(
  findTarget: (container: HTMLElement, cameFrom: HTMLElement | null) => HTMLElement | null | undefined,
) {
  const containerRef = useRef<HTMLElement | null>(null)
  const focusedRef = useRef<Element | null>(null)
  const cameFromRef = useRef<HTMLElement | null>(null)

  // Focus has left the container, or has been moved on from it.
  function forget() {
    focusedRef.current = null
    cameFromRef.current = null
  }

  // No dependency list: any render can be the one that removed the focused element.
  useEffect(() => {
    const focused = focusedRef.current
    if (!focused || focused.isConnected) return
    if (document.activeElement !== document.body) {
      forget()
      return
    }
    const container = containerRef.current
    const target = container?.isConnected ? findTarget(container, cameFromRef.current) : null
    if (!target) return
    forget()
    target.focus({ preventScroll: true })
  })

  return {
    onFocus(event: FocusEvent<HTMLElement>) {
      const { target, relatedTarget, currentTarget } = event
      containerRef.current = currentTarget
      // Entering the container, rather than moving within it or coming back to it with the window.
      const movedWithin = relatedTarget !== null && currentTarget.contains(relatedTarget)
      const cameBack = relatedTarget === null && target === focusedRef.current
      if (!movedWithin && !cameBack) cameFromRef.current = relatedTarget instanceof HTMLElement ? relatedTarget : null
      focusedRef.current = target
    },
    onBlur(event: FocusEvent<HTMLElement>) {
      const { target, relatedTarget, currentTarget } = event
      if (relatedTarget) {
        // Moved to another element. Inside the container, onFocus records it.
        if (!currentTarget.contains(relatedTarget)) forget()
        return
      }
      // Focus went nowhere. After a click on something that can't take focus, forget the element.
      // Keep it while it is still the document's focused element: the window lost focus, and it
      // may be removed before the user is back. Keep it too if it has left the document, in case
      // a removal outside React blurs it (React drops the blur for the removals it makes).
      queueMicrotask(() => {
        const keep = !target.isConnected || document.activeElement === target
        if (!keep && focusedRef.current === target) forget()
      })
    },
  }
}
