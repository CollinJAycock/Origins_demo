import { NotFoundState } from '../components/ui/NotFoundState'
import { PageTitle } from '../components/ui/PageTitle'

export function NotFoundPage() {
  return (
    <>
      <PageTitle>Page not found</PageTitle>
      <NotFoundState title="Page not found" description="The page you're looking for doesn't exist or has moved." />
    </>
  )
}
