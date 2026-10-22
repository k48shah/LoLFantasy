import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Field, PageLoader, Spinner } from './ui'

const RETURN_KEY = 'return-to'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.500 17.700 9.500 24 9.500z" />
      <path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z" />
      <path fill="#FBBC05" d="M10.500 28.700c-.5-1.400-.8-3-.8-4.700s.3-3.200.8-4.700l-7.900-6.100C.900 16.400 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z" />
      <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" />
    </svg>
  )
}

export function AuthCard() {
  const { signInWithGoogle, backend } = useAuth()
  const toast = useToast()
  const demo = backend?.kind === 'demo'
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function go(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await signInWithGoogle(demo ? name.trim() || 'player' : undefined) // production redirects away
    } catch (err) {
      toast.error((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={go} className="panel animate-rise space-y-4 p-6 sm:p-7">
      <div className="text-center">
        <div className="font-display text-xl font-bold text-gold-100">Sign in to play</div>
        <p className="mt-1 text-sm text-slate-400">One click with your Google account. No password to make up or remember.</p>
      </div>

      {demo && (
        <>
          <div className="rounded-lg border border-hex-500/30 bg-hex-500/10 p-3 text-xs text-hex-300">Demo mode — pick any name. Everything runs in your browser.</div>
          <Field label="Your name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="anything" autoFocus />
          </Field>
        </>
      )}

      <button className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow transition hover:bg-slate-100 disabled:opacity-60" disabled={busy}>
        {busy ? <Spinner className="text-slate-700" /> : <GoogleMark />}
        Continue with Google
      </button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-hex-400" />
        <span>Google handles the login. This site only receives your name and email — never your password.</span>
      </p>
    </form>
  )
}

/** Shows children when signed in; otherwise a sign-in card. The page you wanted is remembered across the Google redirect. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const loc = useLocation()
  useEffect(() => {
    if (status !== 'out') return
    try {
      localStorage.setItem(RETURN_KEY, loc.pathname)
    } catch {
      /* ignore */
    }
  }, [status, loc.pathname])
  // Arrived where we wanted to be: forget the bookmark so it never hijacks a later visit.
  useEffect(() => {
    if (status !== 'in') return
    try {
      localStorage.removeItem(RETURN_KEY)
    } catch {
      /* ignore */
    }
  }, [status])

  if (status === 'loading') return <PageLoader />
  if (status === 'out') {
    return (
      <div className="mx-auto max-w-md pt-8">
        <h1 className="mb-1 text-center font-display text-2xl text-gold-100">Sign in to continue</h1>
        <p className="mb-6 text-center text-sm text-slate-400">You'll land right back where you were.</p>
        <AuthCard />
      </div>
    )
  }
  return <>{children}</>
}

export const takeReturnTo = (): string | null => {
  try {
    const v = localStorage.getItem(RETURN_KEY)
    if (v) localStorage.removeItem(RETURN_KEY)
    return v
  } catch {
    return null
  }
}
