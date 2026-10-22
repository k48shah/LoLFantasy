import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import clsx from 'clsx'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: Kind
  text: string
}

interface ToastApi {
  success(text: string): void
  error(text: string): void
  info(text: string): void
  /** Run an async action; toast its failure (or success); report which happened. */
  attempt<T>(fn: () => Promise<T>, successText?: string): Promise<{ ok: true; value: T } | { ok: false }>
}

const Ctx = createContext<ToastApi | null>(null)
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (kind: Kind, text: string) => {
      const id = nextId++
      setItems((l) => [...l.slice(-3), { id, kind, text }])
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (t) => push('success', t),
      error: (t) => push('error', t),
      info: (t) => push('info', t),
      async attempt(fn, successText) {
        try {
          const value = await fn()
          if (successText) push('success', successText)
          return { ok: true as const, value }
        } catch (e) {
          push('error', (e as Error).message || 'Something went wrong.')
          return { ok: false as const }
        }
      },
    }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex max-w-md animate-pop items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur',
              t.kind === 'success' && 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100',
              t.kind === 'error' && 'border-red-400/50 bg-red-950/90 text-red-100',
              t.kind === 'info' && 'border-hex-500/40 bg-ink-800/95 text-hex-300',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast outside ToastProvider')
  return v
}
