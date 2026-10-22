import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Copy, Loader2, X } from 'lucide-react'
import clsx from 'clsx'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} aria-hidden />
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400">
      <div className="hex-clip h-12 w-12 animate-pulse bg-gradient-to-b from-gold-300 to-gold-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-hex-400">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold text-gold-100 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-gold-500/70">{icon}</div>}
      <div className="font-display text-lg text-gold-200">{title}</div>
      {children && <div className="max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="panel flex items-start gap-3 border-red-400/30 p-4 text-sm text-red-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{error.message}</div>
      {retry && (
        <button className="btn-ghost btn-sm" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx('panel max-h-[92vh] w-full animate-pop overflow-y-auto rounded-b-none p-5 outline-none sm:rounded-b-[14px] sm:p-6', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-bold text-gold-100">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: children.props.id ?? id }) : children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 text-left disabled:opacity-50"
    >
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-hex-400 bg-hex-500/40' : 'border-slate-600 bg-ink-700')}>
        <span className={clsx('absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all', checked ? 'left-[22px] bg-hex-300' : 'left-0.5 bg-slate-400')} />
      </span>
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  )
}

export function Segmented<T extends string | number>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={clsx('inline-flex flex-wrap gap-1 rounded-lg border border-gold-400/15 bg-ink-900/70 p-1', className)} role="group">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold transition', o.value === value ? 'bg-gold-400/20 text-gold-100 shadow-[inset_0_0_0_1px_rgba(200,170,110,.5)]' : 'text-slate-400 hover:text-slate-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={clsx('btn-ghost btn-sm', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied!' : label}
    </button>
  )
}
