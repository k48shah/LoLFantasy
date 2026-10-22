import { useState } from 'react'
import { Info } from 'lucide-react'
import type { LeagueSettings } from '../lib/api'
import { fmtMinutes } from '../lib/format'
import { Field, Segmented, Spinner, Switch } from './ui'

const SEALED_CLOCKS = [
  { value: 720, label: '12 hr' },
  { value: 1440, label: '24 hr' },
  { value: 2160, label: '36 hr' },
  { value: 2880, label: '48 hr' },
]

const CLOCKS = [
  { value: 5, label: '5 min' },
  { value: 60, label: '1 hr' },
  { value: 240, label: '4 hr' },
  { value: 480, label: '8 hr' },
  { value: 720, label: '12 hr' },
  { value: 1440, label: '24 hr' },
]

export const DEFAULT_SETTINGS: LeagueSettings = { name: '', maxMembers: 8, rosterSize: 7, pickMinutes: 480, countPlayIns: false, draftMode: 'live' }

interface Props {
  initial?: LeagueSettings
  /** After the draft starts, size/roster can't change. */
  structureLocked?: boolean
  submitLabel: string
  onSubmit(s: LeagueSettings): Promise<void>
  memberCount?: number
}

export function LeagueSettingsForm({ initial = DEFAULT_SETTINGS, structureLocked, submitLabel, onSubmit, memberCount = 2 }: Props) {
  const [s, setS] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof LeagueSettings>(k: K, v: LeagueSettings[K]) => setS((p) => ({ ...p, [k]: v }))

  const base = s.draftMode === 'sealed' ? SEALED_CLOCKS : CLOCKS
  const clocks = base.some((c) => c.value === s.pickMinutes) ? base : [...base, { value: s.pickMinutes, label: fmtMinutes(s.pickMinutes) }].sort((a, b) => a.value - b.value)
  const sealed = s.draftMode === 'sealed'
  const setMode = (m: LeagueSettings['draftMode']) => setS((p) => ({ ...p, draftMode: m, pickMinutes: m === 'sealed' ? 1440 : 480 }))
  const managers = Math.max(memberCount, 2)
  const totalPicks = s.rosterSize * Math.max(memberCount, 2)

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await onSubmit({ ...s, name: s.name.trim() })
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="League name">
        <input className="input" value={s.name} onChange={(e) => set('name', e.target.value)} maxLength={40} minLength={2} placeholder="The Rift Bandits" required autoFocus />
      </Field>

      <Field label="Draft style" hint={sealed ? 'Everyone ranks players whenever they like before a deadline, then the whole draft runs instantly from those rankings. Nobody waits on anybody.' : 'Managers take turns picking, each with a pick clock. Best when people check in often.'}>
        <Segmented value={s.draftMode} onChange={setMode} options={[{ value: 'sealed' as const, label: 'Sealed (rank anytime)' }, { value: 'live' as const, label: 'Live (take turns)' }]} className={structureLocked ? 'pointer-events-none opacity-50' : ''} />
      </Field>

      <Field label="Max managers" hint="Everyone joins with an invite link. You can start the draft with as few as 2.">
        <Segmented value={s.maxMembers} onChange={(v) => set('maxMembers', v)} options={[4, 6, 8, 10, 12].map((n) => ({ value: n, label: n }))} className={structureLocked ? 'pointer-events-none opacity-50' : ''} />
      </Field>

      <Field label="Roster size" hint="Everyone must end with at least one player at each of the 5 roles; the rest are free picks. Every player on your roster scores for you.">
        <Segmented value={s.rosterSize} onChange={(v) => set('rosterSize', v)} options={[5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: n }))} className={structureLocked ? 'pointer-events-none opacity-50' : ''} />
      </Field>

      <Field label={sealed ? 'Rankings deadline' : 'Pick clock'} hint={sealed ? 'How long after you start the draft until rankings lock and the draft runs. It also runs early the moment every manager locks in.' : 'How long each manager gets per pick. If it runs out, we auto-pick from their queue.'}>
        <Segmented value={s.pickMinutes} onChange={(v) => set('pickMinutes', v)} options={clocks} />
      </Field>

      <div className="flex items-start gap-2 rounded-lg border border-hex-500/25 bg-hex-500/5 p-3 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-hex-400" />
        <span>
          {sealed ? (
            <>
              {managers} managers × {s.rosterSize} players = <b className="text-gold-100">{totalPicks} picks</b>, made in snake order the instant rankings lock. Managers who don't rank anything get the best available players.
            </>
          ) : (
            <>
              {managers} managers × {s.rosterSize} players = <b className="text-gold-100">{totalPicks} picks</b>. The draft is a snake and never takes longer than{' '}
              <b className="text-gold-100">{fmtMinutes(Math.min(totalPicks * s.pickMinutes, 60 * 24 * 60))}</b> even if nobody ever shows up — most picks will go much faster.
            </>
          )}
        </span>
      </div>

      <Switch checked={s.countPlayIns} onChange={(v) => set('countPlayIns', v)} label={<span>Count Play-In games toward scores <span className="text-slate-500">(off = Swiss stage onward)</span></span>} />

      <button className="btn-gold w-full py-3" disabled={busy}>
        {busy && <Spinner />}
        {submitLabel}
      </button>
    </form>
  )
}
