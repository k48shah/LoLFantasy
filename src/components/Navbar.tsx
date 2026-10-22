import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, Pencil, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Field, Modal } from './ui'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0 drop-shadow-[0_0_8px_rgba(10,200,185,.45)]" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0e6d2" />
            <stop offset="1" stopColor="#9a7634" />
          </linearGradient>
          <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6ecd2" />
            <stop offset="1" stopColor="#b8934a" />
          </linearGradient>
        </defs>
        <path d="M32 3l25 14.5v29L32 61 7 46.500v-29z" fill="#050f1e" stroke="url(#lg)" strokeWidth="3" />
        <path d="M32 9l20 11.500v23L32 55 12 43.500v-23z" fill="#0ac8b9" fillOpacity=".12" />
        {/* crown */}
        <path d="M16 25l9 9 7-12 7 12 9-9-3.500 19h-25z" fill="url(#lc)" />
        <rect x="20" y="46" width="24" height="3.500" rx="1.500" fill="#0ac8b9" />
        <circle cx="32" cy="18" r="2.800" fill="#6fe6dc" />
        <circle cx="16" cy="23" r="2.200" fill="#6fe6dc" />
        <circle cx="48" cy="23" r="2.200" fill="#6fe6dc" />
      </svg>
      <span className="font-display font-extrabold leading-none text-gold-100">
        <span className="block text-[15px] uppercase tracking-[0.16em] sm:text-lg">Fantasy</span>
        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-hex-400 sm:text-[11px]">
          with the <span className="text-gold-300">Boiz</span>
        </span>
      </span>
    </span>
  )
}

const links = [
  { to: '/', label: 'Leagues', end: true },
  { to: '/players', label: 'Players' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/rules', label: 'Rules' },
]

export function Navbar() {
  const { status, profile, signOut, renameSelf } = useAuth()
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [rename, setRename] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const loc = useLocation()

  useEffect(() => setMobile(false), [loc.pathname])
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <nav className="sticky top-0 z-40 border-b border-gold-400/15 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Fantasy with the Boiz home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                clsx('rounded-md px-3 py-2 text-sm font-semibold transition', isActive ? 'bg-gold-400/10 text-gold-100 shadow-[inset_0_-2px_0_#c8aa6e]' : 'text-slate-400 hover:text-gold-100')
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status === 'in' && (
            <div className="relative" ref={ref}>
              <button className="btn-ghost btn-sm gap-2" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-600 text-[11px] font-extrabold text-ink-950">
                  {(profile?.username ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[9rem] truncate sm:inline">{profile?.username ?? '…'}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {menu && (
                <div role="menu" className="panel absolute right-0 mt-2 w-48 animate-pop p-1.5 shadow-2xl">
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                    onClick={() => {
                      setName(profile?.username ?? '')
                      setRename(true)
                      setMenu(false)
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Change username
                  </button>
                  <button role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5" onClick={() => void signOut()}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="rounded-md p-2 text-slate-300 hover:bg-white/5 md:hidden" onClick={() => setMobile((v) => !v)} aria-label="Menu">
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobile && (
        <div className="border-t border-gold-400/10 px-4 py-2 md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => clsx('block rounded-md px-3 py-3 text-sm font-semibold', isActive ? 'bg-gold-400/10 text-gold-100' : 'text-slate-300')}>
              {l.label}
            </NavLink>
          ))}
        </div>
      )}

      <Modal open={rename} onClose={() => setRename(false)} title="Change username">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const res = await toast.attempt(() => renameSelf(name.trim()), 'Username updated.')
            if (res.ok) setRename(false)
          }}
        >
          <Field label="Username" hint="2–20 characters: letters, numbers, _ or -">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} pattern="[A-Za-z0-9_\-]{2,20}" required />
          </Field>
          <button className="btn-gold w-full">Save</button>
        </form>
      </Modal>
    </nav>
  )
}
