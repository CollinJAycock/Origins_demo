import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { getErrorMessage, toServerFormErrors } from './serverErrors'

const fields = ['title', 'date', 'maxCapacity'] as const

describe('toServerFormErrors', () => {
  it('maps validation errors onto fields by name', () => {
    const error = new ApiError({
      status: 400,
      message: 'One or more validation errors occurred.',
      fieldErrors: { title: ['Title is required.', 'Second message'], MaxCapacity: ['Too small.'] },
    })
    expect(toServerFormErrors(error, fields)).toEqual({
      fieldErrors: { title: 'Title is required.', maxCapacity: 'Too small.' },
      formError: null,
    })
  })

  it('puts messages for unknown fields in the form-level error', () => {
    const error = new ApiError({
      status: 400,
      message: 'One or more validation errors occurred.',
      fieldErrors: { date: ['Event date must be in the future.'], $: ['The JSON is invalid.'] },
    })
    expect(toServerFormErrors(error, fields)).toEqual({
      fieldErrors: { date: 'Event date must be in the future.' },
      formError: 'The JSON is invalid.',
    })
  })

  it('routes conflict codes onto their field', () => {
    const error = new ApiError({
      status: 409,
      code: 'capacity_below_registrations',
      message: "Max capacity can't be lower than the current number of registrations (18).",
    })
    expect(toServerFormErrors(error, fields, { capacity_below_registrations: 'maxCapacity' })).toEqual({
      fieldErrors: { maxCapacity: "Max capacity can't be lower than the current number of registrations (18)." },
      formError: null,
    })
  })

  it('falls back to the error message when nothing maps to a field', () => {
    const error = new ApiError({ status: 409, code: 'event_in_past', message: "Past events can't be edited." })
    expect(toServerFormErrors(error, fields)).toEqual({ fieldErrors: {}, formError: "Past events can't be edited." })
  })

  it('handles errors that did not come from the API', () => {
    expect(toServerFormErrors(new Error('Boom'), fields)).toEqual({ fieldErrors: {}, formError: 'Boom' })
    expect(toServerFormErrors('???', fields).formError).toBe('Something went wrong. Please try again.')
  })
})

describe('getErrorMessage', () => {
  it('uses the message of an Error and a generic text otherwise', () => {
    expect(getErrorMessage(new ApiError({ status: 0, message: 'Offline' }))).toBe('Offline')
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.')
  })
})
