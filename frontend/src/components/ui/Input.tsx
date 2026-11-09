import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

// text-base below the sm breakpoint stops iOS Safari from zooming in when a control is focused.
const CONTROL =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-xs sm:text-sm ' +
  'placeholder:text-slate-500 focus-visible:border-brand-600 focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus-visible:outline-rose-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'py-2', className)} {...props} />
}
