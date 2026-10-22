import { api } from '../lib/api'
import { useDirectory } from '../lib/directory'
import { fmtDateTime, fmtPts, rate, stageLabel } from '../lib/format'
import { useQuery } from '../lib/hooks'
import { PlayerAvatar, RoleBadge, TeamLogo } from './game'
import { EmptyState, Modal, Skeleton } from './ui'
import clsx from 'clsx'

export function PlayerModal({ playerId, onClose }: { playerId: string | null; onClose(): void }) {
  const dir = useDirectory()
  const p = playerId ? dir.byId.get(playerId) : undefined
  const games = useQuery(() => api.playerGames(playerId!), [playerId], { enabled: !!playerId })

  return (
    <Modal open={!!playerId} onClose={onClose} wide title={p ? <span className="flex items-center gap-3"><PlayerAvatar player={p} size={52} /> {p.handle}</span> : 'Player'}>
      {p ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <RoleBadge role={p.role} />
            <span className="inline-flex items-center gap-1.5">
              <TeamLogo team={p.team} size={18} /> {p.team?.name ?? 'Free agent'}
            </span>
            {p.full_name && <span>{p.full_name}</span>}
            {!p.active && <span className="pill border-slate-500/40 text-slate-400">not in draft pool</span>}
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Games" value={String(p.all.games)} />
            <Stat label="Total pts" value={fmtPts(p.all.points)} />
            <Stat label="Pts / game" value={fmtPts(rate(p.all.points, p.all.games))} />
            <Stat label="Avg K / D / A" value={p.all.games ? `${fmtPts(rate(p.all.kills, p.all.games))} / ${fmtPts(rate(p.all.deaths, p.all.games))} / ${fmtPts(rate(p.all.assists, p.all.games))}` : '—'} />
          </div>
          <h3 className="panel-title mb-2">Game log</h3>
          {games.loading && !games.data ? (
            <Skeleton className="h-24" />
          ) : !games.data?.length ? (
            <EmptyState title="No games yet">Stats appear a few minutes after each game finishes.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gold-400/10">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="bg-black/20">
                    <th className="th">When</th>
                    <th className="th">vs</th>
                    <th className="th">Champ</th>
                    <th className="th text-center">K/D/A</th>
                    <th className="th text-right">CS</th>
                    <th className="th text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {games.data.map((g) => (
                    <tr key={g.game_id} className="border-t border-gold-400/5">
                      <td className="td text-xs text-slate-400">
                        {fmtDateTime(g.started_at)}
                        <div className="text-[10px] uppercase text-slate-600">{stageLabel(g.stage)}</div>
                      </td>
                      <td className="td">{g.opponent ?? '—'}</td>
                      <td className="td text-slate-300">{g.champion ?? '—'}</td>
                      <td className="td text-center tabular-nums">
                        <span className={clsx(g.won ? 'text-emerald-300' : 'text-slate-300')}>{g.kills}/{g.deaths}/{g.assists}</span>
                        <span className="ml-1.5 text-[10px] font-bold uppercase">{g.won ? <span className="text-emerald-400">W</span> : <span className="text-red-400">L</span>}</span>
                      </td>
                      <td className="td text-right tabular-nums text-slate-400">{g.cs}</td>
                      <td className="td text-right font-bold tabular-nums text-gold-100">{fmtPts(g.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <Skeleton className="h-32" />
      )}
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-400/10 bg-black/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold tabular-nums text-gold-100">{value}</div>
    </div>
  )
}
