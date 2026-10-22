import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, KeyRound, Plus, Swords, Timer, TrendingUp, Users } from 'lucide-react'
import clsx from 'clsx'
import { AuthCard, takeReturnTo } from '../components/AuthCard'
import { Countdown, RoleBadge, StatusPill } from '../components/game'
import { LeagueSettingsForm } from '../components/LeagueSettingsForm'
import { EmptyState, ErrorBox, Modal, PageHeader, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useQuery } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { ROLES } from '../lib/types'
import type { LeagueSummary } from '../lib/types'

export function Home() {
  const { status } = useAuth()
  return status === 'in' ? <Dashboard /> : <Landing />
}

function Landing() {
  const features = [
    { icon: Timer, title: 'Draft on your own time', body: 'A snake draft with a pick clock. Take a turn whenever you like — nobody can scoop up the whole board while you sleep.' },
    { icon: BellRing, title: 'Never miss a pick', body: 'Build a queue and flip on auto-draft. If your clock runs out we pick the best player left for you.' },
    { icon: TrendingUp, title: 'Real Worlds stats', body: 'Kills, deaths, assists and CS are pulled automatically from Riot\'s esports feed after every single game.' },
  ]
  return (
    <div className="grid items-center gap-10 pt-4 lg:grid-cols-[1.25fr_1fr] lg:pt-10">
      <div className="animate-rise">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-hex-500/30 bg-hex-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-hex-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hex-400" /> League of Legends · Worlds 2026
        </div>
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">
          <span className="gold-text">Draft the world's</span>
          <br />
          <span className="text-gold-50">best. Beat your friends.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-400">
          Build a roster from the 80 players at Worlds, then watch the points roll in game by game. Private leagues, a fair draft, and bragging rights.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <RoleBadge key={r} role={r} className="px-2.5 py-1 text-xs" />
          ))}
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="panel p-4" style={{ animationDelay: `${i * 80}ms` }}>
              <f.icon className="mb-3 h-6 w-6 text-gold-400" />
              <div className="font-display text-sm font-bold text-gold-100">{f.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute -inset-6 -z-10 animate-floaty rounded-full bg-hex-500/10 blur-3xl" />
        <AuthCard />
        <p className="mt-3 text-center text-xs text-slate-500">
          New here? The <Link to="/rules" className="text-hex-400 underline">rules</Link> take one minute.
        </p>
      </div>
    </div>
  )
}

function Dashboard() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const leagues = useQuery(() => api.myLeagues(), [], { poll: 30_000 })
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')

  // Came back from Google after opening an invite link or league page? Continue there.
  useEffect(() => {
    const back = takeReturnTo()
    if (back && back !== '/') nav(back, { replace: true })
  }, [nav])

  const list = leagues.data ?? []

  return (
    <>
      <PageHeader
        eyebrow={`Welcome back${profile ? `, ${profile.username}` : ''}`}
        title="Your leagues"
        actions={
          <>
            <button className="btn-ghost" onClick={() => setJoining(true)}>
              <KeyRound className="h-4 w-4" /> Join with code
            </button>
            <button className="btn-gold" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Create league
            </button>
          </>
        }
      />

      {leagues.error && !leagues.data && <ErrorBox error={leagues.error} retry={leagues.reload} />}

      {leagues.loading && !leagues.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length === 0 && !leagues.error ? (
        <div className="panel">
          <EmptyState icon={<Swords className="h-10 w-10" />} title="No leagues yet">
            Create one and send the invite link to your friends — or paste a code someone sent you.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((l, i) => (
            <LeagueCard key={l.id} league={l} index={i} />
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create a league">
        <LeagueSettingsForm
          submitLabel="Create league"
          onSubmit={async (s) => {
            const res = await toast.attempt(() => api.createLeague(s))
            if (res.ok) nav(`/league/${res.value}`)
          }}
        />
      </Modal>

      <Modal open={joining} onClose={() => setJoining(false)} title="Join a league">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const c = code.trim().toUpperCase()
            if (c) nav(`/join/${c}`)
          }}
        >
          <label className="label" htmlFor="code">Invite code</label>
          <input id="code" className="input text-center font-display text-2xl uppercase tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} placeholder="ABC23XY" autoFocus />
          <button className="btn-gold w-full" disabled={!code.trim()}>
            Find league
          </button>
        </form>
      </Modal>
    </>
  )
}

function LeagueCard({ league: l, index }: { league: LeagueSummary; index: number }) {
  const yourTurn = l.status === 'drafting' && l.my_turn
  return (
    <Link
      to={`/league/${l.id}${l.status === 'drafting' ? '/draft' : ''}`}
      className={clsx('panel panel-hover group block animate-rise p-5', yourTurn && 'animate-glow border-gold-400/70')}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-bold leading-tight text-gold-100">{l.name}</h3>
        <StatusPill status={l.status} />
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {l.members}/{l.max_members}
        </span>
        <span>{l.roster_size}-player rosters</span>
      </div>
      <div className="divider my-4" />
      {l.status === 'drafting' && l.draft_mode === 'sealed' ? (
        <div className="flex items-center justify-between text-sm text-gold-200">
          <span className="font-semibold">Rank your players</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Timer className="h-3.5 w-3.5" /> locks in <Countdown deadline={l.pick_deadline} />
          </span>
        </div>
      ) : l.status === 'drafting' ? (
        yourTurn ? (
          <div className="flex items-center justify-between text-sm font-semibold text-gold-200">
            <span>It's your pick!</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <Timer className="h-3.5 w-3.5" /> <Countdown deadline={l.pick_deadline} />
            </span>
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            <b className="text-gold-100">{l.on_clock}</b> is on the clock
          </div>
        )
      ) : l.status === 'lobby' ? (
        <div className="text-sm text-slate-400">Waiting for the owner to start the draft</div>
      ) : (
        <div className="text-sm text-slate-400">Draft complete — scores update after every game</div>
      )}
      <div className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-hex-400 opacity-0 transition group-hover:opacity-100">
        Open <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  )
}
