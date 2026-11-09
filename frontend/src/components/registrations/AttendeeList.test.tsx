import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NETWORK_ERROR_MESSAGE } from '../../api/client'
import { eventKeys } from '../../queries/keys'
import { makeEvent, makeRegistration } from '../../test/fixtures'
import { jsonResponse, mockFetch, problemResponse, renderWithProviders } from '../../test/utils'
import { Toaster } from '../ui/Toaster'
import { AttendeeList } from './AttendeeList'

const ada = makeRegistration({ id: 'reg-1', name: 'Ada Lovelace', email: 'ada@example.com' })
const grace = makeRegistration({ id: 'reg-2', name: 'Grace Hopper', email: 'grace@example.com' })
const eventKey = eventKeys.detail('evt-1')
const pastEventRefusal = { detail: 'Registrations for past events can no longer be changed.', code: 'event_in_past' }

/** Serves the attendee list and holds DELETE requests until the test settles them, oldest first. */
function mockApi(registrations: () => unknown[]) {
  const pendingDeletes: Array<(response: Response) => void> = []
  mockFetch(({ method }) =>
    method === 'DELETE'
      ? new Promise<Response>((resolve) => {
          pendingDeletes.push(resolve)
        })
      : jsonResponse(registrations()),
  )
  return { settleDelete: (response: Response) => pendingDeletes.shift()?.(response) }
}

/** An attendee list that allows unregistering, with the toasts it raises. */
function renderList() {
  return renderWithProviders(
    <>
      <AttendeeList eventId="evt-1" eventTitle="Workshop" isPast={false} />
      <Toaster />
    </>,
  )
}

async function unregister(user: ReturnType<typeof renderWithProviders>['user'], name: string) {
  await user.click(await screen.findByRole('button', { name: `Unregister ${name}` }))
  const dialog = screen.getByRole('dialog', { name: `Unregister ${name}?` })
  await user.click(within(dialog).getByRole('button', { name: 'Unregister' }))
}

describe('AttendeeList', () => {
  it('removes the attendee immediately and keeps them removed once the server confirms', async () => {
    let serverList = [ada, grace]
    const api = mockApi(() => serverList)
    const { user } = renderList()

    await unregister(user, 'Ada Lovelace')

    expect(screen.queryByRole('button', { name: 'Unregister Ada Lovelace' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: /Attendees/ })).toHaveFocus()

    serverList = [grace]
    api.settleDelete(new Response(null, { status: 204 }))
    expect(await screen.findByText('Ada Lovelace was unregistered.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: 'Unregister Ada Lovelace' })).not.toBeInTheDocument()
  })

  it('puts the attendee back and shows the error when the server refuses', async () => {
    const api = mockApi(() => [ada, grace])
    const { user } = renderList()

    await unregister(user, 'Ada Lovelace')
    expect(screen.queryByRole('button', { name: 'Unregister Ada Lovelace' })).not.toBeInTheDocument()

    api.settleDelete(problemResponse(409, pastEventRefusal))

    expect(await screen.findByRole('button', { name: 'Unregister Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(await screen.findByText(pastEventRefusal.detail)).toBeInTheDocument()
  })

  it('reports each of two overlapping unregisters and puts back only the one that failed', async () => {
    let serverList = [ada, grace]
    const api = mockApi(() => serverList)
    const { user, queryClient } = renderList()
    queryClient.setQueryData(eventKey, makeEvent({ id: 'evt-1', maxCapacity: 2, registeredCount: 2 }))

    await unregister(user, 'Ada Lovelace')
    await unregister(user, 'Grace Hopper')

    // Ada's request fails while Grace's is still in flight.
    api.settleDelete(problemResponse(409, pastEventRefusal))
    expect(await screen.findByText(pastEventRefusal.detail)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Unregister Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(queryClient.getQueryData(eventKey)).toMatchObject({ registeredCount: 1, availableSpots: 1, isFull: false })

    serverList = [ada]
    api.settleDelete(new Response(null, { status: 204 }))
    expect(await screen.findByText('Grace Hopper was unregistered.')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Unregister Ada Lovelace' })).toBeInTheDocument()
  })

  it('treats an attendee who was already removed elsewhere as unregistered', async () => {
    let serverList = [ada, grace]
    const api = mockApi(() => serverList)
    const { user, queryClient } = renderList()
    queryClient.setQueryData(eventKey, makeEvent({ id: 'evt-1', maxCapacity: 2, registeredCount: 2 }))

    await unregister(user, 'Ada Lovelace')
    // Someone else removed her first.
    serverList = [grace]
    api.settleDelete(
      problemResponse(404, { detail: "Registration 'reg-1' was not found for this event.", code: 'registration_not_found' }),
    )

    expect(await screen.findByText('Ada Lovelace was already unregistered.')).toBeInTheDocument()
    expect(screen.queryByText(/was not found/)).not.toBeInTheDocument()
    // Nothing to put back: her row and her spot stay gone.
    expect(queryClient.getQueryData(eventKey)).toMatchObject({ registeredCount: 1 })
    expect(screen.queryByRole('button', { name: 'Unregister Ada Lovelace' })).not.toBeInTheDocument()
  })

  it('keeps showing the attendees, with a warning, when a refresh fails', async () => {
    let available = true
    mockFetch(() => (available ? jsonResponse([ada]) : Promise.reject(new TypeError('Failed to fetch'))))
    const { user, queryClient } = renderList()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()

    available = false
    await act(() => queryClient.refetchQueries({ queryKey: eventKeys.registrations('evt-1') }))

    expect(await screen.findByText(/Couldn't refresh the attendee list, so it may be out of date\./)).toHaveTextContent(
      NETWORK_ERROR_MESSAGE,
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()

    available = true
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.queryByText(/Couldn't refresh the attendee list/)).not.toBeInTheDocument())
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    // Retry went with the warning, so focus moves to the list's heading.
    await waitFor(() => expect(screen.getByRole('heading', { name: /Attendees/ })).toHaveFocus())
  })

  it('offers a retry when the attendees fail to load, then moves focus to the heading', async () => {
    let available = false
    mockFetch(() => (available ? jsonResponse([ada]) : Promise.reject(new TypeError('Failed to fetch'))))
    const { user } = renderList()
    expect(await screen.findByText(/Couldn't load attendees\./)).toHaveTextContent(NETWORK_ERROR_MESSAGE)

    available = true
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: /Attendees/ })).toHaveFocus())
  })

  it('returns focus to the Unregister button on cancel', async () => {
    mockApi(() => [ada, grace])
    const { user } = renderList()
    const unregisterAda = await screen.findByRole('button', { name: 'Unregister Ada Lovelace' })

    await user.click(unregisterAda)
    const dialog = screen.getByRole('dialog', { name: 'Unregister Ada Lovelace?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    // The close event comes in a later task.
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(unregisterAda).toHaveFocus()
  })

  it('moves focus to the heading on cancel when a refresh removed the row the dialog was opened from', async () => {
    let serverList = [ada, grace]
    mockApi(() => serverList)
    const { user, queryClient } = renderList()

    await user.click(await screen.findByRole('button', { name: 'Unregister Ada Lovelace' }))
    const dialog = screen.getByRole('dialog', { name: 'Unregister Ada Lovelace?' })
    // Someone else unregisters her meanwhile.
    serverList = [grace]
    await act(() => queryClient.refetchQueries({ queryKey: eventKeys.registrations('evt-1') }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Unregister Ada Lovelace' })).not.toBeInTheDocument())
    // As in Chrome, focus is still on the hidden Cancel button when the close event comes.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: /Attendees/ })).toHaveFocus())
  })

  it('moves focus to the heading on cancel when the event started while the dialog was open', async () => {
    mockApi(() => [ada, grace])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const list = (isPast: boolean) => (
      <QueryClientProvider client={queryClient}>
        <AttendeeList eventId="evt-1" eventTitle="Workshop" isPast={isPast} />
      </QueryClientProvider>
    )
    const { rerender } = render(list(false))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Unregister Ada Lovelace' }))
    const dialog = screen.getByRole('dialog', { name: 'Unregister Ada Lovelace?' })
    // Unregistering is no longer offered, so every Unregister button goes.
    rerender(list(true))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    // Browsers may already have moved focus off the now hidden button when the close event comes.
    const activeElement = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body)
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)))
    activeElement.mockRestore()

    expect(screen.getByRole('heading', { name: /Attendees/ })).toHaveFocus()
  })

  it('offers no unregister action for past events', async () => {
    mockApi(() => [ada])
    renderWithProviders(<AttendeeList eventId="evt-1" eventTitle="Workshop" isPast />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText("Registrations for past events can't be changed.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unregister/ })).not.toBeInTheDocument()
  })
})
