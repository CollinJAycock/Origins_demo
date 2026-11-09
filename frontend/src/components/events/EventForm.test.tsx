import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { EventInput } from '../../api/types'
import { toDateTimeLocalValue } from '../../lib/dates'
import { EMPTY_EVENT_FORM, type EventFormValues } from '../../lib/validation'
import { renderWithProviders } from '../../test/utils'
import { EventForm } from './EventForm'

// Noon local time: daylight-saving changes happen at night, so this wall-clock time always maps to
// exactly one instant and the datetime-local round trip in these tests can't shift it by an hour.
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
nextWeek.setHours(12, 0, 0, 0)

function renderForm({
  initialValues = EMPTY_EVENT_FORM,
  registeredCount,
  onSubmit = vi.fn<(input: EventInput) => Promise<void>>().mockResolvedValue(undefined),
}: {
  initialValues?: EventFormValues
  registeredCount?: number
  onSubmit?: (input: EventInput) => Promise<void>
} = {}) {
  const utils = renderWithProviders(
    <EventForm
      initialValues={initialValues}
      registeredCount={registeredCount}
      submitLabel="Create event"
      onSubmit={onSubmit}
      onCancel={vi.fn<() => void>()}
    />,
  )
  return { ...utils, onSubmit }
}

const field = (name: string) => screen.getByLabelText(name, { exact: false })

describe('EventForm', () => {
  it('shows every problem on submit and focuses the first invalid field', async () => {
    const { user, onSubmit } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(field('Title')).toHaveFocus()
    expect(field('Title')).toHaveAccessibleDescription('Title is required.')
    expect(field('Date and time')).toHaveAccessibleDescription(/Date and time are required\./)
    expect(field('Max capacity')).toHaveAccessibleDescription(/Max capacity is required\./)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a start time in the past', async () => {
    const { user } = renderForm()

    await user.type(field('Title'), 'Retro')
    fireEvent.change(field('Date and time'), { target: { value: '2020-01-01T10:00' } })
    await user.type(field('Max capacity'), '10')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(field('Date and time')).toHaveFocus()
    expect(field('Date and time')).toHaveAccessibleDescription(/Event date must be in the future\./)
  })

  it('submits the API payload', async () => {
    const { user, onSubmit } = renderForm()

    await user.type(field('Title'), '  Team offsite ')
    fireEvent.change(field('Date and time'), { target: { value: toDateTimeLocalValue(nextWeek) } })
    await user.type(field('Max capacity'), '40')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      title: 'Team offsite',
      description: null,
      date: nextWeek.toISOString(),
      maxCapacity: 40,
    })
  })

  it('shows server validation errors on their fields and anything else in an alert', async () => {
    const onSubmit = vi.fn<(input: EventInput) => Promise<void>>().mockRejectedValue(
      new ApiError({
        status: 400,
        message: 'One or more validation errors occurred.',
        fieldErrors: { title: ['That title is taken.'], $: ['Unexpected property "extra".'] },
      }),
    )
    const { user } = renderForm({
      onSubmit,
      initialValues: { title: 'Team offsite', description: '', date: toDateTimeLocalValue(nextWeek), maxCapacity: '40' },
    })

    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected property "extra".')
    expect(field('Title')).toHaveAccessibleDescription('That title is taken.')
    expect(field('Title')).toHaveFocus()

    // The server's message no longer applies once the value changes.
    await user.type(field('Title'), '!')
    expect(field('Title')).not.toHaveAttribute('aria-invalid')
  })

  it("explains and enforces the minimum capacity when people are registered", async () => {
    const { user, onSubmit } = renderForm({
      registeredCount: 18,
      initialValues: { title: 'Workshop', description: '', date: toDateTimeLocalValue(nextWeek), maxCapacity: '30' },
    })
    expect(field('Max capacity')).toHaveAccessibleDescription(/At least 18/)

    await user.clear(field('Max capacity'))
    await user.type(field('Max capacity'), '12')
    await user.click(screen.getByRole('button', { name: 'Create event' }))

    expect(field('Max capacity')).toHaveAccessibleDescription(
      /Max capacity can't be lower than the current number of registrations \(18\)\./,
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
