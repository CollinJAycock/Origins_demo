import { requestJson, requestVoid } from './client'
import { eventPath } from './events'
import type { RegistrationDto, RegistrationInput } from './types'

const registrationsPath = (eventId: string) => `${eventPath(eventId)}/registrations`

/** Registrations of an event, ordered by registration time (oldest first). */
export function listRegistrations(eventId: string, signal?: AbortSignal) {
  return requestJson<RegistrationDto[]>(registrationsPath(eventId), { signal })
}

export function createRegistration(eventId: string, input: RegistrationInput) {
  return requestJson<RegistrationDto>(registrationsPath(eventId), { method: 'POST', body: input })
}

export function deleteRegistration(eventId: string, registrationId: string) {
  return requestVoid(`${registrationsPath(eventId)}/${encodeURIComponent(registrationId)}`, {
    method: 'DELETE',
  })
}
