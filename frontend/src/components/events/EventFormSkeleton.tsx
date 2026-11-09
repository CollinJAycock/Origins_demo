import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

/** Placeholder for the edit page while the event loads. */
export function EventFormSkeleton() {
  return (
    <div role="status" className="mt-4">
      <span className="sr-only">Loading event…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 mb-6 h-5 w-64" />
      <Card className="space-y-6 p-5 sm:p-6">
        {['w-12', 'w-24', 'w-28'].map((labelWidth) => (
          <div key={labelWidth} className="space-y-2">
            <Skeleton className={`h-4 ${labelWidth}`} />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
