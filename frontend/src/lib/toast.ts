import { useSyncExternalStore } from 'react'

// A tiny global store, so toasts can be raised from anywhere (including after the component
// that triggered them has unmounted, e.g. "Event deleted" after navigating away). The Toaster
// decides how long each toast stays up.

export type ToastTone = 'success' | 'error'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
}

const MAX_VISIBLE = 4

let toasts: readonly Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function setToasts(next: readonly Toast[]) {
  toasts = next
  for (const listener of listeners) listener()
}

function show(tone: ToastTone, message: string) {
  const id = nextId++
  setToasts([...toasts, { id, tone, message }].slice(-MAX_VISIBLE))
}

export function dismissToast(id: number) {
  if (toasts.some((toast) => toast.id === id)) setToasts(toasts.filter((toast) => toast.id !== id))
}

export function dismissAllToasts() {
  setToasts([])
}

/** Success toasts go away after a few seconds; errors stay until dismissed. */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(subscribe, () => toasts)
}
