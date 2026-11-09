import { describe, expect, it } from 'vitest'
import {
  ceilToMinute,
  dateTimeLocalToIso,
  formatDate,
  formatEventDateTime,
  formatRelativeTime,
  formatShortDateTime,
  formatWeekdayAndTime,
  getMonthAndDay,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from './dates'

// Pin locale and zone so formatting is the same on every machine.
const EN_UTC = { locale: 'en-US', timeZone: 'UTC' }
// ICU versions differ in which space they put before AM/PM.
const normalizeSpaces = (text: string) => text.replace(/\s/g, ' ')

describe('datetime-local conversion', () => {
  // Expectations are built from local date parts, so they hold in any time zone.
  it('formats a date as a datetime-local value in local time', () => {
    expect(toDateTimeLocalValue(new Date(2026, 10, 5, 9, 7))).toBe('2026-11-05T09:07')
  })

  it('accepts ISO strings and drops seconds', () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 31, 23, 59, 45).toISOString())).toBe('2026-01-31T23:59')
  })

  it('parses a datetime-local value as local time', () => {
    expect(parseDateTimeLocalValue('2026-11-05T09:07')).toEqual(new Date(2026, 10, 5, 9, 7))
  })

  it.each(['', '05/11/2026 09:07', '2026-11-05', '2026-13-45T99:99'])('rejects %j', (value) => {
    expect(parseDateTimeLocalValue(value)).toBeNull()
    expect(dateTimeLocalToIso(value)).toBeNull()
  })

  it('round-trips ISO → datetime-local → ISO at minute precision', () => {
    const iso = new Date(2026, 6, 4, 18, 30).toISOString()
    expect(dateTimeLocalToIso(toDateTimeLocalValue(iso))).toBe(iso)
  })

  it('rounds up to the next whole minute', () => {
    expect(ceilToMinute(new Date('2026-05-01T10:00:01Z')).toISOString()).toBe('2026-05-01T10:01:00.000Z')
    expect(ceilToMinute(new Date('2026-05-01T10:00:00Z')).toISOString()).toBe('2026-05-01T10:00:00.000Z')
  })
})

describe('date formatting', () => {
  const iso = '2026-11-15T18:00:00Z'

  it('formats the full event date and time with a time zone', () => {
    expect(normalizeSpaces(formatEventDateTime(iso, EN_UTC))).toBe('Sunday, November 15, 2026 at 6:00 PM UTC')
  })

  it('formats shorter variants', () => {
    expect(formatDate(iso, EN_UTC)).toBe('November 15, 2026')
    expect(normalizeSpaces(formatWeekdayAndTime(iso, EN_UTC))).toBe('Sun 6:00 PM')
    expect(normalizeSpaces(formatShortDateTime(iso, EN_UTC))).toBe('Nov 15, 2026, 6:00 PM')
    expect(getMonthAndDay(iso, EN_UTC)).toEqual({ month: 'Nov', day: '15' })
  })

  it('uses the given time zone', () => {
    expect(getMonthAndDay('2026-11-15T23:30:00Z', { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toEqual({
      month: 'Nov',
      day: '16',
    })
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-01T12:00:00Z')

  it.each([
    ['2026-06-06T12:00:00Z', 'in 5 days'],
    ['2026-05-29T12:00:00Z', '3 days ago'],
    ['2026-06-01T14:00:00Z', 'in 2 hours'],
    ['2026-06-01T11:15:00Z', '45 minutes ago'],
    ['2026-08-01T12:00:00Z', 'in 2 months'],
    ['2028-06-01T12:00:00Z', 'in 2 years'],
    ['2026-06-01T12:00:20Z', 'now'],
    // On either side of where each unit takes over. Rounded counts that reach the next unit up are given in it.
    ['2026-06-01T12:00:59Z', 'now'],
    ['2026-06-01T12:01:00Z', 'in 1 minute'],
    ['2026-06-01T12:59:24Z', 'in 59 minutes'],
    ['2026-06-01T12:59:36Z', 'in 1 hour'],
    ['2026-06-01T11:00:24Z', '1 hour ago'],
    ['2026-06-02T11:24:00Z', 'in 23 hours'],
    ['2026-06-30T12:00:00Z', 'in 29 days'],
    ['2026-07-01T12:00:00Z', 'in 1 month'],
    ['2027-05-11T12:00:00Z', 'in 11 months'],
    ['2027-05-12T12:00:00Z', 'in 1 year'],
    ['2027-05-31T12:00:00Z', 'in 1 year'],
  ])('describes %s as "%s"', (iso, expected) => {
    expect(formatRelativeTime(iso, now, { locale: 'en-US' })).toBe(expected)
  })

  // Built from local date parts, so these hold in any time zone.
  it.each([
    ['tomorrow', new Date(2026, 10, 9, 8), new Date(2026, 10, 10, 20)],
    ['in 3 days', new Date(2026, 10, 11, 21), new Date(2026, 10, 14, 8)],
    ['yesterday', new Date(2026, 10, 10, 8), new Date(2026, 10, 9, 7)],
    ['2 days ago', new Date(2026, 10, 12, 8), new Date(2026, 10, 10, 20)],
  ])('counts calendar days rather than 24-hour periods ("%s")', (expected, from, date) => {
    expect(formatRelativeTime(date.toISOString(), from, { locale: 'en-US' })).toBe(expected)
  })

  it('describes just under a day ahead as "tomorrow", not "in 24 hours"', () => {
    const date = new Date(2026, 10, 10, 11, 42)
    expect(formatRelativeTime(date.toISOString(), new Date(2026, 10, 9, 12), { locale: 'en-US' })).toBe('tomorrow')
  })
})
