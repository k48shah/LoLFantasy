'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('🔐 AuthProvider mounted, checking session...')
    
    // Check active sessions
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        console.log('📋 Session result:', { session, error })
        setUser(session?.user ?? null)
        setLoading(false)
        console.log('✅ Auth loading complete. User:', session?.user?.email || 'none')
      })
      .catch((err) => {
        console.error('❌ Session check error:', err)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Auth state changed:', _event, session?.user?.email || 'none')
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      console.log('🔌 Unsubscribing from auth changes')
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  console.log('🎨 Rendering AuthProvider. Loading:', loading, 'User:', user?.email || 'none')

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}