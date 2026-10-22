// The single seam between the UI and "the server".
// Production: Supabase.  `npm run dev:demo`: the very same SQL, running in-browser on PGlite.

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthEvent {
  user: AuthUser | null
  /** True when the user arrived from a password-reset email. */
  recovery?: boolean
}

export interface Backend {
  readonly kind: 'supabase' | 'demo'
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  auth: {
    getUser(): Promise<AuthUser | null>
    onChange(cb: (e: AuthEvent) => void): () => void
    signUp(email: string, password: string, username: string): Promise<{ needsConfirmation: boolean }>
    signIn(email: string, password: string): Promise<void>
    signOut(): Promise<void>
    sendReset(email: string): Promise<void>
    setPassword(password: string): Promise<void>
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
