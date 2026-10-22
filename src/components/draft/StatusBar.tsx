import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Hourglass, PartyPopper, Zap } from 'lucide-react'
import { Countdown } from '../game'
import { Switch } from '../ui'
import { fmtMinutes } from '../../lib/format'
import type { DraftState } from '../../lib/types'

interface Props {
  state: DraftState
  skew: number
  onClockName?: string
  isMyTurn: boolean
  untilMe: number | null
  nextAutoName?: string
  autoOn: boolean
  onToggleAuto(v: boolean): void
}

export function StatusBar({ state, skew, onClockName, isMyTurn, untilMe, nextAutoName, autoOn, onToggleAuto }: Props) {
  const { league } = state
  const n = state.members.length || 1
  const total = league.total_picks

  if (league.status === 'active') {
    return (
      <div className="panel flex flex-wrap items-center gap-4 border-hex-500/40 p-5">
        <PartyPopper className="h-8 w-8 text-hex-400" />
        <div className="flex-1">
          <div className="font-display text-xl font-bold text-gold-100">The draft is complete!</div>
          <div className="text-sm text-slate-400">All {total} picks are in. Points start counting from the next game.</div>
        </div>
        <Link to="../rosters" className="btn-hex">See the rosters</Link>
      </div>
    )
  }

  if (league.status === 'lobby') {
    return (
      <div className="panel p-5 text-center">
        <Hourglass className="mx-auto mb-2 h-8 w-8 text-gold-500/70" />
        <div className="font-display text-lg text-gold-100">The draft hasn't started</div>
        <p className="text-sm text-slate-400">The league owner starts it from the Overview tab. Until then you can browse players below and build your queue.</p>
      </div>
    )
  }

  if (league.draft_mode === 'sealed') {
    const lockedCount = state.members.filter((m) => m.auto_draft).length
    return (
      <div className={clsx('panel flex flex-wrap items-center gap-x-6 gap-y-3 p-5', !autoOn && 'border-gold-400/60')}>
        <div className="min-w-0 flex-1">
          <div className="panel-title">Sealed draft · {lockedCount}/{n} locked in</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-gold-100 sm:text-3xl">{autoOn ? "You're locked in" : 'Build your ranking'}</div>
          <div className="mt-1 text-sm text-slate-400">
            Add players to <b className="text-slate-200">My ranking</b> in the order you want them (tap ＋). When the deadline hits — or as soon as everyone locks in — the snake draft runs instantly:
            each manager in turn gets their highest-ranked player still available. Anything you don't rank is filled with the best available.
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Rankings lock in</div>
          <div className="font-display text-3xl font-extrabold tabular-nums text-slate-200 sm:text-4xl">
            <Countdown deadline={league.pick_deadline} skew={skew} />
          </div>
        </div>
        <div className="w-full border-t border-gold-400/10 pt-3 sm:w-auto sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <Switch checked={autoOn} onChange={onToggleAuto} label={<span className="font-semibold">Lock in my ranking</span>} />
          <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-slate-500">You can still edit and unlock until the draft runs.</p>
        </div>
      </div>
    )
  }

  const round = Math.floor((league.current_pick - 1) / n) + 1
  const rounds = Math.round(total / n)

  return (
    <div className={clsx('panel flex flex-wrap items-center gap-x-6 gap-y-3 p-5', isMyTurn && 'animate-glow border-gold-400/80')}>
      <div className="min-w-0 flex-1">
        <div className="panel-title flex items-center gap-2">
          {isMyTurn && <Zap className="h-4 w-4 fill-gold-300 text-gold-300" />}
          Pick {league.current_pick} of {total} · Round {round}/{rounds}
        </div>
        <div className={clsx('mt-1 font-display text-2xl font-extrabold sm:text-3xl', isMyTurn ? 'gold-text' : 'text-gold-100')}>
          {isMyTurn ? "You're on the clock!" : `${onClockName ?? '…'} is on the clock`}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          {isMyTurn ? (
            <>
              Pick below — or do nothing and <b className="text-slate-200">{nextAutoName ?? 'the best available player'}</b> is drafted for you when time runs out.
            </>
          ) : untilMe === null ? (
            'Your roster is full — just watching now.'
          ) : untilMe === 0 ? (
            'You are up next.'
          ) : (
            <>
              You pick in <b className="text-slate-200">{untilMe}</b> pick{untilMe === 1 ? '' : 's'}. Each pick gets {fmtMinutes(league.pick_minutes)}.
            </>
          )}
        </div>
      </div>

      <div className="text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Auto-pick in</div>
        <div className={clsx('font-display text-3xl font-extrabold tabular-nums sm:text-4xl', isMyTurn ? 'text-gold-100' : 'text-slate-200')}>
          <Countdown deadline={league.pick_deadline} skew={skew} />
        </div>
      </div>

      <div className="w-full border-t border-gold-400/10 pt-3 sm:w-auto sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <Switch checked={autoOn} onChange={onToggleAuto} label={<span className="font-semibold">Auto-draft for me</span>} />
        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-slate-500">Picks instantly from your queue (then best available) whenever you're up. Turn off anytime.</p>
      </div>
    </div>
  )
}
