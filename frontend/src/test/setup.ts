import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { dismissAllToasts } from '../lib/toast'

// Testing Library only cleans up automatically when test globals are enabled; they are not.
// Toasts live in a module-level store rather than in the rendered tree, so clear them too.
// Tests that fake timers or the clock get the real ones back here, even if they fail part-way.
afterEach(() => {
  cleanup()
  dismissAllToasts()
  vi.useRealTimers()
})

// jsdom has no modal dialog support. Emulate the parts the app relies on, as browsers do them:
// showModal() moves focus into the dialog, close() returns it to what had focus before (if that
// is still there), and the close event follows in a later task.
const focusedBeforeOpening = new WeakMap<HTMLDialogElement, Element | null>()
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  focusedBeforeOpening.set(this, document.activeElement)
  this.open = true
  this.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]')?.focus()
}
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  const focusedBefore = focusedBeforeOpening.get(this)
  if (focusedBefore instanceof HTMLElement && focusedBefore.isConnected) focusedBefore.focus()
  setTimeout(() => this.dispatchEvent(new Event('close')))
}
