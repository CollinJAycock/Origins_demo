import { NotFoundState } from '../ui/NotFoundState'
import { PageTitle } from '../ui/PageTitle'

/** Shown when the API answers 404 for the event in the URL. */
export function EventNotFound({ backTo = '/' }: { backTo?: string }) {
  return (
    <>
      <PageTitle>Event not found</PageTitle>
      <NotFoundState
        title="Event not found"
        description="This event may have been deleted, or the link is incorrect."
        linkTo={backTo}
      />
    </>
  )
}
