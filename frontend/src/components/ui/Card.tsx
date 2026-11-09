import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article'
}

export function Card({ as: Element = 'div', className, ...props }: CardProps) {
  return <Element className={cn('rounded-xl border border-slate-200 bg-white shadow-xs', className)} {...props} />
}
