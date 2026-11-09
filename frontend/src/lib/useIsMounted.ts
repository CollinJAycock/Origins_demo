import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable function that tells whether the calling component is still mounted. Check it
 * before navigating once an awaited request settles: the user may have left the page in the
 * meantime (e.g. with browser Back), and React Router's navigate keeps working after unmount, so
 * it would move them a second time.
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return useCallback(() => isMountedRef.current, [])
}
