import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { shouldRetry } from './queryClient'

const apiError = (status: number) => new ApiError({ status, message: 'x' })

describe('shouldRetry', () => {
  it.each([400, 404, 409])('never retries a %i', (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(false)
  })

  it.each([0, 500, 502])('retries a %i at most twice', (status) => {
    expect(shouldRetry(0, apiError(status))).toBe(true)
    expect(shouldRetry(1, apiError(status))).toBe(true)
    expect(shouldRetry(2, apiError(status))).toBe(false)
  })
})
