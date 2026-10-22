import { useAuth } from '../lib/auth'
import { FlaskConical } from 'lucide-react'

/** Visible only in demo mode, so nobody mistakes it for the real thing. */
export function DemoBar() {
  const { backend } = useAuth()
  if (backend?.kind !== 'demo') return null
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-full border border-hex-500/40 bg-ink-900/90 px-3 py-1.5 text-xs text-hex-300 shadow-xl backdrop-blur">
      <FlaskConical className="h-3.5 w-3.5" /> Demo mode · data resets on reload
    </div>
  )
}
