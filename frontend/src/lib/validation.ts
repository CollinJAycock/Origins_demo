// Client-side validation mirroring the API's rules, so most mistakes are caught before a round
// trip. The server stays authoritative: its 400 responses are mapped onto the same fields.
import type { EventDto, EventInput, RegistrationInput } from '../api/types'
import { dateTimeLocalToIso, parseDateTimeLocalValue, toDateTimeLocalValue } from './dates'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

export const EVENT_LIMITS = { titleMax: 200, descriptionMax: 2000, capacityMin: 1, capacityMax: 10_000 } as const
export const REGISTRATION_LIMITS = { nameMax: 100, emailMax: 254 } as const

/** Raw values of the event form (inputs always hold strings). */
export interface EventFormValues {
  title: string
  description: string
  /** `datetime-local` value, in local time. */
  date: string
  maxCapacity: string
}

export type EventField = keyof EventFormValues

/** Event form fields in on-screen order. */
export const EVENT_FIELDS = ['title', 'description', 'date', 'maxCapacity'] as const satisfies readonly EventField[]

export const EMPTY_EVENT_FORM: EventFormValues = { title: '', description: '', date: '', maxCapacity: '' }

export function eventToFormValues(event: EventDto): EventFormValues {
  return {
    title: event.title,
    description: event.description ?? '',
    date: toDateTimeLocalValue(event.date),
    maxCapacity: String(event.maxCapacity),
  }
}

interface EventValidationContext {
  now: Date
  /** When editing, capacity may not drop below the registrations already taken. */
  registeredCount?: number
  /**
   * When editing, the event's stored start if it is sent in place of the date field's value. That start is then
   * the one that must be in the future: the field shows it to the minute, which can already have passed.
   */
  keptDate?: string
}

export function validateEventForm(
  values: EventFormValues,
  { now, registeredCount = 0, keptDate }: EventValidationContext,
): FieldErrors<EventField> {
  const errors: FieldErrors<EventField> = {}

  const title = values.title.trim()
  if (!title) errors.title = 'Title is required.'
  else if (title.length > EVENT_LIMITS.titleMax) errors.title = 'Title must be 200 characters or fewer.'

  if (values.description.trim().length > EVENT_LIMITS.descriptionMax) {
    errors.description = 'Description must be 2,000 characters or fewer.'
  }

  if (!values.date) {
    errors.date = 'Date and time are required.'
  } else {
    const date = keptDate !== undefined ? new Date(keptDate) : parseDateTimeLocalValue(values.date)
    if (!date || Number.isNaN(date.getTime())) errors.date = 'Enter a valid date and time.'
    else if (date.getTime() <= now.getTime()) errors.date = 'Event date must be in the future.'
  }

  const capacity = values.maxCapacity.trim()
  if (!capacity) {
    errors.maxCapacity = 'Max capacity is required.'
  } else if (!/^-?\d+$/.test(capacity)) {
    errors.maxCapacity = 'Max capacity must be a whole number.'
  } else {
    const value = Number(capacity)
    if (value < EVENT_LIMITS.capacityMin || value > EVENT_LIMITS.capacityMax) {
      errors.maxCapacity = 'Max capacity must be between 1 and 10,000.'
    } else if (value < registeredCount) {
      errors.maxCapacity = `Max capacity can't be lower than the current number of registrations (${registeredCount}).`
    }
  }

  return errors
}

/** Converts validated form values into the API request body, with `keptDate` (if any) in place of the date field. */
export function toEventInput(values: EventFormValues, keptDate?: string): EventInput {
  const date = keptDate ?? dateTimeLocalToIso(values.date)
  if (!date) throw new Error('toEventInput requires a validated date.')
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    date,
    maxCapacity: Number(values.maxCapacity.trim()),
  }
}

export interface RegistrationFormValues {
  name: string
  email: string
}

export type RegistrationField = keyof RegistrationFormValues

/** Registration form fields in on-screen order. */
export const REGISTRATION_FIELDS = ['name', 'email'] as const satisfies readonly RegistrationField[]

export const EMPTY_REGISTRATION_FORM: RegistrationFormValues = { name: '', email: '' }

// Deliberately loose: one @ with something on both sides, and no spaces. It must not turn away an address the
// API accepts, such as one at a single-label domain (ops@localhost); the API makes the definitive check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

export function validateRegistrationForm(values: RegistrationFormValues): FieldErrors<RegistrationField> {
  const errors: FieldErrors<RegistrationField> = {}

  const name = values.name.trim()
  if (!name) errors.name = 'Name is required.'
  else if (name.length > REGISTRATION_LIMITS.nameMax) errors.name = 'Name must be 100 characters or fewer.'

  const email = values.email.trim()
  if (!email) errors.email = 'Email is required.'
  else if (email.length > REGISTRATION_LIMITS.emailMax) errors.email = 'Email must be 254 characters or fewer.'
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.'

  return errors
}

export function toRegistrationInput(values: RegistrationFormValues): RegistrationInput {
  return { name: values.name.trim(), email: values.email.trim() }
}

export function hasErrors<Field extends string>(errors: FieldErrors<Field>): boolean {
  return Object.values(errors).some(Boolean)
}
