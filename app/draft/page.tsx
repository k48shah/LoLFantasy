'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { Player, League, FantasyRoster } from '../../lib/supabase'
import { Trophy, Users, CheckCircle } from 'lucide-react'
import { getUserLeague } from '../../lib/league-helpers'

export default function DraftPage() {
  const { user, loading: authLoading } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [draftedPlayers, setDraftedPlayers] = useState<Set<string>>(new Set())
  const [currentPick, setCurrentPick] = useState(1)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('disconnected')



  useEffect(() => {
    // Wait for auth to finish loading AND user to be available
    if (!authLoading && user) {
      loadDraftData()
      subscribeToUpdates()
    } else if (!authLoading && !user) {
      // Auth finished but no user - redirect to home
      setLoading(false)
    }
  }, [user, authLoading])

    async function loadDraftData() {
    try {
        console.log('🔍 Loading draft for user:', user?.id)

        // Use the helper function instead of manual queries
        const leagueData = await getUserLeague(user!.id)

        if (!leagueData) {
        console.error('❌ No league found for user')
        setLoading(false)
        return
        }

        console.log('✅ League found:', leagueData.name)
        setLeague(leagueData)
        setCurrentPick(leagueData.current_pick)
        
        // Check if it's user's turn
        const draftOrder = leagueData.draft_order as string[]
        if (draftOrder && draftOrder.length > 0) {
        const currentUserIndex = getCurrentPickUser(leagueData.current_pick, draftOrder.length)
        setIsMyTurn(draftOrder[currentUserIndex] === user!.id)
        }

        // Load all players
        const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .order('name')

        if (playersData) {
        setPlayers(playersData)
        }

        // Load drafted players
        const { data: rostersData } = await supabase
        .from('fantasy_rosters')
        .select('player_id')
        .eq('league_id', leagueData.id)

        if (rostersData) {
        setDraftedPlayers(new Set(rostersData.map(r => r.player_id)))
        }

        setLoading(false)
    } catch (error) {
        console.error('Error loading draft data:', error)
        setLoading(false)
    }
    }

function subscribeToUpdates() {
  if (!league) return () => {}

  const channel = supabase
    .channel(`draft-updates-${league.id}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user!.id }
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'fantasy_rosters',
        filter: `league_id=eq.${league.id}`,
      },
      (payload) => {
        console.log('🎯 Real-time update received:', payload.new)
        handleDraftUpdate(payload.new)
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status)
      setSubscriptionStatus(status)
    })

  console.log('✅ Subscribed to draft updates for league:', league.id)

  return () => {
    console.log('🔌 Unsubscribing from draft updates')
    supabase.removeChannel(channel)
  }
}

// Separate handler for draft updates
function handleDraftUpdate(newRoster: any) {
  console.log('Processing draft update:', newRoster)
  
  // Update drafted players
  setDraftedPlayers(prev => {
    const newSet = new Set(Array.from(prev))
    newSet.add(newRoster.player_id)
    return newSet
  })
  
  // Update current pick
  setCurrentPick(prevPick => {
    const newPick = prevPick + 1
    console.log('Pick incremented from', prevPick, 'to', newPick)
    return newPick
  })
}

    // Update useEffect to include league dependency
    useEffect(() => {
    if (!league || !user) return

    const pollInterval = setInterval(async () => {
        try {
        // Get current league state from database
        const { data: leagueData } = await supabase
            .from('leagues')
            .select('current_pick')
            .eq('id', league.id)
            .single()

        if (leagueData && leagueData.current_pick !== currentPick) {
            console.log('🔄 Polling detected pick change:', leagueData.current_pick)
            setCurrentPick(leagueData.current_pick)
            
            // Also refresh drafted players
            const { data: rostersData } = await supabase
            .from('fantasy_rosters')
            .select('player_id')
            .eq('league_id', league.id)

            if (rostersData) {
            setDraftedPlayers(new Set(rostersData.map(r => r.player_id)))
            }
        }
        } catch (error) {
        console.error('Polling error:', error)
        }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
    }, [league?.id, currentPick, user])

    // Keep the useEffect that syncs isMyTurn
    useEffect(() => {
    if (league && league.draft_order && user) {
        const draftOrder = league.draft_order as string[]
        const currentPickIndex = getCurrentPickUser(currentPick, draftOrder.length)
        const myTurn = draftOrder[currentPickIndex] === user.id
        
        console.log('🎯 Turn check - Pick:', currentPick, 'Index:', currentPickIndex, 'Their ID:', draftOrder[currentPickIndex], 'My ID:', user.id, 'My turn:', myTurn)
        setIsMyTurn(myTurn)
    }
    }, [currentPick, league, user])

  function getCurrentPickUser(pickNum: number, teamCount: number): number {
    const round = Math.floor((pickNum - 1) / teamCount)
    const posInRound = (pickNum - 1) % teamCount
    
    // Snake draft: odd rounds go reverse
    return round % 2 === 0 ? posInRound : teamCount - 1 - posInRound
  }


async function draftPlayer(playerId: string) {
  if (!isMyTurn || !league) return
  
  if (draftedPlayers.has(playerId)) {
    alert('This player has already been drafted!')
    return
  }

  // Optimistic update
  setDraftedPlayers(prev => {
    const newSet = new Set(Array.from(prev))
    newSet.add(playerId)
    return newSet
  })

  try {
    const { error } = await supabase
      .from('fantasy_rosters')
      .insert({
        league_id: league.id,
        user_id: user!.id,
        player_id: playerId,
        is_starter: true,
      })

    if (error) {
      // Revert optimistic update
      setDraftedPlayers(prev => {
        const newSet = new Set(Array.from(prev))
        newSet.delete(playerId)
        return newSet
      })
      
      if (error.code === '23505') {
        alert('This player was just drafted by someone else!')
      } else {
        console.error('Error drafting player:', error)
        alert('Failed to draft player. Please try again.')
      }
      return
    }

    // Update league current pick
    const newPick = currentPick + 1
    await supabase
      .from('leagues')
      .update({ current_pick: newPick })
      .eq('id', league.id)

    // Record draft pick
    await supabase
      .from('draft_picks')
      .insert({
        league_id: league.id,
        user_id: user!.id,
        player_id: playerId,
        pick_number: currentPick,
        round: Math.floor((currentPick - 1) / (league.draft_order as string[]).length) + 1,
      })

    // Update local state (increment our own pick)
    setCurrentPick(newPick)
    const draftOrder = league.draft_order as string[]
    const nextPickIndex = getCurrentPickUser(newPick, draftOrder.length)
    setIsMyTurn(draftOrder[nextPickIndex] === user!.id)

    console.log('✅ Successfully drafted player')

  } catch (error) {
    // Revert optimistic update
    setDraftedPlayers(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.delete(playerId)
      return newSet
    })
    console.error('Error drafting player:', error)
    alert('Failed to draft player. Please try again.')
  }
}

  const filteredPlayers = players.filter(p => {
    const roleMatch = selectedRole === 'all' || p.role === selectedRole
    const notDrafted = !draftedPlayers.has(p.id)
    return roleMatch && notDrafted
  })

  // Show loading while auth is loading OR data is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading draft...
      </div>
    )
  }

  // Show message if no user (shouldn't happen with AuthProvider)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Please sign in to access the draft
      </div>
    )
  }

  // Show message if no league found
  if (!league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No league found. Create one first!</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Draft Header */}
      <div className="bg-dark-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary-500" />
              {league.name} - Draft
            </h1>
    <p className="text-gray-400 mt-2">
      Pick #{currentPick} • Round {Math.floor((currentPick - 1) / (league.draft_order as string[]).length) + 1}
      {subscriptionStatus === 'SUBSCRIBED' && (
        <span className="ml-2 text-green-400 text-xs">● Live</span>
      )}
      {subscriptionStatus !== 'SUBSCRIBED' && (
        <span className="ml-2 text-yellow-400 text-xs">● Syncing...</span>
      )}
    </p>
          </div>
          <div className={`px-6 py-3 rounded-lg font-bold ${isMyTurn ? 'bg-primary-600 text-white' : 'bg-dark-700 text-gray-400'}`}>
            {isMyTurn ? '🎯 YOUR TURN' : 'Waiting...'}
          </div>
        </div>
<div className="mt-4 pt-4 border-t border-dark-700">
  <button
    onClick={() => setShowInviteCode(!showInviteCode)}
    className="text-sm text-primary-400 hover:text-primary-300"
  >
    {showInviteCode ? 'Hide' : 'Show'} Invite Code
  </button>
  {showInviteCode && (
    <div className="mt-2 bg-dark-700 p-4 rounded-lg">
      <p className="text-sm text-gray-400 mb-2">Share this code with friends:</p>
      <div className="flex items-center gap-2">
        <code className="text-2xl font-bold text-primary-400">{league.invite_code}</code>
        <button
          onClick={() => navigator.clipboard.writeText(league.invite_code)}
          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm"
        >
          Copy
        </button>
      </div>
    </div>
  )}
</div>

        {/* Turn Order Display */}
        <DraftTurnOrder 
          league={league}
          currentPick={currentPick}
          currentUserId={user!.id}
        />
      </div>

        {/* Role Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {['all', 'top', 'jungle', 'mid', 'adc', 'support'].map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                selectedRole === role
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              {role.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onDraft={() => draftPlayer(player.id)}
              canDraft={isMyTurn}
              isDrafted={draftedPlayers.has(player.id)}
            />
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No players available in this role
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerCard({ 
  player, 
  onDraft, 
  canDraft, 
  isDrafted 
}: { 
  player: Player
  onDraft: () => void
  canDraft: boolean
  isDrafted: boolean
}) {
  const roleColors = {
    top: 'bg-blue-600',
    jungle: 'bg-green-600',
    mid: 'bg-yellow-600',
    adc: 'bg-red-600',
    support: 'bg-purple-600',
  }

  return (
    <div className={`bg-dark-800 rounded-lg p-4 border-2 transition ${
      isDrafted ? 'border-dark-600 opacity-50' : 'border-dark-700 hover:border-primary-600'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{player.name}</h3>
          <p className="text-sm text-gray-400">{player.team}</p>
        </div>
        <span className={`${roleColors[player.role]} px-2 py-1 rounded text-xs font-bold text-white uppercase`}>
          {player.role}
        </span>
      </div>

      {isDrafted ? (
        <div className="flex items-center justify-center py-2 text-gray-500">
          <CheckCircle className="w-5 h-5 mr-2" />
          Drafted
        </div>
      ) : (
        <button
          onClick={onDraft}
          disabled={!canDraft || isDrafted}
          className={`w-full py-2 rounded-lg font-medium transition ${
            canDraft && !isDrafted
              ? 'bg-primary-600 hover:bg-primary-700 text-white cursor-pointer'
              : 'bg-dark-700 text-gray-500 cursor-not-allowed opacity-50'
          }`}
        >
          {!canDraft ? 'Not Your Turn' : 'Draft'}
        </button>
      )}
    </div>
  )
}

function DraftTurnOrder({ 
  league, 
  currentPick, 
  currentUserId 
}: { 
  league: League
  currentPick: number
  currentUserId: string
}) {
  const [teamNames, setTeamNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    loadTeamNames()
  }, [league])

  async function loadTeamNames() {
    const draftOrder = league.draft_order as string[]
    
    console.log('Loading names for draft order:', draftOrder)
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .in('id', draftOrder)

    console.log('Users loaded:', data, error)

    if (data) {
      const nameMap = new Map(data.map(u => [u.id, u.username]))
      console.log('Name map:', nameMap)
      setTeamNames(nameMap)
    }
  }

  const draftOrder = league.draft_order as string[]
  const round = Math.floor((currentPick - 1) / draftOrder.length)
  const currentPickIndex = getCurrentPickUser(currentPick, draftOrder.length)
  const isSnakeRound = round % 2 === 1

  const displayOrder = isSnakeRound ? [...draftOrder].reverse() : draftOrder

  return (
    <div className="mt-4 pt-4 border-t border-dark-700">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase">Draft Order</h3>
        {isSnakeRound && (
          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
            ← Snake Round
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {displayOrder.map((userId, index) => {
          const actualIndex = isSnakeRound ? draftOrder.length - 1 - index : index
          const isCurrent = actualIndex === currentPickIndex
          const isCurrentUser = userId === currentUserId
          const username = teamNames.get(userId) || `User ${userId.slice(0, 8)}`

          return (
            <div
              key={userId}
              className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition ${
                isCurrent
                  ? 'border-primary-500 bg-primary-600 text-white scale-105'
                  : isCurrentUser
                  ? 'border-primary-700 bg-dark-700 text-primary-400'
                  : 'border-dark-600 bg-dark-700 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{actualIndex + 1}</span>
                <span className="text-sm">{username}</span>
                {isCurrentUser && <span className="text-xs">(You)</span>}
                {isCurrent && <span className="animate-pulse">🎯</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getCurrentPickUser(pickNum: number, teamCount: number): number {
  const round = Math.floor((pickNum - 1) / teamCount)
  const posInRound = (pickNum - 1) % teamCount
  
  // Snake draft: odd rounds go reverse
  return round % 2 === 0 ? posInRound : teamCount - 1 - posInRound
}