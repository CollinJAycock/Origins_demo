import { useState, type ChangeEvent, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import type { ApiErrorCode } from '../api/client'
import { toServerFormErrors } from './serverErrors'
import { hasErrors, type FieldErrors } from './validation'

interface UseFormOptions<Field extends string> {
  initialValues: Record<Field, string>
  /** Field names in on-screen order; after a failed submit the first invalid one is focused. */
  fields: readonly Field[]
  validate: (values: Record<Field, string>) => FieldErrors<Field>
  /** API conflict codes that concern a specific field, shown on that field instead of in an alert. */
  codeFields?: Partial<Record<ApiErrorCode, Field>>
  /** Receives valid values. Reject (e.g. with the ApiError) to show the failure on the form. */
  onSubmit: (values: Record<Field, string>, helpers: { reset: () => void }) => Promise<void>
}

/**
 * Small form-state hook for controlled text inputs. Client errors appear on the first submit
 * attempt and then update live as the user types; server errors are mapped onto fields and
 * cleared when that field is edited; focus moves to the first invalid field. Inputs are matched
 * to fields by their `name`.
 *
 * Errors deliberately don't appear on blur: a message rendered while the user is pressing the
 * submit button pushes the button down before mouseup, and that first click is lost.
 */
export function useForm<Field extends string>({
  initialValues,
  fields,
  validate,
  codeFields,
  onSubmit,
}: UseFormOptions<Field>) {
  const [values, setValues] = useState(initialValues)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const clientErrors = validate(values)

  function errorFor(field: Field): string | undefined {
    return serverErrors[field] ?? (submitAttempted ? clientErrors[field] : undefined)
  }

  function focusFirstError(form: HTMLFormElement, errors: FieldErrors<Field>) {
    const field = fields.find((name) => errors[name])
    const element = field === undefined ? null : form.elements.namedItem(field)
    if (element instanceof HTMLElement) element.focus()
  }

  function fieldProps(field: Field) {
    return {
      name: field,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target
        setValues((current) => ({ ...current, [field]: value }))
        // A server message describes the submitted value, so it no longer applies once edited.
        setServerErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
      },
    }
  }

  function reset() {
    setValues(initialValues)
    setSubmitAttempted(false)
    setServerErrors({})
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const form = event.currentTarget

    const errors = validate(values)
    // Commit synchronously so the field that receives focus already exposes its error.
    flushSync(() => {
      setSubmitAttempted(true)
      setServerErrors({})
      setFormError(null)
    })
    if (hasErrors(errors)) {
      focusFirstError(form, errors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values, { reset })
    } catch (error) {
      const server = toServerFormErrors(error, fields, codeFields)
      flushSync(() => {
        setServerErrors(server.fieldErrors)
        setFormError(server.formError)
      })
      focusFirstError(form, server.fieldErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return { values, errorFor, fieldProps, handleSubmit, formError, isSubmitting }
}
