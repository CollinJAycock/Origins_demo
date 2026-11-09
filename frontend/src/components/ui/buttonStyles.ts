import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md'

export interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

// Pending buttons are aria-disabled rather than disabled (see Button), and look the same.
const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

// `not-disabled:hover` keeps hover styles off disabled buttons while still applying to links.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-xs not-disabled:hover:bg-brand-700',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-xs not-disabled:hover:bg-slate-50 not-disabled:hover:text-slate-900',
  danger: 'bg-rose-600 text-white shadow-xs not-disabled:hover:bg-rose-700',
  'danger-secondary': 'border border-slate-300 bg-white text-rose-700 shadow-xs not-disabled:hover:bg-rose-50',
  ghost: 'text-slate-600 not-disabled:hover:bg-slate-100 not-disabled:hover:text-slate-900',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
}

/** Shared by `Button` and `ButtonLink` so actions and navigation look alike. */
export function buttonStyles({ variant = 'primary', size = 'md', className }: ButtonStyleProps = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}
