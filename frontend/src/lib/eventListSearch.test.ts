import { describe, expect, it } from 'vitest'
import { parseEventListSearch, toEventListQuery } from './eventListSearch'

const parse = (query: string) => parseEventListSearch(new URLSearchParams(query))

describe('event list URL state', () => {
  it('defaults to upcoming events, no search, page 1', () => {
    expect(parse('')).toEqual({ status: 'upcoming', q: '', page: 1 })
  })

  it('reads valid values (status case-insensitively)', () => {
    expect(parse('status=PAST&q=+night+&page=3')).toEqual({ status: 'past', q: 'night', page: 3 })
    expect(parse('page=2147483647').page).toBe(2147483647)
  })

  it('falls back to defaults for invalid values', () => {
    expect(parse('status=soon&page=0')).toEqual({ status: 'upcoming', q: '', page: 1 })
    expect(parse('page=2.5').page).toBe(1)
    expect(parse('page=abc').page).toBe(1)
    // Beyond the API's 32-bit page numbers, which it would reject with a 400.
    expect(parse('page=99999999999').page).toBe(1)
  })

  it('caps the search term at the length the API accepts', () => {
    expect(parse(`q=${'a'.repeat(150)}`).q).toHaveLength(100)
  })

  it('writes only non-default values', () => {
    expect(toEventListQuery({ status: 'upcoming', q: '', page: 1 })).toBe('')
    expect(toEventListQuery({ status: 'all', q: 'ada lovelace', page: 2 })).toBe('?status=all&q=ada+lovelace&page=2')
  })
})
