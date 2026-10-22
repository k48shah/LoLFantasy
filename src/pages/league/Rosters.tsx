import { useState } from 'react'
import clsx from 'clsx'
import { Repeat, Users } from 'lucide-react'
import { PlayerCell, RoleBadge } from '../../components/game'
import { PlayerModal } from '../../components/PlayerModal'
import { EmptyState, ErrorBox, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { useDirectory } from '../../lib/directory'
import { fmtPts } from '../../lib/format'
import { useQuery } from '../../lib/hooks'
import { useLeague } from './context'

export function Rosters() {
  const { id, overview: o } = useLeague()
  const dir = useDirectory()
  const q = useQuery(() => api.rosters(id), [id], { poll: 60_000 })
  const [inspect, setInspect] = useState<string | null>(null)

  if (o.league.status === 'lobby') {
    return (
      <div className="panel">
        <EmptyState icon={<Users className="h-10 w-10" />} title="Rosters appear after the draft">
          Once everyone has picked, you can see every team here and how many points each player has earned for their manager.
        </EmptyState>
      </div>
    )
  }
  if (q.error && !q.data) return <ErrorBox error={q.error} retry={q.reload} />
  if (!q.data) return <Skeleton className="h-64" />

  const ranked = [...o.members].sort((a, b) => Number(b.points) - Number(a.points))

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map((m, i) => {
          const spots = q.data!.filter((s) => s.user_id === m.user_id)
          const current = spots.filter((s) => !s.released_at).sort((a, b) => Number(b.points) - Number(a.points))
          const past = spots.filter((s) => s.released_at)
          return (
            <section key={m.user_id} className={clsx('panel animate-rise p-4', m.user_id === o.me && 'border-hex-500/40')} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-600 font-display text-sm font-extrabold text-ink-950">{i + 1}</span>
                  <div className="leading-tight">
                    <div className="font-display text-lg font-bold text-gold-100">{m.username}</div>
                    {m.user_id === o.me && <div className="text-[10px] font-semibold uppercase tracking-wider text-hex-400">your team</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-extrabold text-gold-100">{fmtPts(m.points)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">points</div>
                </div>
              </div>
              <div className="divider mb-2" />
              {current.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No players yet.</p>
              ) : (
                <ul className="divide-y divide-gold-400/5">
                  {current.map((s) => {
                    const p = dir.byId.get(s.player_id)
                    return (
                      <li key={s.spot_id}>
                        <button className="flex w-full items-center gap-2 rounded-md py-2 text-left transition hover:bg-white/[.03]" onClick={() => setInspect(s.player_id)}>
                          <div className="min-w-0 flex-1">
                            <PlayerCell player={p} size={34} />
                          </div>
                          {p && <RoleBadge role={p.role} compact />}
                          <div className="w-14 text-right">
                            <div className="font-display font-bold tabular-nums text-gold-100">{fmtPts(s.points)}</div>
                            <div className="text-[10px] text-slate-500">{s.games} game{s.games === 1 ? '' : 's'}</div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {past.length > 0 && (
                <div className="mt-3 border-t border-gold-400/10 pt-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <Repeat className="h-3 w-3" /> Traded away (points earned while owned)
                  </div>
                  {past.map((s) => (
                    <div key={s.spot_id} className="flex items-center justify-between py-1 text-xs text-slate-500">
                      <span>{dir.byId.get(s.player_id)?.handle ?? '…'}</span>
                      <span className="tabular-nums">{fmtPts(s.points)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <PlayerModal playerId={inspect} onClose={() => setInspect(null)} />
    </>
  )
}
