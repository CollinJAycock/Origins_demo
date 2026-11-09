import type { ProblemDetails } from './types'

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Is the API running?"

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

const ERROR_CODES = [
  'event_not_found',
  'registration_not_found',
  'event_in_past',
  'event_full',
  'already_registered',
  'capacity_below_registrations',
] as const

/** Machine-readable `code` values the API puts on 404/409 problem details. */
export type ApiErrorCode = (typeof ERROR_CODES)[number]

interface ApiErrorInit {
  status: number
  message: string
  code?: ApiErrorCode
  fieldErrors?: Record<string, string[]>
  traceId?: string
}

/**
 * The single error type thrown by the API client. `status` is 0 when the server could not be
 * reached; `message` is always safe to show to the user.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | undefined
  /** Validation messages keyed by camelCase field name (empty unless the API returned a 400). */
  readonly fieldErrors: Record<string, string[]>
  readonly traceId: string | undefined

  constructor({ status, message, code, fieldErrors = {}, traceId }: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.traceId = traceId
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Query string parameters; `undefined` and empty-string values are omitted. */
  query?: Record<string, string | number | undefined>
  /** Serialized as JSON. */
  body?: unknown
  signal?: AbortSignal
}

/** Sends a request and resolves with the parsed JSON body. */
export async function requestJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await send(path, options)
  try {
    // The DTO types mirror the API contract, so the body is trusted to match T.
    return (await response.json()) as T
  } catch (error) {
    if (options?.signal?.aborted) throw error
    throw new ApiError({ status: response.status, message: 'The server sent an unexpected response.' })
  }
}

/** Sends a request whose successful response has no body (204 No Content). */
export async function requestVoid(path: string, options?: RequestOptions): Promise<void> {
  await send(path, options)
}

async function send(path: string, { method = 'GET', query, body, signal }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // A cancelled request is not a failure: rethrow so TanStack Query recognises its own abort.
    if (signal?.aborted) throw error
    throw new ApiError({ status: 0, message: NETWORK_ERROR_MESSAGE })
  }

  if (!response.ok) throw await toApiError(response)
  return response
}

function buildUrl(path: string, query: RequestOptions['query'] = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const queryString = params.toString()
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`
}

async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblemDetails(response)
  return new ApiError({
    status: response.status,
    message: problem?.detail ?? problem?.title ?? fallbackMessage(response.status),
    code: ERROR_CODES.find((code) => code === problem?.code),
    fieldErrors: problem?.errors,
    traceId: problem?.traceId,
  })
}

async function readProblemDetails(response: Response): Promise<ProblemDetails | null> {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!/[/+]json\b/i.test(contentType)) return null
  try {
    return parseProblemDetails(await response.json())
  } catch {
    return null
  }
}

/** Reads the fields we use from an untrusted error body, ignoring anything malformed. */
function parseProblemDetails(body: unknown): ProblemDetails | null {
  if (!isRecord(body)) return null
  return {
    type: asString(body.type),
    title: asString(body.title),
    status: typeof body.status === 'number' ? body.status : undefined,
    detail: asString(body.detail),
    code: asString(body.code),
    traceId: asString(body.traceId),
    errors: parseFieldErrors(body.errors),
  }
}

function parseFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined
  const errors: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const strings = messages.filter((message): message is string => typeof message === 'string')
      if (strings.length > 0) errors[field] = strings
    }
  }
  return errors
}

function fallbackMessage(status: number): string {
  // The dev/preview proxy answers 502 when the API is down; gateways use 503/504 similarly.
  if (status === 502 || status === 503 || status === 504) return NETWORK_ERROR_MESSAGE
  if (status === 404) return 'The requested item was not found.'
  if (status >= 500) return 'Something went wrong on the server. Please try again.'
  return `The request failed (status ${status}).`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
