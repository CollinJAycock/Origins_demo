// The API speaks UTC ISO 8601; the UI shows and edits date-times in the browser's time zone.

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Overrides for the browser's locale and time zone. The app uses the defaults; tests pin them. */
export interface FormatOptions {
  locale?: string
  timeZone?: string
}

/** Formats a date as the `YYYY-MM-DDTHH:mm` value of a `datetime-local` input, in local time. */
export function toDateTimeLocalValue(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date
  const pad = (part: number) => String(part).padStart(2, '0')
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}`
  )
}

/** Parses a `datetime-local` value (local time). Returns null when it is empty or malformed. */
export function parseDateTimeLocalValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) return null
  // A date-time string without an offset is parsed as local time.
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Converts a `datetime-local` value (local time) to the UTC ISO string the API expects. */
export function dateTimeLocalToIso(value: string): string | null {
  return parseDateTimeLocalValue(value)?.toISOString() ?? null
}

/** Rounds up to the next whole minute (the granularity of `datetime-local`). */
export function ceilToMinute(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / MINUTE_MS) * MINUTE_MS)
}

/** The browser's IANA time zone, e.g. "Europe/Berlin". */
export function getLocalTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** "Sunday, November 15, 2026 at 6:00 PM EST" */
export function formatEventDateTime(iso: string, options: FormatOptions = {}): string {
  return dateFormat(
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    },
    options,
  ).format(new Date(iso))
}

/** "November 15, 2026" */
export function formatDate(iso: string, options: FormatOptions = {}): string {
  return dateFormat({ dateStyle: 'long' }, options).format(new Date(iso))
}

/** "Sun 6:00 PM" */
export function formatWeekdayAndTime(iso: string, options: FormatOptions = {}): string {
  return dateFormat({ weekday: 'short', hour: 'numeric', minute: '2-digit' }, options).format(new Date(iso))
}

/** "Nov 15, 2026, 6:00 PM" */
export function formatShortDateTime(iso: string, options: FormatOptions = {}): string {
  return dateFormat({ dateStyle: 'medium', timeStyle: 'short' }, options).format(new Date(iso))
}

/** Month and day for a calendar-style date badge, e.g. `{ month: 'Nov', day: '15' }`. */
export function getMonthAndDay(iso: string, options: FormatOptions = {}): { month: string; day: string } {
  const parts = dateFormat({ month: 'short', day: 'numeric' }, options).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { month: part('month'), day: part('day') }
}

// Each unit with its length and the distance from which it is used. Counts are rounded, so a unit takes over
// half a smaller one early: 59.5 minutes reads "in 1 hour", not "in 60 minutes", and 11.5 months "in 1 year".
const RELATIVE_UNITS: ReadonlyArray<readonly [unit: Intl.RelativeTimeFormatUnit, size: number, from: number]> = [
  ['year', 365 * DAY_MS, 345 * DAY_MS],
  ['month', 30 * DAY_MS, 30 * DAY_MS],
  ['day', DAY_MS, 23.5 * HOUR_MS],
  ['hour', HOUR_MS, 59.5 * MINUTE_MS],
  ['minute', MINUTE_MS, MINUTE_MS],
]

/** "in 5 days", "tomorrow", "3 hours ago", "now" — the largest unit that fits, relative to `now`. */
export function formatRelativeTime(iso: string, now: Date, { locale }: FormatOptions = {}): string {
  const date = new Date(iso)
  const diff = date.getTime() - now.getTime()
  const unit = RELATIVE_UNITS.find(([, , from]) => Math.abs(diff) >= from)
  if (!unit) return relativeTimeFormat(locale, 'auto').format(0, 'second')
  const [name, size] = unit
  // Days go by the calendar, so an event tomorrow evening is "tomorrow" at any time today.
  // Only days get "auto" wording: an event 42 days away is "in 1 month", not "next month".
  if (name === 'day') return relativeTimeFormat(locale, 'auto').format(calendarDaysBetween(now, date), 'day')
  return relativeTimeFormat(locale, 'always').format(Math.round(diff / size), name)
}

/** Calendar days from `from` to `to` in local time; rounding absorbs 23- and 25-hour DST days. */
function calendarDaysBetween(from: Date, to: Date): number {
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((midnight(to) - midnight(from)) / DAY_MS)
}

// Intl formatters are comparatively expensive to create, and event grids and long attendee lists reuse a few.
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>()

function dateFormat(format: Intl.DateTimeFormatOptions, { locale, timeZone }: FormatOptions) {
  return cached(dateFormatters, JSON.stringify([locale, timeZone, format]), () =>
    new Intl.DateTimeFormat(locale, { ...format, timeZone }),
  )
}

function relativeTimeFormat(locale: string | undefined, numeric: 'always' | 'auto') {
  return cached(relativeTimeFormatters, JSON.stringify([locale, numeric]), () =>
    new Intl.RelativeTimeFormat(locale, { numeric }),
  )
}

function cached<Value>(cache: Map<string, Value>, key: string, create: () => Value): Value {
  let value = cache.get(key)
  if (value === undefined) {
    value = create()
    cache.set(key, value)
  }
  return value
}
