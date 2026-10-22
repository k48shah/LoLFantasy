import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Field, PageLoader, Segmented, Spinner } from './ui'

type Mode = 'signin' | 'signup' | 'reset'

export function AuthCard({ initial = 'signup' }: { initial?: Mode }) {
  const { signIn, signUp, sendReset, backend } = useAuth()
  const toast = useToast()
  const demo = backend?.kind === 'demo'
  const [mode, setMode] = useState<Mode>(initial)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (mode === 'signup' && !/^[A-Za-z0-9_-]{2,20}$/.test(username.trim())) return toast.error('Username must be 2–20 letters, numbers, _ or -.')
    if (mode !== 'reset' && !demo && password.length < 6) return toast.error('Password must be at least 6 characters.')
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email.trim(), password)
      else if (mode === 'signup') {
        const r = await signUp(email.trim(), password, username.trim())
        if (r.needsConfirmation) setNotice('We sent you a confirmation link. Click it, then come back and sign in.')
      } else {
        await sendReset(email.trim())
        setNotice('If that email has an account, a reset link is on its way.')
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (notice) {
    return (
      <div className="panel animate-rise p-8 text-center">
        <MailCheck className="mx-auto mb-3 h-10 w-10 text-hex-400" />
        <p className="text-gold-100">{notice}</p>
        <button className="btn-ghost mt-5" onClick={() => { setNotice(null); setMode('signin') }}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="panel animate-rise space-y-4 p-6 sm:p-7">
      {mode !== 'reset' ? (
        <Segmented
          value={mode}
          onChange={setMode}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'signup', label: 'Create account' },
            { value: 'signin', label: 'Sign in' },
          ]}
        />
      ) : (
        <div className="font-display text-lg text-gold-100">Reset your password</div>
      )}

      {demo && <div className="rounded-lg border border-hex-500/30 bg-hex-500/10 p-3 text-xs text-hex-300">Demo mode — type any name, no password needed. Everything runs in your browser.</div>}

      {mode === 'signup' && (
        <Field label="Username" hint="This is the name your friends see.">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="FakerFan99" required />
        </Field>
      )}
      <Field label={demo ? 'Your name' : 'Email'}>
        <input className="input" type={demo ? 'text' : 'email'} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={demo ? 'username' : 'email'} placeholder={demo ? 'anything' : 'you@example.com'} required />
      </Field>
      {mode !== 'reset' && !demo && (
        <Field label="Password">
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required />
        </Field>
      )}

      <button className="btn-gold w-full py-3" disabled={busy}>
        {busy && <Spinner />}
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      {!demo && mode === 'signin' && (
        <button type="button" className="block w-full text-center text-xs text-slate-400 hover:text-gold-200" onClick={() => setMode('reset')}>
          Forgot your password?
        </button>
      )}
      {mode === 'reset' && (
        <button type="button" className="block w-full text-center text-xs text-slate-400 hover:text-gold-200" onClick={() => setMode('signin')}>
          Back to sign in
        </button>
      )}
    </form>
  )
}

/** Shows children when signed in; otherwise a sign-in card (so deep links survive login). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const loc = useLocation()
  // Remember an invite link across sign-up (e.g. when an email confirmation sends them away and back).
  useEffect(() => {
    if (status !== 'out') return
    const m = loc.pathname.match(/^\/join\/([^/]+)/)
    if (m) {
      try {
        localStorage.setItem('pending-join', m[1])
      } catch {
        /* ignore */
      }
    }
  }, [status, loc.pathname])
  if (status === 'loading') return <PageLoader />
  if (status === 'out') {
    return (
      <div className="mx-auto max-w-md pt-8">
        <h1 className="mb-1 text-center font-display text-2xl text-gold-100">Sign in to continue</h1>
        <p className="mb-6 text-center text-sm text-slate-400">You'll land right back where you were.</p>
        <AuthCard initial="signin" />
      </div>
    )
  }
  return <>{children}</>
}
