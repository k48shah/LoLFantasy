import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CalendarDays } from 'lucide-react'
import { TeamLogo } from '../components/game'
import { EmptyState, ErrorBox, PageHeader, Segmented, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { dayKey, fmtDay, fmtTime, stageLabel } from '../lib/format'
import { useQuery } from '../lib/hooks'
import type { Match } from '../lib/types'

type Filter = 'upcoming' | 'results' | 'all'

export function SchedulePage() {
  const q = useQuery(() => api.schedule(), [], { poll: 120_000 })
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const list = (q.data ?? []).filter((m) => (filter === 'all' ? true : filter === 'results' ? m.state === 'completed' : m.state !== 'completed'))
    const ordered = filter === 'results' ? [...list].reverse() : list
    const by = new Map<string, Match[]>()
    for (const m of ordered) {
      const k = dayKey(m.start_time)
      by.set(k, [...(by.get(k) ?? []), m])
    }
    return [...by.entries()]
  }, [q.data, filter])

  return (
    <>
      <PageHeader
        eyebrow="Worlds 2026"
        title="Schedule & results"
        subtitle="Times are shown in your local time zone. Later-stage matches appear as Riot publishes them."
        actions={<Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'results', label: 'Results' }]} />}
      />
      {q.error && !q.data ? (
        <ErrorBox error={q.error} retry={q.reload} />
      ) : !q.data ? (
        <Skeleton className="h-64" />
      ) : groups.length === 0 ? (
        <div className="panel"><EmptyState icon={<CalendarDays className="h-10 w-10" />} title="Nothing to show">No matches in this view yet.</EmptyState></div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, matches]) => (
            <section key={key}>
              <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-400">{key === 'tbd' ? 'Date to be announced' : fmtDay(matches[0].start_time)}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {matches.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function MatchCard({ m }: { m: Match }) {
  const done = m.state === 'completed'
  const live = m.state === 'inProgress'
  const win1 = done && m.team1_wins > m.team2_wins
  const win2 = done && m.team2_wins > m.team1_wins
  return (
    <div className={clsx('panel flex items-center gap-3 p-4', live && 'border-red-400/50')}>
      <div className="w-16 shrink-0 text-center text-xs">
        {live ? <span className="pill border-red-400/50 bg-red-500/10 text-red-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live</span> : <span className="text-slate-400">{done ? 'Final' : fmtTime(m.start_time)}</span>}
        <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{m.best_of ? `Bo${m.best_of}` : ''}</div>
      </div>
      <div className="flex-1 space-y-2">
        <Side team={m.team1} wins={m.team1_wins} won={win1} lost={win2} show={done || live} />
        <Side team={m.team2} wins={m.team2_wins} won={win2} lost={win1} show={done || live} />
      </div>
      <div className="hidden text-right text-[11px] uppercase tracking-wider text-slate-500 sm:block">
        {stageLabel(m.stage)}
        {m.block_name && m.block_name !== stageLabel(m.stage) && <div className="text-slate-600">{m.block_name}</div>}
      </div>
    </div>
  )
}

function Side({ team, wins, won, lost, show }: { team: Match['team1']; wins: number; won: boolean; lost: boolean; show: boolean }) {
  return (
    <div className={clsx('flex items-center gap-2.5', lost && 'opacity-50')}>
      <TeamLogo team={team} size={28} />
      <span className={clsx('flex-1 truncate font-semibold', won ? 'text-gold-100' : 'text-slate-300')}>{team.name ?? team.code}</span>
      {show && <span className={clsx('font-display text-lg font-bold tabular-nums', won ? 'text-gold-100' : 'text-slate-400')}>{wins}</span>}
    </div>
  )
}
