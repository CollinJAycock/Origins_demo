import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void
  /** Drops a pending call. */
  cancel: () => void
}

/**
 * Returns a stable function that calls `callback` once calls have stopped for `delayMs`.
 * The latest `callback` is always used, and a pending call is dropped on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): DebouncedFunction<Args> {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useLayoutEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  return useMemo(() => {
    const debounced = (...args: Args) => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs)
    }
    debounced.cancel = () => clearTimeout(timeoutRef.current)
    return debounced
  }, [delayMs])
}
