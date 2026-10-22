import { createClient } from '@supabase/supabase-js'
import type { Backend } from './backend'

/** Turns Postgres/PostgREST errors into something a friend can read. */
function friendly(message: string): string {
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Can\'t reach the server. Check your connection and try again.'
  if (/JWT expired|invalid JWT/i.test(message)) return 'Your session expired — please sign in again.'
  if (/Could not find the function|schema cache/i.test(message)) return 'The database isn\'t set up yet (schema.sql hasn\'t been run).'
  return message
}

export function createSupabaseBackend(): Backend {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
    // PKCE keeps auth tokens out of the URL hash, which the hash router owns.
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  const toUser = (u: { id: string; email?: string | null } | null | undefined) => (u ? { id: u.id, email: u.email ?? null } : null)

  return {
    kind: 'supabase',
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await client.rpc(fn, args)
      if (error) throw new Error(friendly(error.message))
      return data as T
    },
    auth: {
      async getUser() {
        const { data } = await client.auth.getSession()
        return toUser(data.session?.user)
      },
      onChange(cb) {
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          cb({ user: toUser(session?.user) })
        })
        return () => data.subscription.unsubscribe()
      },
      async signInWithGoogle() {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
        })
        if (error) throw new Error(friendly(error.message))
      },
      async signOut() {
        await client.auth.signOut()
      },
    },
  }
}
