import { useState } from 'react'
import clsx from 'clsx'
import { ArrowLeftRight, Check, Handshake, X } from 'lucide-react'
import { PlayerCell, RoleBadge } from '../../components/game'
import { EmptyState, ErrorBox, Skeleton, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { useDirectory } from '../../lib/directory'
import { fmtDateTime } from '../../lib/format'
import { useQuery } from '../../lib/hooks'
import { useToast } from '../../lib/toast'
import type { Trade } from '../../lib/types'
import { useLeague } from './context'

export function Trades() {
  const { id, overview: o, reload } = useLeague()
  const dir = useDirectory()
  const toast = useToast()
  const rosters = useQuery(() => api.rosters(id), [id], { poll: 30_000 })
  const trades = useQuery(() => api.trades(id), [id], { poll: 20_000 })
  const [give, setGive] = useState<string | null>(null)
  const [targetUser, setTargetUser] = useState<string | null>(null)
  const [get, setGet] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (o.league.status !== 'active') {
    return (
      <div className="panel">
        <EmptyState icon={<Handshake className="h-10 w-10" />} title="Trades open after the draft">
          When everyone has a full roster you can swap players with other managers. Points always stay with whoever owned a player when the game was played.
        </EmptyState>
      </div>
    )
  }
  const err = rosters.error ?? trades.error
  if (err && (!rosters.data || !trades.data)) return <ErrorBox error={err} retry={() => { void rosters.reload(); void trades.reload() }} />
  if (!rosters.data || !trades.data) return <Skeleton className="h-64" />

  const current = rosters.data.filter((s) => !s.released_at)
  const names = new Map(o.members.map((m) => [m.user_id, m.username]))
  const mine = current.filter((s) => s.user_id === o.me)
  const theirs = current.filter((s) => s.user_id === targetUser)
  const others = o.members.filter((m) => m.user_id !== o.me)

  const incoming = trades.data.filter((t) => t.status === 'pending' && t.recipient_id === o.me)
  const outgoing = trades.data.filter((t) => t.status === 'pending' && t.proposer_id === o.me)
  const history = trades.data.filter((t) => t.status !== 'pending').slice(0, 12)

  async function refresh() {
    await Promise.all([rosters.reload(), trades.reload()])
    reload()
  }
  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key)
    const res = await toast.attempt(fn, ok)
    setBusy(null)
    await refresh()
    return res.ok
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel space-y-4 p-5">
        <h2 className="panel-title flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" /> Propose a trade
        </h2>

        <div>
          <div className="label">You give</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {mine.map((s) => (
              <Choice key={s.spot_id} selected={give === s.player_id} onClick={() => setGive(s.player_id)}>
                <PlayerCell player={dir.byId.get(s.player_id)} size={30} />
                {dir.byId.get(s.player_id) && <RoleBadge role={dir.byId.get(s.player_id)!.role} compact />}
              </Choice>
            ))}
          </div>
        </div>

        <div>
          <div className="label">You get — from</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {others.map((m) => (
              <button
                key={m.user_id}
                onClick={() => {
                  setTargetUser(m.user_id)
                  setGet(null)
                }}
                className={clsx('rounded-full border px-3 py-1 text-xs font-bold transition', targetUser === m.user_id ? 'border-gold-400 bg-gold-400/20 text-gold-100' : 'border-gold-400/20 text-slate-400 hover:text-gold-100')}
              >
                {m.username}
              </button>
            ))}
          </div>
          {targetUser ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {theirs.map((s) => (
                <Choice key={s.spot_id} selected={get === s.player_id} onClick={() => setGet(s.player_id)}>
                  <PlayerCell player={dir.byId.get(s.player_id)} size={30} />
                  {dir.byId.get(s.player_id) && <RoleBadge role={dir.byId.get(s.player_id)!.role} compact />}
                </Choice>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Pick a manager to see their roster.</p>
          )}
        </div>

        <button
          className="btn-gold w-full py-3"
          disabled={!give || !get || busy !== null}
          onClick={async () => {
            if (!give || !get) return
            const done = await act('propose', () => api.proposeTrade(id, give, get), 'Trade offer sent!')
            if (done) {
              setGive(null)
              setGet(null)
            }
          }}
        >
          {busy === 'propose' && <Spinner />} Send offer
        </button>
        <p className="text-xs text-slate-500">Each roster must still have a player at all five roles after the swap.</p>
      </section>

      <div className="space-y-6">
        <TradeList title="Offers for you" empty="No offers right now." trades={incoming} names={names}
          actions={(t) => (
            <>
              <button className="btn-hex btn-sm" disabled={busy !== null} onClick={() => void act(t.id, () => api.respondTrade(t.id, true), 'Trade accepted!')}><Check className="h-3.5 w-3.5" /> Accept</button>
              <button className="btn-danger btn-sm" disabled={busy !== null} onClick={() => void act(t.id, () => api.respondTrade(t.id, false), 'Offer declined.')}><X className="h-3.5 w-3.5" /> Decline</button>
            </>
          )} />
        <TradeList title="Your offers" empty="You have no pending offers." trades={outgoing} names={names}
          actions={(t) => <button className="btn-ghost btn-sm" disabled={busy !== null} onClick={() => void act(t.id, () => api.cancelTrade(t.id), 'Offer cancelled.')}>Cancel</button>} />
        {history.length > 0 && <TradeList title="History" empty="" trades={history} names={names} showStatus />}
      </div>
    </div>
  )
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={clsx('flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition', selected ? 'border-gold-400 bg-gold-400/10 shadow-gold' : 'border-gold-400/10 bg-black/20 hover:border-gold-400/40')}
    >
      {children}
    </button>
  )
}

function TradeList({ title, empty, trades, names, actions, showStatus }: { title: string; empty: string; trades: Trade[]; names: Map<string, string>; actions?: (t: Trade) => React.ReactNode; showStatus?: boolean }) {
  const dir = useDirectory()
  return (
    <section className="panel p-5">
      <h2 className="panel-title mb-3">{title}</h2>
      {trades.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {trades.map((t) => (
            <li key={t.id} className="rounded-lg border border-gold-400/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>
                  <b className="text-gold-100">{names.get(t.proposer_id) ?? t.proposer}</b> → <b className="text-gold-100">{names.get(t.recipient_id) ?? t.recipient}</b>
                </span>
                <span>{fmtDateTime(t.created_at)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">gives</div>
                  <PlayerCell player={dir.byId.get(t.give_player)} size={30} />
                </div>
                <ArrowLeftRight className="h-4 w-4 text-gold-500" />
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">gets</div>
                  <PlayerCell player={dir.byId.get(t.get_player)} size={30} />
                </div>
              </div>
              {showStatus && <div className={clsx('mt-2 text-xs font-bold uppercase tracking-wider', t.status === 'accepted' ? 'text-emerald-400' : 'text-slate-500')}>{t.status}</div>}
              {actions && <div className="mt-3 flex gap-2">{actions(t)}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
