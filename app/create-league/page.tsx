'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Trophy } from 'lucide-react'

export default function CreateLeaguePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [leagueName, setLeagueName] = useState('')
  const [loading, setLoading] = useState(false)

  async function createLeague() {
    if (!leagueName.trim()) return

    setLoading(true)

    try {
      // Generate invite code
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      // Create league
      const { data: league, error } = await supabase
        .from('leagues')
        .insert({
          name: leagueName,
          owner_id: user!.id,
          invite_code: inviteCode,
          draft_order: [user!.id],
          max_teams: 8,
        })
        .select()
        .single()

      if (error) throw error

      router.push('/draft')
    } catch (error) {
      console.error('Error creating league:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-dark-800 rounded-lg p-8">
          <div className="text-center mb-6">
            <Trophy className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Create League</h1>
            <p className="text-gray-400">Start your fantasy league for Worlds 2025</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                League Name
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g., Worlds 2025 Fantasy"
                className="w-full px-4 py-3 bg-dark-700 text-white rounded-lg border border-dark-600 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <button
              onClick={createLeague}
              disabled={loading || !leagueName}
              className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create League'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}