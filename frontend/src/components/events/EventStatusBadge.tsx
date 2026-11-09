import { getStatusLabel, type EventStatus } from '../../lib/eventStatus'
import { Badge, type BadgeTone } from '../ui/Badge'

const TONES: Record<EventStatus['kind'], BadgeTone> = {
  past: 'neutral',
  full: 'danger',
  filling: 'warning',
  open: 'success',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={TONES[status.kind]}>{getStatusLabel(status)}</Badge>
}
