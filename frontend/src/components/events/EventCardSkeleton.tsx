import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

/** Mirrors the layout of EventCard so the grid doesn't jump when data arrives. */
export function EventCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex gap-4">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
      </div>
      <div className="mt-auto pt-5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      </div>
    </Card>
  )
}
