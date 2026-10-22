import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check, ListPlus, ListX, Search } from 'lucide-react'
import { PlayerCell, RoleBadge } from '../game'
import { EmptyState, Segmented } from '../ui'
import { fmtPts, rate } from '../../lib/format'
import { ROLE_META, withAlpha } from '../../lib/roles'
import { ROLES } from '../../lib/types'
import type { Player, Role, TeamLite } from '../../lib/types'
import { rating } from './logic'

interface Props {
  players: Player[]
  teams: TeamLite[]
  /** player id → username of whoever drafted them */
  takenBy: Map<string, string>
  queued: Set<string>
  canPick: boolean
  problem(p: Player): string | null
  pendingId: string | null
  onPick(p: Player): void
  onQueue(p: Player): void
  onInspect(id: string): void
}

type Sort = 'rating' | 'points' | 'name'

export function Pool({ players, teams, takenBy, queued, canPick, problem, pendingId, onPick, onQueue, onInspect }: Props) {
  const [role, setRole] = useState<Role | 'all'>('all')
  const [team, setTeam] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('rating')
  const [showTaken, setShowTaken] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  // "Tap again to confirm" expires so a stray click days later can't draft someone.
  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(null), 4000)
    return () => clearTimeout(t)
  }, [confirm])
  useEffect(() => {
    if (!canPick) setConfirm(null)
  }, [canPick])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = players.filter(
      (p) =>
        (role === 'all' || p.role === role) &&
        (team === 'all' || p.team?.id === team) &&
        (showTaken || !takenBy.has(p.id)) &&
        (!needle || p.handle.toLowerCase().includes(needle) || (p.full_name ?? '').toLowerCase().includes(needle) || (p.team?.name ?? '').toLowerCase().includes(needle) || (p.team?.code ?? '').toLowerCase() === needle),
    )
    list.sort((a, b) => {
      const taken = Number(takenBy.has(a.id)) - Number(takenBy.has(b.id))
      if (taken) return taken
      if (sort === 'name') return a.handle.localeCompare(b.handle)
      if (sort === 'points') return b.all.points - a.all.points || rating(b) - rating(a)
      return rating(b) - rating(a) || a.handle.localeCompare(b.handle)
    })
    return list
  }, [players, role, team, q, sort, showTaken, takenBy])

  const available = players.filter((p) => !takenBy.has(p.id))
  const countFor = (r: Role) => available.filter((p) => p.role === r).length

  return (
    <section className="panel overflow-hidden">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="panel-title">Player pool · {available.length} available</h2>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" className="accent-[#0ac8b9]" checked={showTaken} onChange={(e) => setShowTaken(e.target.checked)} /> Show drafted
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <RolePill active={role === 'all'} onClick={() => setRole('all')} label={`All ${available.length}`} />
          {ROLES.map((r) => (
            <RolePill key={r} active={role === r} color={ROLE_META[r].color} onClick={() => setRole(r)} label={`${ROLE_META[r].short} ${countFor(r)}`} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Search player or team" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
          </div>
          <select className="input w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Filter by team">
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: 'rating', label: 'Rating' },
              { value: 'points', label: 'Points' },
              { value: 'name', label: 'A–Z' },
            ]}
          />
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_72px_44px_64px_64px_132px] gap-3 border-y border-gold-400/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
        <span>Player</span>
        <span>Role</span>
        <span className="text-right">GP</span>
        <span className="text-right">PPG</span>
        <span className="text-right">Pts</span>
        <span />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No players match">Try clearing a filter.</EmptyState>
      ) : (
        <ul className="max-h-[70vh] divide-y divide-gold-400/5 overflow-y-auto">
          {rows.map((p) => {
            const taken = takenBy.get(p.id)
            const isQueued = queued.has(p.id)
            const issue = canPick && !taken ? problem(p) : null
            const confirming = confirm === p.id
            return (
              <li
                key={p.id}
                className={clsx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 transition hover:bg-white/[.03] md:grid-cols-[minmax(0,1fr)_72px_44px_64px_64px_132px]', taken && 'opacity-45')}
                style={{ boxShadow: `inset 3px 0 0 ${withAlpha(ROLE_META[p.role].color, taken ? 0.2 : 0.7)}` }}
              >
                <button className="min-w-0 text-left" onClick={() => onInspect(p.id)} aria-label={`View ${p.handle}`}>
                  <PlayerCell player={p} />
                </button>
                <span className="hidden md:block">
                  <RoleBadge role={p.role} />
                </span>
                <span className="hidden text-right text-sm tabular-nums text-slate-400 md:block">{p.all.games || '–'}</span>
                <span className="hidden text-right text-sm tabular-nums text-slate-300 md:block">{p.all.games ? fmtPts(rate(p.all.points, p.all.games)) : '–'}</span>
                <span className="hidden text-right text-sm font-semibold tabular-nums text-gold-100 md:block">{p.all.games ? fmtPts(p.all.points) : '–'}</span>

                <div className="flex items-center justify-end gap-1.5">
                  <span className="md:hidden">
                    <RoleBadge role={p.role} compact />
                  </span>
                  {taken ? (
                    <span className="truncate text-xs text-slate-500">{taken}</span>
                  ) : (
                    <>
                      <button
                        onClick={() => onQueue(p)}
                        className={clsx('rounded-md border p-1.5 transition', isQueued ? 'border-hex-500/60 bg-hex-500/15 text-hex-300' : 'border-gold-400/20 text-slate-400 hover:border-gold-400/60 hover:text-gold-100')}
                        aria-label={isQueued ? `Remove ${p.handle} from queue` : `Add ${p.handle} to queue`}
                        title={isQueued ? 'Remove from queue' : 'Add to queue'}
                      >
                        {isQueued ? <ListX className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
                      </button>
                      {canPick && (
                        <button
                          className={clsx(confirming ? 'btn-hex' : 'btn-gold', 'btn-sm min-w-[70px]')}
                          disabled={!!issue || pendingId !== null}
                          title={issue ?? undefined}
                          onClick={() => {
                            if (confirming) {
                              setConfirm(null)
                              onPick(p)
                            } else setConfirm(p.id)
                          }}
                        >
                          {pendingId === p.id ? '…' : confirming ? <><Check className="h-3.5 w-3.5" /> Sure?</> : 'Draft'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RolePill({ active, onClick, label, color }: { active: boolean; onClick(): void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx('rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition', active ? 'text-ink-950' : 'text-slate-300 hover:text-white')}
      style={{
        borderColor: color ? withAlpha(color, active ? 1 : 0.45) : active ? '#c8aa6e' : 'rgba(200,170,110,.25)',
        background: active ? color ?? '#c8aa6e' : color ? withAlpha(color, 0.08) : 'transparent',
      }}
    >
      {label}
    </button>
  )
}
