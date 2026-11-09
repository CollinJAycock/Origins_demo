import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

/**
 * The current time, refreshed on every minute boundary so relative times ("in 5 minutes") and
 * time-based states (an event that has just started) stay correct on a page left open.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const scheduleTick = () => {
      timeout = setTimeout(
        () => {
          setNow(new Date())
          scheduleTick()
        },
        MINUTE_MS - (Date.now() % MINUTE_MS),
      )
    }
    scheduleTick()
    return () => clearTimeout(timeout)
  }, [])

  return now
}
