'use client'
import { useAuth } from '@/components/AuthProvider'
import { LoginPage } from '@/components/LoginPage'
import Link from 'next/link'
import { Trophy, Users, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const { user, loading } = useAuth()
  const [hasLeague, setHasLeague] = useState(false)
  const [checkingLeague, setCheckingLeague] = useState(true)

  useEffect(() => {
    console.log('Env check:', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL
    })
    if (user) {
      checkLeagueMembership()
    } else if (!loading) {
      // If no user and auth finished loading, stop checking
      setCheckingLeague(false)
    }
  }, [user, loading])

  async function checkLeagueMembership() {
    // Add timeout
    const timeout = setTimeout(() => {
      console.warn('League check timed out')
      setCheckingLeague(false)
    }, 3000)

    try {
      const { data: ownedLeague } = await supabase
        .from('leagues')
        .select('id')
        .eq('owner_id', user!.id)
        .maybeSingle()

      if (ownedLeague) {
        clearTimeout(timeout)
        setHasLeague(true)
        setCheckingLeague(false)
        return
      }

      const { data: roster } = await supabase
        .from('fantasy_rosters')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle()

      clearTimeout(timeout)
      setHasLeague(!!roster)
    } catch (error) {
      clearTimeout(timeout)
      console.error('Error checking league:', error)
    } finally {
      setCheckingLeague(false)
    }
  }

  // Show loading only while auth OR league check is happening
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  // Show content even if league check is still happening
  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Trophy className="w-20 h-20 text-primary-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to LoL Fantasy
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link
            href="/create-league"
            className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition"
          >
            <Plus className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Create League</h3>
            <p className="text-gray-400">Start your own fantasy league</p>
          </Link>

          <Link
            href="/join"
            className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition"
          >
            <Users className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Join League</h3>
            <p className="text-gray-400">Enter an invite code</p>
          </Link>

          {!checkingLeague && hasLeague && (
            <Link
              href="/draft"
              className="bg-dark-800 hover:bg-dark-700 p-8 rounded-lg text-center transition border-2 border-primary-600"
            >
              <Trophy className="w-12 h-12 text-primary-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">My League</h3>
              <p className="text-gray-400">Go to draft</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}