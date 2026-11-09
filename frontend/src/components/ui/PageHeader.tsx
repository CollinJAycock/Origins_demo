import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-balance text-slate-900 outline-none sm:text-3xl"
      >
        {title}
      </h1>
      {description && <p className="mt-1 text-slate-600">{description}</p>}
    </div>
  )
}
