import { toast } from '../../lib/toast'
import { useForm } from '../../lib/useForm'
import {
  EMPTY_REGISTRATION_FORM,
  REGISTRATION_FIELDS,
  toRegistrationInput,
  validateRegistrationForm,
} from '../../lib/validation'
import { useRegister } from '../../queries/registrations'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Input } from '../ui/Input'

export function RegistrationForm({ eventId }: { eventId: string }) {
  const register = useRegister(eventId)
  const form = useForm({
    initialValues: EMPTY_REGISTRATION_FORM,
    fields: REGISTRATION_FIELDS,
    validate: validateRegistrationForm,
    codeFields: { already_registered: 'email' },
    onSubmit: async (values, { reset }) => {
      const registration = await register.mutateAsync(toRegistrationInput(values))
      toast.success(`${registration.name} is registered.`)
      reset()
    },
    failureSummary: (values) => `${values.name.trim()} wasn't registered.`,
  })

  return (
    <form noValidate onSubmit={form.handleSubmit} className="space-y-4">
      {form.formError && <Alert>{form.formError}</Alert>}
      <Field label="Name" error={form.errorFor('name')}>
        {(control) => <Input {...control} {...form.fieldProps('name')} autoComplete="name" required />}
      </Field>
      <Field label="Email" error={form.errorFor('email')}>
        {(control) => <Input {...control} {...form.fieldProps('email')} type="email" autoComplete="email" required />}
      </Field>
      <Button type="submit" className="w-full" pending={form.isSubmitting}>
        {form.isSubmitting ? 'Registering…' : 'Register'}
      </Button>
    </form>
  )
}
