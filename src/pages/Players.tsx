import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { PlayerCell, RoleBadge } from '../components/game'
import { PlayerModal } from '../components/PlayerModal'
import { EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui'
import { useDirectory } from '../lib/directory'
import { fmtPts, rate } from '../lib/format'
import { ROLE_META } from '../lib/roles'
import { ROLES } from '../lib/types'
import type { Player, Role } from '../lib/types'

type SortKey = 'player' | 'gp' | 'kda' | 'cs' | 'ppg' | 'pts'

export function PlayersPage() {
  const dir = useDirectory()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | 'all'>('all')
  const [team, setTeam] = useState('all')
  const [scope, setScope] = useState<'main' | 'all'>('all')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'pts', desc: true })
  const [inspect, setInspect] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const stat = (p: Player) => p[scope]
    const val = (p: Player): number | string => {
      const s = stat(p)
      switch (sort.key) {
        case 'player': return p.handle.toLowerCase()
        case 'gp': return s.games
        case 'kda': return s.deaths ? (s.kills + s.assists) / s.deaths : s.kills + s.assists
        case 'cs': return rate(s.cs, s.games)
        case 'ppg': return rate(s.points, s.games)
        default: return s.points
      }
    }
    return dir.players
      .filter((p) => p.active || p.all.games > 0)
      .filter((p) => (role === 'all' || p.role === role) && (team === 'all' || p.team?.id === team) && (!needle || p.handle.toLowerCase().includes(needle) || (p.team?.name ?? '').toLowerCase().includes(needle) || (p.team?.code ?? '').toLowerCase() === needle))
      .sort((a, b) => {
        const x = val(a)
        const y = val(b)
        const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)
        return (sort.desc ? -c : c) || a.handle.localeCompare(b.handle)
      })
  }, [dir.players, q, role, team, scope, sort])

  const head = (key: SortKey, label: string, right = true) => (
    <th className={clsx('th cursor-pointer select-none hover:text-gold-200', right && 'text-right')} onClick={() => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'player' }))} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </span>
    </th>
  )

  return (
    <>
      <PageHeader eyebrow="Worlds 2026" title="Players" subtitle="Every player at the tournament and what they've scored so far. Click a row for the full game log." />

      <div className="panel mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search player or team" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
        </div>
        <select className="input w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="all">All teams</option>
          {dir.teams.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
        </select>
        <Segmented value={role} onChange={setRole} options={[{ value: 'all' as const, label: 'All' }, ...ROLES.map((r) => ({ value: r, label: ROLE_META[r].short }))]} />
        <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'All games' }, { value: 'main', label: 'Excl. Play-Ins' }]} />
      </div>

      {dir.loading && dir.players.length === 0 ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <div className="panel"><EmptyState title="No players match">Try a different filter.</EmptyState></div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gold-400/10 bg-black/20">
                <th className="th w-10 text-center">#</th>
                {head('player', 'Player', false)}
                <th className="th">Role</th>
                {head('gp', 'GP')}
                {head('kda', 'KDA')}
                {head('cs', 'CS/G')}
                {head('ppg', 'PPG')}
                {head('pts', 'Points')}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const s = p[scope]
                return (
                  <tr key={p.id} className="cursor-pointer border-b border-gold-400/5 transition hover:bg-white/[.04]" onClick={() => setInspect(p.id)}>
                    <td className="td text-center text-xs text-slate-500">{i + 1}</td>
                    <td className="td"><PlayerCell player={p} /></td>
                    <td className="td"><RoleBadge role={p.role} /></td>
                    <td className="td text-right tabular-nums text-slate-400">{s.games}</td>
                    <td className="td text-right tabular-nums text-slate-300">{s.games ? (s.deaths ? ((s.kills + s.assists) / s.deaths).toFixed(1) : '∞') : '–'}</td>
                    <td className="td text-right tabular-nums text-slate-300">{s.games ? Math.round(rate(s.cs, s.games)) : '–'}</td>
                    <td className="td text-right tabular-nums text-slate-200">{s.games ? fmtPts(rate(s.points, s.games)) : '–'}</td>
                    <td className="td text-right font-display text-base font-bold tabular-nums text-gold-100">{s.games ? fmtPts(s.points) : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <PlayerModal playerId={inspect} onClose={() => setInspect(null)} />
    </>
  )
}
