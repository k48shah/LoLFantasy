// The single seam between the UI and "the server".
// Production: Supabase.  `npm run dev:demo`: the very same SQL, running in-browser on PGlite.

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthEvent {
  user: AuthUser | null
}

export interface Backend {
  readonly kind: 'supabase' | 'demo'
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  auth: {
    getUser(): Promise<AuthUser | null>
    onChange(cb: (e: AuthEvent) => void): () => void
    /** Redirects to Google (production) or signs in as a named demo user (demo). */
    signInWithGoogle(demoName?: string): Promise<void>
    signOut(): Promise<void>
  }
  /** Only present in demo mode. */
  demo?: {
    expireClock(leagueId: string): Promise<void>
    usernames(): Promise<string[]>
  }
}

export class UserFacingError extends Error {}

let instance: Promise<Backend> | null = null

export function getBackend(): Promise<Backend> {
  if (!instance) {
    instance = (async () => {
      if (__DEMO__) {
        const { createDemoBackend } = await import('./demoBackend')
        return createDemoBackend()
      }
      const { createSupabaseBackend } = await import('./supabaseBackend')
      return createSupabaseBackend()
    })()
  }
  return instance
}

export const isConfigured = () =>
  __DEMO__ || (!!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY)
