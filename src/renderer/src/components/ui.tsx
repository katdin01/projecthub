import { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }): React.JSX.Element {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-700',
        variant === 'secondary' && 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={clsx(
        'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={clsx(
        'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={clsx(
        'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400',
        className
      )}
      {...props}
    />
  )
}

export function Label({ children }: { children: ReactNode }): React.JSX.Element {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>
}

export function Field({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }): React.JSX.Element {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }): React.JSX.Element {
  return <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
}

const healthColors: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700'
}

export function Badge({
  children,
  tone = 'slate'
}: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange'
}): React.JSX.Element {
  const toneClass =
    tone === 'green'
      ? healthColors.green
      : tone === 'yellow'
        ? healthColors.yellow
        : tone === 'red'
          ? healthColors.red
          : tone === 'blue'
            ? 'bg-blue-100 text-blue-700'
            : tone === 'purple'
              ? 'bg-purple-100 text-purple-700'
              : tone === 'orange'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-700'
  return <span className={clsx('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', toneClass)}>{children}</span>
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-16" onClick={onClose}>
      <div
        className={clsx('max-h-[80vh] overflow-y-auto rounded-lg bg-white p-5 shadow-xl', wide ? 'w-[42rem]' : 'w-[28rem]')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{children}</div>
}
