import { ArrowLeft } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'

export function BackLink({ children, ...props }: LinkProps) {
  return (
    <Link
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900"
      {...props}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}
