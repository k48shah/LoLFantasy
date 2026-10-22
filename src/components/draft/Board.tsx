import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Bot } from 'lucide-react'
import { ROLE_META, withAlpha } from '../../lib/roles'
import type { DraftState, Player } from '../../lib/types'
import { PlayerAvatar } from '../game'

interface Props {
  state: DraftState
  byId: Map<string, Player>
  onToggleAuto(userId: string, on: boolean): void
  onInspect(playerId: string): void
}

/** Columns = managers in draft order, rows = rounds, snake direction flips each row. */
export function Board({ state, byId, onToggleAuto, onInspect }: Props) {
  const { league, members, picks, me } = state
  const n = members.length
  if (!n || league.status === 'lobby') return null
  const rounds = Math.round(league.total_picks / n)
  const pickAt = new Map(picks.map((p) => [p.pick_no, p]))
  const canToggle = (uid: string) => uid === me || league.owner_id === me

  return (
    <section className="panel overflow-hidden">
      <h2 className="panel-title p-4 pb-3">Draft board</h2>
      <div className="overflow-x-auto">
        <div className="grid min-w-max" style={{ gridTemplateColumns: `52px repeat(${n}, minmax(132px, 1fr))` }}>
          <div className="sticky left-0 z-10 bg-ink-800" />
          {members.map((m) => {
            const onClock = league.status === 'drafting' && league.draft_mode === 'live' && league.on_clock === m.user_id
            return (
              <div key={m.user_id} className={clsx('border-b border-l border-gold-400/10 px-2 py-2 text-center', onClock && 'bg-gold-400/10')}>
                <div className={clsx('truncate text-sm font-bold', onClock ? 'text-gold-200' : 'text-gold-50')} title={m.username}>
                  {m.username}
                  {m.user_id === me && <span className="ml-1 text-[10px] text-hex-400">(you)</span>}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  <span>#{m.draft_position}</span>
                  {canToggle(m.user_id) && league.status === 'drafting' ? (
                    <button
                      onClick={() => onToggleAuto(m.user_id, !m.auto_draft)}
                      className={clsx('inline-flex items-center gap-0.5 rounded px-1 py-px font-bold transition', m.auto_draft ? 'bg-hex-500/20 text-hex-300' : 'text-slate-600 hover:text-slate-300')}
                      title={m.auto_draft ? 'Auto-draft is on — click to turn off' : 'Click to turn auto-draft on'}
                    >
                      <Bot className="h-3 w-3" /> {m.auto_draft ? 'auto' : 'manual'}
                    </button>
                  ) : (
                    m.auto_draft && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-hex-500/20 px-1 py-px font-bold text-hex-300">
                        <Bot className="h-3 w-3" /> auto
                      </span>
                    )
                  )}
                </div>
              </div>
            )
          })}

          {Array.from({ length: rounds }).map((_, r) => (
            <Row key={r} r={r} n={n} members={members} pickAt={pickAt} byId={byId} current={league.status === 'drafting' && league.draft_mode === 'live' ? league.current_pick : -1} onInspect={onInspect} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Row({ r, n, members, pickAt, byId, current, onInspect }: { r: number; n: number; members: DraftState['members']; pickAt: Map<number, DraftState['picks'][number]>; byId: Map<string, Player>; current: number; onInspect(id: string): void }) {
  const reverse = r % 2 === 1
  return (
    <>
      <div className="sticky left-0 z-10 flex flex-col items-center justify-center border-b border-gold-400/10 bg-ink-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        R{r + 1}
        {reverse ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
      </div>
      {members.map((m, c) => {
        const idx = reverse ? n - 1 - c : c
        const pickNo = r * n + idx + 1
        const pick = pickAt.get(pickNo)
        const player = pick ? byId.get(pick.player_id) : undefined
        const isCurrent = pickNo === current
        return (
          <div key={m.user_id} className={clsx('relative min-h-[62px] border-b border-l border-gold-400/10 p-1.5', isCurrent && 'animate-glow z-[1] bg-gold-400/10')}>
            {pick ? (
              <button
                onClick={() => onInspect(pick.player_id)}
                className="flex h-full w-full items-center gap-2 rounded-md border-l-[3px] px-1.5 py-1 text-left transition hover:bg-white/5"
                style={{ borderColor: player ? ROLE_META[player.role].color : '#475569', background: player ? withAlpha(ROLE_META[player.role].color, 0.08) : undefined }}
              >
                <PlayerAvatar player={player} size={30} ring={false} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-semibold text-gold-50">{player?.handle ?? '…'}</span>
                  <span className="block truncate text-[10px] text-slate-400">
                    {player?.team?.code} · {player ? ROLE_META[player.role].short : ''}
                    {pick.auto && <Bot className="ml-1 inline h-2.5 w-2.5 text-slate-500" aria-label="auto-picked" />}
                  </span>
                </span>
              </button>
            ) : (
              <div className={clsx('flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-wider', isCurrent ? 'text-gold-200' : 'text-slate-700')}>
                {isCurrent ? 'On the clock' : `#${pickNo}`}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
