import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getBackend } from './backend'
import type { AuthUser, Backend } from './backend'
import { api } from './api'
import type { Profile } from './types'

type Status = 'loading' | 'out' | 'in'

interface AuthValue {
  status: Status
  user: AuthUser | null
  profile: Profile | null
  backend: Backend | null
  signInWithGoogle(demoName?: string): Promise<void>
  signOut(): Promise<void>
  renameSelf(username: string): Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let off = () => {}
    let cancelled = false
    ;(async () => {
      const b = await getBackend()
      if (cancelled) return
      setBackend(b)
      const u = await b.auth.getUser()
      if (cancelled) return
      setUser(u)
      setStatus(u ? 'in' : 'out')
      off = b.auth.onChange((e) => {
        setUser(e.user)
        setStatus(e.user ? 'in' : 'out')
        if (!e.user) setProfile(null)
      })
    })().catch(() => setStatus('out'))
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // The profile row is created by a database trigger at sign-up, so it normally exists already.
    // Retry briefly to ride out any replication lag instead of showing an empty name.
    ;(async () => {
      for (let i = 0; i < 4 && !cancelled; i++) {
        try {
          const p = await api.profile()
          if (p && !cancelled) return setProfile(p)
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 400 * (i + 1)))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const need = useCallback(() => {
    if (!backend) throw new Error('Still starting up — try again in a second.')
    return backend
  }, [backend])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      profile,
      backend,
      signInWithGoogle: (demoName) => need().auth.signInWithGoogle(demoName),
      signOut: () => need().auth.signOut(),
      renameSelf: async (username) => {
        await api.updateUsername(username)
        setProfile(await api.profile())
      },
    }),
    [status, user, profile, backend, need],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
