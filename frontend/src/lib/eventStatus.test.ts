import { describe, expect, it } from 'vitest'
import {
  formatRegistrations,
  formatSpotsLeft,
  getEventStatus,
  getFillPercent,
  getStatusLabel,
  type EventStatus,
} from './eventStatus'

const now = new Date('2026-06-01T12:00:00Z')

function statusOf(overrides: Partial<Parameters<typeof getEventStatus>[0]> = {}) {
  return getEventStatus(
    { date: '2026-06-10T12:00:00Z', isPast: false, isFull: false, availableSpots: 12, maxCapacity: 30, ...overrides },
    now,
  )
}

describe('getEventStatus', () => {
  it('is open while plenty of spots remain', () => {
    expect(statusOf()).toEqual({ kind: 'open', spotsLeft: 12 })
  })

  it('is past when the server says so', () => {
    expect(statusOf({ isPast: true })).toEqual({ kind: 'past' })
  })

  it('is past from the start time on, even if the cached flag is stale', () => {
    expect(statusOf({ date: now.toISOString() })).toEqual({ kind: 'past' })
    expect(statusOf({ date: '2026-06-01T12:00:01Z' }).kind).toBe('open')
  })

  it('reports past rather than full for a full event that has started', () => {
    expect(statusOf({ isPast: true, isFull: true, availableSpots: 0 })).toEqual({ kind: 'past' })
  })

  it('is full when no spots are left', () => {
    expect(statusOf({ isFull: true, availableSpots: 0 })).toEqual({ kind: 'full' })
  })

  it('is filling once 20% or fewer of the spots remain', () => {
    expect(statusOf({ availableSpots: 6 })).toEqual({ kind: 'filling', spotsLeft: 6 })
    expect(statusOf({ availableSpots: 7 })).toEqual({ kind: 'open', spotsLeft: 7 })
  })

  it('always treats the last spot as filling, even for tiny events', () => {
    expect(statusOf({ maxCapacity: 3, availableSpots: 1 }).kind).toBe('filling')
    expect(statusOf({ maxCapacity: 3, availableSpots: 2 }).kind).toBe('open')
  })
})

describe('status and capacity labels', () => {
  it.each<[EventStatus, string]>([
    [{ kind: 'past' }, 'Past'],
    [{ kind: 'full' }, 'Full'],
    [{ kind: 'filling', spotsLeft: 3 }, '3 spots left'],
    [{ kind: 'open', spotsLeft: 20 }, 'Open'],
  ])('labels %j as "%s"', (status, label) => {
    expect(getStatusLabel(status)).toBe(label)
  })

  it('pluralizes spots left', () => {
    expect(formatSpotsLeft(12)).toBe('12 spots left')
    expect(formatSpotsLeft(1)).toBe('1 spot left')
    expect(formatSpotsLeft(0)).toBe('No spots left')
  })

  it('formats registrations against capacity', () => {
    expect(formatRegistrations(18, 30)).toBe('18 / 30 registered')
  })

  it('clamps the fill percentage', () => {
    expect(getFillPercent(18, 30)).toBe(60)
    expect(getFillPercent(31, 30)).toBe(100)
    expect(getFillPercent(0, 0)).toBe(0)
  })
})
