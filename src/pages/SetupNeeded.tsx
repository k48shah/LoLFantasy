import { Logo } from '../components/Navbar'

export function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6 py-12">
      <Logo />
      <div className="panel space-y-3 p-6 text-sm text-slate-300">
        <h1 className="font-display text-2xl text-gold-100">Almost there — connect Supabase</h1>
        <p>
          This build has no Supabase connection. Set <code className="rounded bg-black/40 px-1.5 py-0.5 text-hex-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-hex-300">VITE_SUPABASE_ANON_KEY</code> (in <code>.env.local</code> for local dev, or as the
          <code> SUPABASE_URL</code> / <code>SUPABASE_ANON_KEY</code> repository secrets for the deployed site), then rebuild.
        </p>
        <p>
          Want to look around first? Run <code className="rounded bg-black/40 px-1.5 py-0.5 text-hex-300">npm run dev:demo</code> for a fully working offline demo.
        </p>
        <p className="text-slate-500">Full steps are in README.md.</p>
      </div>
    </div>
  )
}
