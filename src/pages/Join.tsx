import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { StatusPill } from '../components/game'
import { EmptyState, ErrorBox, PageLoader, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useQuery } from '../lib/hooks'
import { useToast } from '../lib/toast'

export function JoinPage() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const preview = useQuery(() => api.preview(code), [code])

  useEffect(() => {
    try {
      localStorage.removeItem('pending-join')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (preview.data?.already_member) nav(`/league/${preview.data.id}`, { replace: true })
  }, [preview.data, nav])

  if (preview.loading) return <PageLoader label="Looking up that league…" />
  if (preview.error) return <div className="mx-auto max-w-lg"><ErrorBox error={preview.error} retry={preview.reload} /></div>

  const p = preview.data
  if (!p) {
    return (
      <div className="panel mx-auto max-w-lg">
        <EmptyState title="League not found">
          No league uses the code <b className="text-gold-100">{code.toUpperCase()}</b>. Double-check the link with whoever invited you.
          <div className="mt-4">
            <Link to="/" className="btn-ghost">Back home</Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  const full = p.members >= p.max_members
  const started = p.status !== 'lobby'

  return (
    <div className="panel mx-auto max-w-lg animate-rise p-8 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hex-400">You're invited to</div>
      <h1 className="mt-2 font-display text-3xl font-bold text-gold-100">{p.name}</h1>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm text-slate-400">
        <StatusPill status={p.status} />
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {p.members}/{p.max_members}
        </span>
        <span>hosted by <b className="text-gold-100">{p.owner}</b></span>
      </div>
      <div className="divider my-6" />
      {started || full ? (
        <p className="text-sm text-slate-400">{started ? 'The draft for this league has already started, so it\'s closed to new managers.' : 'This league is full.'}</p>
      ) : (
        <button
          className="btn-gold w-full py-3 text-base"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await toast.attempt(() => api.join(code), `Welcome to ${p.name}!`)
            setBusy(false)
            if (res.ok) nav(`/league/${res.value}`)
          }}
        >
          {busy && <Spinner />} Join league
        </button>
      )}
    </div>
  )
}
