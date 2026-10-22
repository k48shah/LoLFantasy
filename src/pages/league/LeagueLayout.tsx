import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { StatusPill } from '../../components/game'
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui'
import { api } from '../../lib/api'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import type { LeagueCtx } from './context'

export function LeagueLayout() {
  const { id = '' } = useParams()
  const q = useQuery(() => api.overview(id), [id], { poll: 15_000 })
  const o = q.data

  const myTurn = !!o && o.league.status === 'drafting' && o.league.on_clock === o.me
  useDocumentTitle(o ? `${myTurn ? '● YOUR PICK · ' : ''}${o.league.name} · Fantasy with the Boiz` : null)

  if (q.loading && !o) return <PageLoader label="Loading league…" />
  if (!o) {
    const notMember = q.error?.message.includes('not in that league')
    return (
      <div className="mx-auto max-w-lg">
        {notMember ? (
          <div className="panel">
            <EmptyState title="You're not in this league">
              Ask the league owner for an invite link.{' '}
              <Link to="/" className="text-hex-400 underline">Back to your leagues</Link>
            </EmptyState>
          </div>
        ) : (
          <ErrorBox error={q.error ?? new Error('League not found')} retry={q.reload} />
        )}
      </div>
    )
  }

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'draft', label: 'Draft', badge: myTurn },
    { to: 'rosters', label: 'Rosters' },
    { to: 'trades', label: 'Trades' },
  ]
  const ctx: LeagueCtx = { id, overview: o, reload: () => void q.reload() }

  return (
    <div>
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-gold-200">
        <ArrowLeft className="h-3.5 w-3.5" /> All leagues
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-gold-100 sm:text-4xl">{o.league.name}</h1>
        <StatusPill status={o.league.status} />
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gold-400/15">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              clsx(
                'relative -mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition',
                isActive ? 'border-gold-400 text-gold-100' : 'border-transparent text-slate-400 hover:text-gold-100',
              )
            }
          >
            {t.label}
            {t.badge && <span className="ml-2 inline-block h-2 w-2 animate-ping rounded-full bg-gold-300 align-middle" aria-label="Your pick" />}
          </NavLink>
        ))}
      </div>
      <Outlet context={ctx} />
    </div>
  )
}
