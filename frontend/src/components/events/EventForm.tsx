import type { EventInput } from '../../api/types'
import { ceilToMinute, getLocalTimeZone, toDateTimeLocalValue } from '../../lib/dates'
import { useForm } from '../../lib/useForm'
import { useNow } from '../../lib/useNow'
import {
  EVENT_FIELDS,
  EVENT_LIMITS,
  toEventInput,
  validateEventForm,
  type EventFormValues,
} from '../../lib/validation'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { CharacterCount, Field } from '../ui/Field'
import { Input, Textarea } from '../ui/Input'

interface EventFormProps {
  initialValues: EventFormValues
  /**
   * The event's stored start (edit only), checked and sent as is while the date field still shows it. The field
   * holds local time to the minute, so converting it back could move the start: it drops seconds, and when the
   * clocks go back it reads the repeated hour as its first occurrence.
   */
  originalDate?: string
  /** Registrations already taken (edit only): the capacity can't go below this. */
  registeredCount?: number
  submitLabel: string
  /** Should reject with the API error on failure so it can be shown on the form. */
  onSubmit: (input: EventInput) => Promise<void>
  /** What a failed submit didn't do, e.g. "“Team offsite” wasn't created.", for a toast if the form has gone by then. */
  failureSummary: (values: EventFormValues) => string
  onCancel: () => void
}

/** Create/edit form for an event. */
export function EventForm({
  initialValues,
  originalDate,
  registeredCount = 0,
  submitLabel,
  onSubmit,
  failureSummary,
  onCancel,
}: EventFormProps) {
  const now = useNow()
  // The stored start, while the date field still shows it.
  const keptDateFor = (values: EventFormValues) =>
    originalDate !== undefined && values.date === initialValues.date ? originalDate : undefined
  const form = useForm({
    initialValues,
    fields: EVENT_FIELDS,
    validate: (values) => validateEventForm(values, { now, registeredCount, keptDate: keptDateFor(values) }),
    codeFields: { capacity_below_registrations: 'maxCapacity' },
    onSubmit: (values) => onSubmit(toEventInput(values, keptDateFor(values))),
    failureSummary,
  })
  const minCapacity = Math.max(EVENT_LIMITS.capacityMin, registeredCount)

  return (
    <form noValidate onSubmit={form.handleSubmit} className="space-y-6">
      {form.formError && <Alert>{form.formError}</Alert>}

      <Field
        label="Title"
        error={form.errorFor('title')}
        aside={<CharacterCount length={form.values.title.trim().length} max={EVENT_LIMITS.titleMax} />}
      >
        {(control) => <Input {...control} {...form.fieldProps('title')} required autoComplete="off" />}
      </Field>

      <Field
        label="Description"
        optional
        error={form.errorFor('description')}
        aside={<CharacterCount length={form.values.description.trim().length} max={EVENT_LIMITS.descriptionMax} />}
      >
        {(control) => <Textarea {...control} {...form.fieldProps('description')} rows={5} />}
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Date and time" hint={`In your time zone (${getLocalTimeZone()}).`} error={form.errorFor('date')}>
          {(control) => (
            <Input
              {...control}
              {...form.fieldProps('date')}
              type="datetime-local"
              min={toDateTimeLocalValue(ceilToMinute(now))}
              required
            />
          )}
        </Field>

        <Field
          label="Max capacity"
          hint={
            registeredCount > 0
              ? `At least ${registeredCount.toLocaleString()}, the number of people already registered.`
              : 'Between 1 and 10,000 attendees.'
          }
          error={form.errorFor('maxCapacity')}
        >
          {(control) => (
            <Input
              {...control}
              {...form.fieldProps('maxCapacity')}
              type="number"
              inputMode="numeric"
              min={minCapacity}
              max={EVENT_LIMITS.capacityMax}
              step={1}
              required
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={form.isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" pending={form.isSubmitting}>
          {form.isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
