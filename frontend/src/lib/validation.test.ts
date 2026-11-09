import { describe, expect, it } from 'vitest'
import { toDateTimeLocalValue } from './dates'
import {
  toEventInput,
  toRegistrationInput,
  validateEventForm,
  validateRegistrationForm,
  type EventFormValues,
} from './validation'

// Local times, so the datetime-local values below mean the same thing in any time zone.
const now = new Date(2026, 5, 1, 12, 0)
const tomorrow = toDateTimeLocalValue(new Date(2026, 5, 2, 9, 30))
const valid: EventFormValues = { title: 'Team offsite', description: '', date: tomorrow, maxCapacity: '25' }

const validate = (changes: Partial<EventFormValues>, registeredCount?: number) =>
  validateEventForm({ ...valid, ...changes }, { now, registeredCount })

describe('validateEventForm', () => {
  it('accepts valid values', () => {
    expect(validate({})).toEqual({})
  })

  it('requires a title', () => {
    expect(validate({ title: '   ' }).title).toBe('Title is required.')
  })

  it('limits the title to 200 characters, ignoring surrounding whitespace', () => {
    expect(validate({ title: 'a'.repeat(201) }).title).toBe('Title must be 200 characters or fewer.')
    expect(validate({ title: ` ${'a'.repeat(200)} ` }).title).toBeUndefined()
  })

  it('limits the description to 2,000 characters', () => {
    expect(validate({ description: 'a'.repeat(2001) }).description).toBe('Description must be 2,000 characters or fewer.')
    expect(validate({ description: 'a'.repeat(2000) }).description).toBeUndefined()
  })

  it('requires a valid date', () => {
    expect(validate({ date: '' }).date).toBe('Date and time are required.')
    expect(validate({ date: 'next friday' }).date).toBe('Enter a valid date and time.')
  })

  it('requires the date to be in the future', () => {
    expect(validate({ date: toDateTimeLocalValue(now) }).date).toBe('Event date must be in the future.')
    expect(validate({ date: '2020-01-01T10:00' }).date).toBe('Event date must be in the future.')
  })

  it.each(['', '  '])('requires a capacity (%j)', (maxCapacity) => {
    expect(validate({ maxCapacity }).maxCapacity).toBe('Max capacity is required.')
  })

  it.each(['2.5', 'ten', '1e3'])('requires a whole-number capacity (%j)', (maxCapacity) => {
    expect(validate({ maxCapacity }).maxCapacity).toBe('Max capacity must be a whole number.')
  })

  it.each(['0', '-3', '10001'])('requires a capacity between 1 and 10,000 (%j)', (maxCapacity) => {
    expect(validate({ maxCapacity }).maxCapacity).toBe('Max capacity must be between 1 and 10,000.')
  })

  it('accepts the capacity bounds', () => {
    expect(validate({ maxCapacity: '1' }).maxCapacity).toBeUndefined()
    expect(validate({ maxCapacity: '10000' }).maxCapacity).toBeUndefined()
  })

  it("won't lower the capacity below the registrations already taken", () => {
    expect(validate({ maxCapacity: '17' }, 18).maxCapacity).toBe(
      "Max capacity can't be lower than the current number of registrations (18).",
    )
    expect(validate({ maxCapacity: '18' }, 18).maxCapacity).toBeUndefined()
  })
})

describe('toEventInput', () => {
  it('trims text, sends an empty description as null and the date as UTC ISO', () => {
    expect(toEventInput({ title: '  Team offsite ', description: '   ', date: tomorrow, maxCapacity: ' 25 ' })).toEqual({
      title: 'Team offsite',
      description: null,
      date: new Date(2026, 5, 2, 9, 30).toISOString(),
      maxCapacity: 25,
    })
  })
})

describe('validateRegistrationForm', () => {
  it('accepts a name and a valid email', () => {
    expect(validateRegistrationForm({ name: 'Ada Lovelace', email: ' ada@example.com ' })).toEqual({})
  })

  it('requires both fields', () => {
    expect(validateRegistrationForm({ name: ' ', email: '' })).toEqual({
      name: 'Name is required.',
      email: 'Email is required.',
    })
  })

  it.each(['ada', 'ada@', '@example.com', 'ada@example', 'ada lovelace@example.com'])('rejects %j', (email) => {
    expect(validateRegistrationForm({ name: 'Ada', email }).email).toBe('Enter a valid email address.')
  })

  it('limits the lengths', () => {
    expect(validateRegistrationForm({ name: 'a'.repeat(101), email: `${'a'.repeat(250)}@x.io` })).toEqual({
      name: 'Name must be 100 characters or fewer.',
      email: 'Email must be 254 characters or fewer.',
    })
  })

  it('trims the values it sends', () => {
    expect(toRegistrationInput({ name: ' Ada ', email: ' ada@example.com ' })).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
    })
  })
})
