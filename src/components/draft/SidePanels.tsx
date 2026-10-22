import clsx from 'clsx'
import { ArrowDown, ArrowUp, Bot, ListOrdered, X } from 'lucide-react'
import { PlayerAvatar, PlayerCell, RoleBadge } from '../game'
import { EmptyState } from '../ui'
import { ROLE_META, withAlpha } from '../../lib/roles'
import { ROLES } from '../../lib/types'
import type { DraftPick, Player } from '../../lib/types'
import { rolesMissing } from './logic'

export function QueuePanel({
  sealed, queue, byId, takenBy, onMove, onRemove, onClear,
}: {
  sealed?: boolean
  queue: string[]
  byId: Map<string, Player>
  takenBy: Map<string, string>
  onMove(i: number, dir: -1 | 1): void
  onRemove(i: number): void
  onClear(): void
}) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title flex items-center gap-2">
          <ListOrdered className="h-4 w-4" /> {sealed ? 'My ranking' : 'My queue'}
        </h2>
        {queue.length > 0 && (
          <button className="text-xs text-slate-500 hover:text-red-300" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <EmptyState title="Queue is empty">
          Tap <b>＋</b> on players you want. If your clock runs out (or auto-draft is on) we draft from the top of this list first.
        </EmptyState>
      ) : (
        <ol className="space-y-1.5">
          {queue.map((id, i) => {
            const p = byId.get(id)
            const gone = takenBy.has(id)
            return (
              <li key={id} className={clsx('flex items-center gap-2 rounded-lg border border-gold-400/10 bg-black/20 py-1.5 pl-2 pr-1', gone && 'opacity-40')}>
                <span className="w-5 text-center font-display text-xs font-bold text-gold-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <PlayerCell player={p} size={30} />
                </div>
                <div className="flex shrink-0">
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Move down" disabled={i === queue.length - 1} onClick={() => onMove(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Remove" onClick={() => onRemove(i)}>
                    <X className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function IconBtn({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled?: boolean; onClick(): void }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25">
      {children}
    </button>
  )
}

export function MyRoster({ mine, rosterSize }: { mine: Player[]; rosterSize: number }) {
  const missing = rolesMissing(mine)
  const used = new Set<string>()
  // one "starter" slot per role, the rest are flex
  const slots = ROLES.map((r) => {
    const p = mine.find((m) => m.role === r)
    if (p) used.add(p.id)
    return { role: r, player: p }
  })
  const flex = mine.filter((m) => !used.has(m.id))
  const flexSlots = Math.max(0, rosterSize - 5)

  return (
    <section className="panel p-4">
      <h2 className="panel-title mb-3">
        My team <span className="text-slate-500">· {mine.length}/{rosterSize}</span>
      </h2>
      <ul className="space-y-1.5">
        {slots.map(({ role, player }) => (
          <li key={role} className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: withAlpha(ROLE_META[role].color, player ? 0.35 : 0.2), background: withAlpha(ROLE_META[role].color, player ? 0.08 : 0.02) }}>
            <RoleBadge role={role} className="w-14 justify-center" />
            {player ? (
              <div className="min-w-0 flex-1">
                <PlayerCell player={player} size={30} />
              </div>
            ) : (
              <span className="text-sm text-slate-600">Needed</span>
            )}
          </li>
        ))}
        {Array.from({ length: flexSlots }).map((_, i) => {
          const p = flex[i]
          return (
            <li key={`flex-${i}`} className="flex items-center gap-2 rounded-lg border border-gold-400/10 px-2 py-1.5">
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Flex</span>
              {p ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PlayerCell player={p} size={30} />
                  </div>
                  <RoleBadge role={p.role} compact />
                </div>
              ) : (
                <span className="text-sm text-slate-600">Any role</span>
              )}
            </li>
          )
        })}
      </ul>
      {missing.length > 0 && mine.length < rosterSize && (
        <p className="mt-3 text-xs text-amber-300/90">
          Still need: {missing.map((r) => ROLE_META[r].label).join(', ')}
          {missing.length >= rosterSize - mine.length && ' — time to fill these!'}
        </p>
      )}
    </section>
  )
}

export function PickFeed({ picks, byId, names }: { picks: DraftPick[]; byId: Map<string, Player>; names: Map<string, string> }) {
  const recent = [...picks].reverse().slice(0, 10)
  return (
    <section className="panel p-4">
      <h2 className="panel-title mb-3">Latest picks</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-500">No picks yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((p) => {
            const pl = byId.get(p.player_id)
            return (
              <li key={p.pick_no} className="flex items-center gap-2.5 text-sm">
                <span className="w-7 text-right font-display text-xs font-bold text-slate-500">#{p.pick_no}</span>
                <PlayerAvatar player={pl} size={26} />
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-gold-50">{pl?.handle ?? '…'}</b> <span className="text-slate-500">→</span> <span className="text-slate-300">{names.get(p.user_id)}</span>
                </span>
                {p.auto && <Bot className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-label="auto-picked" />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
