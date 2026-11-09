import { describe, expect, it, vi } from 'vitest'
import { makePage, makeRegistration } from '../test/fixtures'
import { jsonResponse, mockFetch, problemResponse } from '../test/utils'
import { ApiError, NETWORK_ERROR_MESSAGE } from './client'
import { deleteEvent, listEvents } from './events'
import { createRegistration } from './registrations'

describe('API client requests', () => {
  it('builds the query string and leaves out empty values', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(makePage([])))
    await listEvents({ status: 'upcoming', search: '', page: 2, pageSize: 12 })
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/events?status=upcoming&page=2&pageSize=12')
  })

  it('sends bodies as JSON and returns the parsed response', async () => {
    const registration = makeRegistration()
    const fetchSpy = mockFetch(() => jsonResponse(registration, 201))

    await expect(createRegistration('evt 1', { name: 'Ada', email: 'ada@example.com' })).resolves.toEqual(registration)

    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(url).toBe('/api/events/evt%201/registrations')
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
  })

  it('passes the abort signal through to fetch', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(makePage([])))
    const controller = new AbortController()
    await listEvents({ status: 'all', search: 'x', page: 1, pageSize: 12 }, controller.signal)
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })

  it('resolves 204 No Content with undefined', async () => {
    mockFetch(() => new Response(null, { status: 204 }))
    await expect(deleteEvent('evt-1')).resolves.toBeUndefined()
  })
})

describe('API client errors', () => {
  it('turns problem details into an ApiError with status, code and detail', async () => {
    mockFetch(() =>
      problemResponse(409, { title: 'Conflict', detail: 'This event is full (30 of 30 spots taken).', code: 'event_full' }),
    )
    const error = await createRegistration('evt-1', { name: 'Ada', email: 'ada@example.com' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'event_full',
      message: 'This event is full (30 of 30 spots taken).',
      traceId: '00-test',
      fieldErrors: {},
    })
  })

  it('exposes validation messages by field', async () => {
    mockFetch(() =>
      problemResponse(400, {
        title: 'One or more validation errors occurred.',
        errors: { name: ['Name is required.'], email: ['Enter a valid email address.', 42] },
      }),
    )
    await expect(createRegistration('evt-1', { name: '', email: 'x' })).rejects.toMatchObject({
      status: 400,
      message: 'One or more validation errors occurred.',
      fieldErrors: { name: ['Name is required.'], email: ['Enter a valid email address.'] },
    })
  })

  it('ignores error codes it does not know', async () => {
    mockFetch(() => problemResponse(409, { detail: 'Nope.', code: 'something_new' }))
    await expect(deleteEvent('evt-1')).rejects.toMatchObject({ status: 409, code: undefined, message: 'Nope.' })
  })

  it('reports a network failure as status 0 with a helpful message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(deleteEvent('evt-1')).rejects.toMatchObject({ status: 0, message: NETWORK_ERROR_MESSAGE })
  })

  it('treats a bodiless gateway error from the dev proxy as an unreachable API', async () => {
    mockFetch(() => new Response('', { status: 502, headers: { 'Content-Type': 'text/plain' } }))
    await expect(deleteEvent('evt-1')).rejects.toMatchObject({ status: 502, message: NETWORK_ERROR_MESSAGE })
  })

  it('falls back to a generic message when the body is not problem details', async () => {
    mockFetch(() => new Response('<h1>Oops</h1>', { status: 500, headers: { 'Content-Type': 'text/html' } }))
    await expect(deleteEvent('evt-1')).rejects.toMatchObject({
      status: 500,
      message: 'Something went wrong on the server. Please try again.',
    })
  })

  it('rethrows cancellations untouched so they are not reported as failures', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    await expect(
      listEvents({ status: 'all', search: '', page: 1, pageSize: 12 }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
