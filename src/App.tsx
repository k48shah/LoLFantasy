import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { PageLoader, Modal, Field } from './components/ui'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/backend'
import { useToast } from './lib/toast'
import { Home } from './pages/Home'
import { JoinPage } from './pages/Join'
import { LeagueLayout } from './pages/league/LeagueLayout'
import { Overview } from './pages/league/Overview'
import { DraftRoom } from './pages/league/DraftRoom'
import { Rosters } from './pages/league/Rosters'
import { Trades } from './pages/league/Trades'
import { PlayersPage } from './pages/Players'
import { SchedulePage } from './pages/Schedule'
import { RulesPage } from './pages/Rules'
import { AuthGate } from './components/AuthCard'
import { DemoBar } from './components/DemoBar'
import { SetupNeeded } from './pages/SetupNeeded'
import { NotFound } from './pages/NotFound'

export default function App() {
  const { status, recovering } = useAuth()
  if (!isConfigured()) return <SetupNeeded />
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        {status === 'loading' ? (
          <PageLoader />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/join/:code" element={<AuthGate><JoinPage /></AuthGate>} />
            <Route path="/league/:id" element={<AuthGate><LeagueLayout /></AuthGate>}>
              <Route index element={<Overview />} />
              <Route path="draft" element={<DraftRoom />} />
              <Route path="rosters" element={<Rosters />} />
              <Route path="trades" element={<Trades />} />
            </Route>
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </main>
      <footer className="border-t border-gold-400/10 py-6 text-center text-xs text-slate-500">
        Worlds Fantasy · built for friends · game data from Riot's LoL Esports feed · not endorsed by Riot Games
      </footer>
      <DemoBar />
      {recovering && <RecoveryModal />}
    </div>
  )
}

function RecoveryModal() {
  const { setPassword, finishRecovery } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={finishRecovery} title="Choose a new password">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (pw.length < 6) return toast.error('Use at least 6 characters.')
          setBusy(true)
          const res = await toast.attempt(() => setPassword(pw), 'Password updated.')
          setBusy(false)
          if (res.ok) finishRecovery()
        }}
      >
        <Field label="New password">
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
        </Field>
        <button className="btn-gold w-full" disabled={busy}>
          Save password
        </button>
      </form>
    </Modal>
  )
}
