import type { EventDto, PagedResult, RegistrationDto } from '../api/types'

const DAY_MS = 24 * 60 * 60 * 1000

/** ISO date `days` from now (negative for the past). */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

export function makeEvent(overrides: Partial<EventDto> = {}): EventDto {
  const maxCapacity = overrides.maxCapacity ?? 30
  const registeredCount = overrides.registeredCount ?? 18
  return {
    id: 'evt-1',
    title: 'Intro to ASP.NET Core',
    description: 'A hands-on workshop.',
    date: daysFromNow(5),
    createdAt: daysFromNow(-10),
    updatedAt: daysFromNow(-10),
    isPast: false,
    availableSpots: maxCapacity - registeredCount,
    isFull: registeredCount >= maxCapacity,
    ...overrides,
    maxCapacity,
    registeredCount,
  }
}

export function makeRegistration(overrides: Partial<RegistrationDto> = {}): RegistrationDto {
  return {
    id: 'reg-1',
    eventId: 'evt-1',
    name: 'Ada Lovelace',
    email: 'ada.lovelace@example.com',
    registeredAt: daysFromNow(-1),
    ...overrides,
  }
}

export function makePage<T>(items: T[], overrides: Partial<PagedResult<T>> = {}): PagedResult<T> {
  return {
    items,
    page: 1,
    pageSize: 12,
    totalCount: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  }
}
