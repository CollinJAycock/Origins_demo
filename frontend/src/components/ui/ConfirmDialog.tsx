import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Alert } from './Alert'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Explains the consequences of confirming. */
  children: ReactNode
  confirmLabel: string
  /** Label while `isPending`, e.g. "Deleting…". */
  pendingLabel?: string
  isPending?: boolean
  error?: string
  onConfirm: () => void
  /** Called for Cancel, Escape, and when the dialog closes after `open` turns false. */
  onClose: () => void
  /**
   * Gets focus on close if it would otherwise be lost, as when the trigger has gone in the
   * meantime, like a row that a refresh removed.
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Confirmation for destructive actions, built on the native modal <dialog>: focus is trapped
 * inside, Escape cancels, and focus returns to the trigger on close. Cancel comes first in the
 * DOM so it, not the destructive action, receives initial focus.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  isPending = false,
  error,
  onConfirm,
  onClose,
  fallbackFocusRef,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // A layout effect, so a parent that closes the dialog with flushSync can move focus right after.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => {
        onClose()
        // By now the browser has returned focus to the trigger, or the parent has moved it. If the
        // trigger has gone, focus is instead on <body>, or still on the hidden button that closed
        // the dialog.
        const focused = document.activeElement
        if (!focused || focused === document.body || dialogRef.current?.contains(focused)) {
          fallbackFocusRef?.current?.focus()
        }
      }}
      onCancel={(event) => {
        if (isPending) event.preventDefault()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-6 text-left shadow-xl backdrop:bg-slate-900/40"
    >
      <h2 id={titleId} className="text-lg font-semibold break-words text-slate-900">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 text-sm break-words text-slate-600">
        {children}
      </div>
      {error && <Alert className="mt-4">{error}</Alert>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} pending={isPending}>
          {isPending && pendingLabel ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
