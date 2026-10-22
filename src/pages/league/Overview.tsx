import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Crown, LogOut, Play, Settings, Trash2, Trophy, UserMinus, Users } from 'lucide-react'
import clsx from 'clsx'
import { Countdown, PlayerCell } from '../../components/game'
import { LeagueSettingsForm } from '../../components/LeagueSettingsForm'
import { CopyButton, EmptyState, Modal, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { useDirectory } from '../../lib/directory'
import { fmtMinutes, fmtPts } from '../../lib/format'
import { useQuery } from '../../lib/hooks'
import { useToast } from '../../lib/toast'
import { useLeague } from './context'

export function Overview() {
  const { id, overview: o, reload } = useLeague()
  const { league, members, me } = o
  const isOwner = league.owner_id === me
  const toast = useToast()
  const nav = useNavigate()
  const [settings, setSettings] = useState(false)
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)

  const inviteUrl = `${window.location.origin}${window.location.pathname}#/join/${league.invite_code}`
  const totalPicks = members.length * league.roster_size
  const onClockName = members.find((m) => m.user_id === league.on_clock)?.username

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        {league.status === 'drafting' && (
          <Link to="draft" className="panel panel-hover block animate-glow border-gold-400/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="panel-title">Draft in progress</div>
                <div className="mt-1 font-display text-xl text-gold-100">
                  {league.draft_mode === 'sealed' ? 'Rank your players before the deadline' : league.on_clock === me ? "It's your pick!" : `${onClockName ?? 'Someone'} is on the clock`}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {league.draft_mode === 'sealed' ? <>Rankings lock in <Countdown deadline={league.pick_deadline} /></> : <>Pick {Math.min(league.current_pick, totalPicks)} of {totalPicks} · auto-pick in <Countdown deadline={league.pick_deadline} /></>}
                </div>
              </div>
              <span className="btn-gold">Open draft room</span>
            </div>
          </Link>
        )}

        {league.status === 'lobby' ? (
          <LobbyMembers />
        ) : (
          <Standings />
        )}
      </div>

      <aside className="space-y-6">
        <section className="panel p-5">
          <h2 className="panel-title mb-3">Invite your friends</h2>
          <div className="rounded-lg border border-gold-400/20 bg-ink-900/70 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Invite code</div>
            <div className="font-display text-3xl font-bold tracking-[0.3em] text-gold-100">{league.invite_code}</div>
          </div>
          {league.status === 'lobby' ? (
            <div className="mt-3 flex gap-2">
              <CopyButton text={inviteUrl} label="Copy invite link" className="flex-1 justify-center" />
              <CopyButton text={league.invite_code} label="Copy code" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">The draft has started, so the league is closed to new managers.</p>
          )}
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="panel-title">League rules</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Managers</dt>
            <dd className="text-right text-gold-100">{members.length} / {league.max_members}</dd>
            <dt className="text-slate-400">Roster size</dt>
            <dd className="text-right text-gold-100">{league.roster_size} players</dd>
            <dt className="text-slate-400">Draft style</dt>
            <dd className="text-right text-gold-100">{league.draft_mode === 'sealed' ? 'Sealed rankings' : 'Live snake'}</dd>
            <dt className="text-slate-400">{league.draft_mode === 'sealed' ? 'Rankings window' : 'Pick clock'}</dt>
            <dd className="text-right text-gold-100">{fmtMinutes(league.pick_minutes)}</dd>
            <dt className="text-slate-400">Play-Ins count</dt>
            <dd className="text-right text-gold-100">{league.count_play_ins ? 'Yes' : 'No'}</dd>
          </dl>
          {isOwner && (
            <button className="btn-ghost w-full" onClick={() => setSettings(true)}>
              <Settings className="h-4 w-4" /> League settings
            </button>
          )}
        </section>

        {league.status === 'lobby' && (
          <section className="panel p-5">
            {isOwner ? (
              <>
                <button className="btn-gold w-full py-3" disabled={members.length < 2} onClick={() => setStarting(true)}>
                  <Play className="h-4 w-4" /> Start the draft
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">{members.length < 2 ? 'Need at least 2 managers.' : 'Order is randomized when you start.'}</p>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-slate-400">Waiting for the owner to start the draft.</p>
                <button
                  className="btn-danger btn-sm mt-3 w-full"
                  onClick={async () => {
                    if (!window.confirm('Leave this league?')) return
                    const res = await toast.attempt(() => api.leave(id), 'You left the league.')
                    if (res.ok) nav('/')
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" /> Leave league
                </button>
              </>
            )}
          </section>
        )}

        {isOwner && (
          <button className="btn-danger btn-sm w-full" onClick={() => setDeleting(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete league
          </button>
        )}
      </aside>

      <Modal open={settings} onClose={() => setSettings(false)} title="League settings">
        <LeagueSettingsForm
          submitLabel="Save settings"
          structureLocked={league.status !== 'lobby'}
          memberCount={members.length}
          initial={{ name: league.name, maxMembers: league.max_members, rosterSize: league.roster_size, pickMinutes: league.pick_minutes, countPlayIns: league.count_play_ins, draftMode: league.draft_mode }}
          onSubmit={async (s) => {
            const res = await toast.attempt(() => api.updateLeague(id, s), 'Settings saved.')
            if (res.ok) {
              setSettings(false)
              reload()
            }
          }}
        />
        {league.status !== 'lobby' && <p className="mt-3 text-xs text-slate-500">Roster size and manager limit are locked once the draft starts.</p>}
      </Modal>

      <Modal open={starting} onClose={() => setStarting(false)} title="Start the draft?">
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            <b className="text-gold-100">{members.length} managers</b> will snake-draft <b className="text-gold-100">{league.roster_size} players</b> each ({totalPicks} picks). Draft order is randomized.{' '}
            {league.draft_mode === 'sealed' ? (
              <>
                Everyone then has <b className="text-gold-100">{fmtMinutes(league.pick_minutes)}</b> to rank players; the whole draft runs the moment rankings lock.
              </>
            ) : (
              <>
                Each manager gets <b className="text-gold-100">{fmtMinutes(league.pick_minutes)}</b> per pick before an auto-pick kicks in.
              </>
            )}
          </p>
          <p className="text-slate-400">Nobody new can join after this. Tell your friends to log in and queue up their favorites first!</p>
          <button
            className="btn-gold w-full py-3"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const res = await toast.attempt(() => api.startDraft(id))
              setBusy(false)
              if (res.ok) {
                setStarting(false)
                reload()
                nav('draft')
              }
            }}
          >
            {busy && <Spinner />} Start draft
          </button>
        </div>
      </Modal>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete this league?">
        <p className="mb-4 text-sm text-slate-300">This permanently removes <b className="text-gold-100">{league.name}</b>, its draft and all rosters for everyone. It can't be undone.</p>
        <button
          className="btn-danger w-full py-3"
          onClick={async () => {
            const res = await toast.attempt(() => api.deleteLeague(id), 'League deleted.')
            if (res.ok) nav('/')
          }}
        >
          <Trash2 className="h-4 w-4" /> Yes, delete it
        </button>
      </Modal>
    </div>
  )
}

function LobbyMembers() {
  const { id, overview: o, reload } = useLeague()
  const toast = useToast()
  const isOwner = o.league.owner_id === o.me
  return (
    <section className="panel p-5">
      <h2 className="panel-title mb-4 flex items-center gap-2">
        <Users className="h-4 w-4" /> Managers ({o.members.length}/{o.league.max_members})
      </h2>
      <ul className="divide-y divide-gold-400/10">
        {o.members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-600 font-display text-sm font-extrabold text-ink-950">
              {m.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-semibold text-gold-50">{m.username}</span>
            {m.user_id === o.me && <span className="pill border-hex-500/40 text-hex-300">you</span>}
            {m.is_owner && <Crown className="h-4 w-4 text-gold-400" aria-label="League owner" />}
            {isOwner && !m.is_owner && (
              <button
                className="btn-danger btn-sm ml-auto"
                onClick={async () => {
                  if (!window.confirm(`Remove ${m.username} from the league?`)) return
                  const res = await toast.attempt(() => api.removeMember(id, m.user_id), `${m.username} removed.`)
                  if (res.ok) reload()
                }}
              >
                <UserMinus className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: Math.max(0, Math.min(o.league.max_members, 12) - o.members.length) }).slice(0, 3).map((_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-3 py-3 text-slate-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-600">+</span>
            Waiting for a friend…
          </li>
        ))}
      </ul>
    </section>
  )
}

function Standings() {
  const { id, overview: o } = useLeague()
  const dir = useDirectory()
  const rosters = useQuery(() => api.rosters(id), [id], { poll: 60_000 })
  const ranked = [...o.members].sort((a, b) => Number(b.points) - Number(a.points))
  const names = new Map(o.members.map((m) => [m.user_id, m.username]))
  const best = [...(rosters.data ?? [])].filter((r) => !r.released_at).sort((a, b) => Number(b.points) - Number(a.points)).slice(0, 5)
  const anyPoints = ranked.some((m) => Number(m.points) !== 0)

  return (
    <>
      <section className="panel overflow-hidden">
        <h2 className="panel-title flex items-center gap-2 p-5 pb-3">
          <Trophy className="h-4 w-4" /> Standings
        </h2>
        <table className="w-full">
          <thead>
            <tr className="border-y border-gold-400/10 bg-black/20">
              <th className="th w-14 text-center">#</th>
              <th className="th">Manager</th>
              <th className="th hidden text-right sm:table-cell">Players</th>
              <th className="th text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m, i) => (
              <tr key={m.user_id} className={clsx('border-b border-gold-400/5 transition hover:bg-white/[.03]', m.user_id === o.me && 'bg-hex-500/[.06]')}>
                <td className="td text-center">
                  <span
                    className={clsx(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-bold',
                      anyPoints && i === 0 ? 'bg-gradient-to-b from-gold-200 to-gold-500 text-ink-950' : anyPoints && i === 1 ? 'bg-slate-300 text-ink-950' : anyPoints && i === 2 ? 'bg-amber-700 text-white' : 'text-slate-400',
                    )}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="td">
                  <Link to="../rosters" className="font-semibold text-gold-50 hover:text-hex-300">
                    {m.username}
                  </Link>
                  {m.user_id === o.me && <span className="pill ml-2 border-hex-500/40 text-hex-300">you</span>}
                </td>
                <td className="td hidden text-right text-slate-400 sm:table-cell">{m.players}</td>
                <td className="td text-right font-display text-lg font-bold text-gold-100">{fmtPts(m.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!anyPoints && <p className="p-4 text-center text-xs text-slate-500">No points yet — they'll appear after the first scored game.</p>}
      </section>

      {best.length > 0 && anyPoints && (
        <section className="panel p-5">
          <h2 className="panel-title mb-3">Top scorers in your league</h2>
          <ul className="divide-y divide-gold-400/10">
            {best.map((r) => (
              <li key={r.spot_id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <PlayerCell player={dir.byId.get(r.player_id)} />
                </div>
                <div className="hidden text-xs text-slate-400 sm:block">{names.get(r.user_id)}</div>
                <div className="w-16 text-right font-display font-bold text-gold-100">{fmtPts(r.points)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rosters.loading && !rosters.data && <EmptyState title="Loading rosters…" />}
    </>
  )
}
