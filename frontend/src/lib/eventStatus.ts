import type { EventDto } from '../api/types'

export type EventStatus =
  | { kind: 'past' }
  | { kind: 'full' }
  /** Few spots remain: 20% of the capacity or less (rounded up, so the last spot always counts). */
  | { kind: 'filling'; spotsLeft: number }
  | { kind: 'open'; spotsLeft: number }

type StatusInput = Pick<EventDto, 'date' | 'isPast' | 'isFull' | 'availableSpots' | 'maxCapacity'>

const FILLING_RATIO = 0.2

/**
 * The status shown on badges and used to open or close registration. The server's flags are
 * authoritative, but the date is re-checked against `now` so a page left open flips to "past"
 * when the event starts.
 */
export function getEventStatus(event: StatusInput, now: Date): EventStatus {
  if (isEventPast(event, now)) return { kind: 'past' }
  if (event.isFull || event.availableSpots <= 0) return { kind: 'full' }
  const spotsLeft = event.availableSpots
  return spotsLeft <= Math.ceil(event.maxCapacity * FILLING_RATIO)
    ? { kind: 'filling', spotsLeft }
    : { kind: 'open', spotsLeft }
}

export function isEventPast(event: Pick<EventDto, 'date' | 'isPast'>, now: Date): boolean {
  return event.isPast || new Date(event.date).getTime() <= now.getTime()
}

export function getStatusLabel(status: EventStatus): string {
  switch (status.kind) {
    case 'past':
      return 'Past'
    case 'full':
      return 'Full'
    case 'filling':
      return formatSpotsLeft(status.spotsLeft)
    case 'open':
      return 'Open'
  }
}

const numberFormat = new Intl.NumberFormat()

/** "12 spots left", "1 spot left", "No spots left" */
export function formatSpotsLeft(spotsLeft: number): string {
  if (spotsLeft <= 0) return 'No spots left'
  return spotsLeft === 1 ? '1 spot left' : `${numberFormat.format(spotsLeft)} spots left`
}

/** "18 / 30 registered" */
export function formatRegistrations(registeredCount: number, maxCapacity: number): string {
  return `${numberFormat.format(registeredCount)} / ${numberFormat.format(maxCapacity)} registered`
}

/** Share of the capacity taken, as a percentage clamped to 0–100. */
export function getFillPercent(registeredCount: number, maxCapacity: number): number {
  if (maxCapacity <= 0) return 0
  return Math.min(100, Math.max(0, (registeredCount / maxCapacity) * 100))
}
