import { ApiError, type ApiErrorCode } from '../api/client'
import type { FieldErrors } from './validation'

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/** A user-facing message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR_MESSAGE
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

export interface ServerFormErrors<Field extends string> {
  fieldErrors: FieldErrors<Field>
  /** Message for an alert above the form when the failure is not about one specific field. */
  formError: string | null
}

/**
 * Splits a failed submission into per-field messages and a form-level message.
 * `codeFields` routes conflict codes onto the field they are about (e.g. `already_registered`
 * belongs to the email field).
 */
export function toServerFormErrors<Field extends string>(
  error: unknown,
  fields: readonly Field[],
  codeFields: Partial<Record<ApiErrorCode, Field>> = {},
): ServerFormErrors<Field> {
  if (!(error instanceof ApiError)) return { fieldErrors: {}, formError: getErrorMessage(error) }

  const fieldErrors: FieldErrors<Field> = {}
  const codeField = error.code && codeFields[error.code]
  if (codeField) {
    fieldErrors[codeField] = error.message
    return { fieldErrors, formError: null }
  }

  const unmatched: string[] = []
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const field = fields.find((name) => name.toLowerCase() === key.toLowerCase())
    if (field) fieldErrors[field] ??= messages[0]
    else unmatched.push(...messages)
  }

  const formError =
    unmatched.length > 0 ? unmatched.join(' ') : Object.keys(fieldErrors).length > 0 ? null : error.message
  return { fieldErrors, formError }
}
