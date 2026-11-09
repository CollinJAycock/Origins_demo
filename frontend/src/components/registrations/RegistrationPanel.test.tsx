import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EventStatus } from '../../lib/eventStatus'
import { eventKeys } from '../../queries/keys'
import { makeEvent, makePage, makeRegistration } from '../../test/fixtures'
import { jsonResponse, mockFetch, problemResponse, renderWithProviders } from '../../test/utils'
import { RegistrationPanel } from './RegistrationPanel'

const event = makeEvent({ id: 'evt-1', maxCapacity: 30, registeredCount: 18 })
const open: EventStatus = { kind: 'open', spotsLeft: 12 }

function renderPanel(status: EventStatus = open) {
  return renderWithProviders(<RegistrationPanel event={event} status={status} />)
}

describe('RegistrationPanel', () => {
  it('validates on submit and moves focus to the first invalid field', async () => {
    const fetchSpy = mockFetch(() => jsonResponse({}))
    const { user } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Register' }))

    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toHaveFocus()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Name is required.')
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Email is required.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('waits for a submit before showing errors, then updates them as the user types', async () => {
    mockFetch(() => jsonResponse({}))
    const { user } = renderPanel()
    const email = screen.getByRole('textbox', { name: 'Email' })

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada')
    await user.type(email, 'ada@')
    // Leaving the field must not reveal errors: a message appearing during the click on
    // "Register" would push the button away before the click completes.
    await user.tab()
    expect(email).not.toHaveAttribute('aria-invalid')

    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(email).toHaveAccessibleDescription('Enter a valid email address.')

    await user.type(email, 'example.com')
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('registers with trimmed values and clears the form', async () => {
    const requests: unknown[] = []
    mockFetch(({ method, body }) => {
      requests.push({ method, body })
      return jsonResponse(makeRegistration({ name: 'Grace Hopper', email: 'grace@example.com' }), 201)
    })
    const { user } = renderPanel()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), '  Grace Hopper ')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com ')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(''))
    expect(requests).toEqual([{ method: 'POST', body: { name: 'Grace Hopper', email: 'grace@example.com' } }])
  })

  it('keeps focus on Register while the request runs and ignores repeated presses', async () => {
    let respond: (response: Response) => void = () => {}
    const fetchSpy = mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    )
    const { user } = renderPanel()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    // Unavailable but still focused (a disabled button would drop focus to <body>).
    const pending = screen.getByRole('button', { name: 'Registering…' })
    expect(pending).toHaveAttribute('aria-disabled', 'true')
    expect(pending).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.click(pending)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    respond(jsonResponse(makeRegistration({ name: 'Grace Hopper', email: 'grace@example.com' }), 201))

    const button = await screen.findByRole('button', { name: 'Register' })
    expect(button).not.toHaveAttribute('aria-disabled')
    expect(button).toHaveFocus()
  })

  it('shows "already registered" on the email field', async () => {
    mockFetch(() =>
      problemResponse(409, {
        detail: 'grace@example.com is already registered for this event.',
        code: 'already_registered',
      }),
    )
    const { user } = renderPanel()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    const email = screen.getByRole('textbox', { name: 'Email' })
    await waitFor(() => expect(email).toHaveAccessibleDescription('grace@example.com is already registered for this event.'))
    expect(email).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled()
  })

  it('shows other conflicts in an alert next to the form', async () => {
    mockFetch(() => problemResponse(409, { detail: 'This event is full (30 of 30 spots taken).', code: 'event_full' }))
    const { user } = renderPanel()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This event is full (30 of 30 spots taken).')
  })

  it('refreshes the event and the cached list pages after a conflict', async () => {
    mockFetch(() => problemResponse(409, { detail: 'This event is full (30 of 30 spots taken).', code: 'event_full' }))
    const { user, queryClient } = renderPanel()
    const listKey = eventKeys.list({ status: 'upcoming', search: '', page: 1, pageSize: 12 })
    queryClient.setQueryData(eventKeys.detail('evt-1'), event)
    queryClient.setQueryData(listKey, makePage([event]))

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await screen.findByRole('alert')
    expect(queryClient.getQueryState(eventKeys.detail('evt-1'))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  })

  it.each<[EventStatus, string]>([
    [{ kind: 'past' }, 'Registration is closed'],
    [{ kind: 'full' }, 'This event is full'],
  ])('replaces the form with an explanation when the event is %j', (status, explanation) => {
    renderPanel(status)
    expect(screen.getByText(explanation)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument()
  })

  it('moves focus to the heading when a spot opens up while the notice has focus', () => {
    const queryClient = new QueryClient()
    const panel = (status: EventStatus) => (
      <QueryClientProvider client={queryClient}>
        <RegistrationPanel event={event} status={status} />
      </QueryClientProvider>
    )
    const { rerender } = render(panel({ kind: 'full' }))
    act(() => screen.getByRole('heading', { name: 'This event is full' }).focus())

    rerender(panel(open))

    expect(screen.getByRole('heading', { name: 'Register' })).toHaveFocus()
  })

  it.each([
    [30, 'All 30 spots are taken.'],
    [1, 'The only spot is taken.'],
  ])('says how many spots a full event of capacity %i has', (maxCapacity, sentence) => {
    const fullEvent = makeEvent({ id: 'evt-1', maxCapacity, registeredCount: maxCapacity })
    renderWithProviders(<RegistrationPanel event={fullEvent} status={{ kind: 'full' }} />)
    expect(screen.getByText(`${sentence} A spot opens up if someone unregisters.`)).toBeInTheDocument()
  })
})
