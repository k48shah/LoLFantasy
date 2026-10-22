import { useState } from 'react'
import clsx from 'clsx'
import { Bot, Clock } from 'lucide-react'
import { ROLE_META, withAlpha } from '../lib/roles'
import { fmtDuration, img } from '../lib/format'
import { useNow } from '../lib/hooks'
import type { LeagueStatus, MatchTeam, Player, Role, TeamLite } from '../lib/types'

export function RoleBadge({ role, compact, className }: { role: Role; compact?: boolean; className?: string }) {
  const m = ROLE_META[role]
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', className)}
      style={{ color: m.color, borderColor: withAlpha(m.color, 0.4), background: withAlpha(m.color, 0.12) }}
      title={m.label}
    >
      <m.Icon className="h-3 w-3" aria-hidden />
      {!compact && m.short}
    </span>
  )
}

export function TeamLogo({ team, size = 24, className }: { team: Pick<TeamLite, 'code' | 'image_url'> | MatchTeam | null | undefined; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const src = img(team?.image_url)
  if (!src || broken) {
    return (
      <span
        className={clsx('inline-flex shrink-0 items-center justify-center rounded-md bg-ink-600 text-[9px] font-bold text-gold-200', className)}
        style={{ width: size, height: size }}
        aria-label={team?.code}
      >
        {team?.code?.slice(0, 3) ?? '?'}
      </span>
    )
  }
  return <img src={src} alt={team?.code ?? ''} loading="lazy" onError={() => setBroken(true)} className={clsx('shrink-0 object-contain', className)} style={{ width: size, height: size }} />
}

export function PlayerAvatar({ player, size = 40, ring = true, className }: { player: Pick<Player, 'handle' | 'role' | 'image_url'> | undefined; size?: number; ring?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false)
  const color = player ? ROLE_META[player.role].color : '#243a5e'
  const src = img(player?.image_url)
  const isDefault = !src || /default-headshot/.test(src)
  return (
    <span
      className={clsx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-700', className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${withAlpha(color, 0.75)}` : undefined }}
    >
      {!isDefault && !broken ? (
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="font-display font-bold" style={{ color, fontSize: size * 0.38 }}>
          {(player?.handle ?? '?').slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}

/** Small "avatar + name + team" cell used all over tables. */
export function PlayerCell({ player, size = 36, sub }: { player: Player | undefined; size?: number; sub?: boolean }) {
  if (!player) return <span className="text-slate-500">Unknown player</span>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PlayerAvatar player={player} size={size} />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold text-gold-50">{player.handle}</div>
        {sub !== false && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <TeamLogo team={player.team} size={13} />
            <span>{player.team?.code ?? '—'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Live countdown. `skew` = serverNow − clientNow, so a wrong laptop clock doesn't lie about the pick timer. */
export function Countdown({ deadline, skew = 0, className }: { deadline: string | null; skew?: number; className?: string }) {
  const now = useNow(1000)
  if (!deadline) return null
  const left = Date.parse(deadline) - (now + skew)
  return (
    <span className={clsx('tabular-nums', left < 15 * 60_000 && 'text-amber-300', left < 60_000 && 'text-red-300', className)}>
      {left <= 0 ? 'any moment' : fmtDuration(left)}
    </span>
  )
}

export function ClockPill({ deadline, skew, className }: { deadline: string | null; skew?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs text-slate-300', className)}>
      <Clock className="h-3.5 w-3.5" aria-hidden />
      <Countdown deadline={deadline} skew={skew} />
    </span>
  )
}

const STATUS = {
  lobby: { label: 'Lobby', cls: 'border-slate-500/40 bg-slate-500/10 text-slate-300' },
  drafting: { label: 'Drafting', cls: 'border-gold-400/50 bg-gold-400/10 text-gold-200' },
  active: { label: 'Live', cls: 'border-hex-500/50 bg-hex-500/10 text-hex-300' },
} as const

export function StatusPill({ status }: { status: LeagueStatus }) {
  const s = STATUS[status]
  return (
    <span className={clsx('pill', s.cls)}>
      {status === 'active' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-400" />}
      {s.label}
    </span>
  )
}

export function AutoTag({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded bg-slate-500/20 px-1 text-[9px] font-bold uppercase text-slate-300', className)} title="Auto-picked">
      <Bot className="h-2.5 w-2.5" /> auto
    </span>
  )
}
