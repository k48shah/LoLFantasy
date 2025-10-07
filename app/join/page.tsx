'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Users, ArrowRight } from 'lucide-react'

export default function JoinLeaguePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

    async function joinLeague() {
    if (!inviteCode.trim()) {
        setError('Please enter an invite code')
        return
    }

    setLoading(true)
    setError('')

    try {
        console.log('Looking for league with code:', inviteCode.toUpperCase())

        // Find league by invite code
        const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

        console.log('League found:', league)

        if (leagueError || !league) {
        setError('Invalid invite code')
        setLoading(false)
        return
        }

        // Check if already in league
        const currentDraftOrder = league.draft_order as string[] || []
        
        if (currentDraftOrder.includes(user!.id)) {
        setError('You are already in this league')
        setLoading(false)
        router.push('/draft')
        return
        }

        // Add user to draft order
        const newDraftOrder = [...currentDraftOrder, user!.id]
        
        console.log('Updating draft order from', currentDraftOrder, 'to', newDraftOrder)

        const { error: updateError } = await supabase
        .from('leagues')
        .update({ draft_order: newDraftOrder })
        .eq('id', league.id)

        if (updateError) {
        console.error('Error updating draft order:', updateError)
        setError('Failed to join league')
        setLoading(false)
        return
        }

        console.log('✅ Successfully joined league!')
        router.push('/draft')
    } catch (err) {
        console.error('Error joining league:', err)
        setError('Failed to join league')
        setLoading(false)
    }
    }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-dark-800 rounded-lg p-8">
          <div className="text-center mb-6">
            <Users className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Join a League</h1>
            <p className="text-gray-400">Enter the invite code shared by your league commissioner</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="w-full px-4 py-3 bg-dark-700 text-white rounded-lg border border-dark-600 focus:border-primary-500 focus:outline-none uppercase"
                maxLength={8}
              />
            </div>

            {error && (
              <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={joinLeague}
              disabled={loading || !inviteCode}
              className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Joining...' : 'Join League'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}