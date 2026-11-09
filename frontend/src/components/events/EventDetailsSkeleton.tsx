import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

/** Mirrors the event details layout while it loads. */
export function EventDetailsSkeleton() {
  return (
    <div role="status" className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <span className="sr-only">Loading event…</span>
      <Card className="p-5 sm:p-6 lg:col-span-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="mt-6 space-y-2 border-t border-slate-200 pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
      <Card className="p-5 sm:p-6 lg:col-start-3 lg:row-start-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-5 h-10" />
        <Skeleton className="mt-4 h-10" />
        <Skeleton className="mt-5 h-10" />
      </Card>
    </div>
  )
}
