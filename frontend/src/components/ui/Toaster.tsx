import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { dismissToast, useToasts, type Toast } from '../../lib/toast'
import { useFocusRecovery } from '../../lib/useFocusRecovery'

/** How long a success toast stays up, not counting the time it is paused. */
export const SUCCESS_TOAST_MS = 4000

/** Renders toasts in a polite live region that is always mounted, so additions are announced. */
export function Toaster() {
  const toasts = useToasts()
  // While a toast is under the pointer or holds focus, none of them times out (leaving the window
  // blurs it, though, so they resume). Tracked by id, so a dismissed toast (which may not get a leave
  // or blur event) can't keep the others paused.
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const paused = toasts.some((toast) => toast.id === hoveredId || toast.id === focusedId)
  // A toast can go away while its button has focus: dismissed (from the keyboard, or with a click in
  // browsers that focus buttons on click), pushed out by newer ones, or timed out while the window was
  // in the background (leaving the window doesn't move focus). Focus then goes back to where it was
  // before it entered the toasts (or to the main content), not into another toast, where it would
  // keep them all from timing out.
  const focusRecovery = useFocusRecovery((_region, cameFrom) =>
    cameFrom?.isConnected ? cameFrom : document.querySelector<HTMLElement>('main'),
  )

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      {...focusRecovery}
    >
      {toasts.map((toast) => (
        <ToastMessage
          key={toast.id}
          toast={toast}
          paused={paused}
          onPointerEnter={() => setHoveredId(toast.id)}
          onPointerLeave={() => setHoveredId(null)}
          onFocus={() => setFocusedId(toast.id)}
          onBlur={() => setFocusedId(null)}
        />
      ))}
    </div>
  )
}

interface ToastMessageProps extends HTMLAttributes<HTMLDivElement> {
  toast: Toast
  paused: boolean
}

function ToastMessage({ toast, paused, ...props }: ToastMessageProps) {
  useAutoDismiss(toast, paused)
  const isError = toast.tone === 'error'
  const Icon = isError ? CircleAlert : CircleCheck
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 pr-2 text-sm shadow-lg',
        'motion-safe:transition motion-safe:duration-200 motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0',
      )}
      {...props}
    >
      <Icon className={cn('mt-px size-5 shrink-0', isError ? 'text-rose-600' : 'text-emerald-600')} aria-hidden="true" />
      <p className="min-w-0 flex-1 py-0.5 break-words text-slate-800">
        <span className="sr-only">{isError ? 'Error: ' : 'Success: '}</span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Dismiss notification"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Dismisses a success toast once it has been up, unpaused, for SUCCESS_TOAST_MS. Errors explain
 * what went wrong (e.g. why an unregister was refused), so they stay until the user dismisses them.
 */
function useAutoDismiss({ id, tone }: Toast, paused: boolean) {
  const remainingMsRef = useRef(SUCCESS_TOAST_MS)

  useEffect(() => {
    if (tone === 'error' || paused) return
    const deadline = Date.now() + remainingMsRef.current
    const timeout = setTimeout(() => dismissToast(id), remainingMsRef.current)
    return () => {
      clearTimeout(timeout)
      // Pausing keeps what is left for when the toast resumes.
      remainingMsRef.current = deadline - Date.now()
    }
  }, [id, tone, paused])
}
