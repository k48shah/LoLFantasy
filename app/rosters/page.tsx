'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { Player, FantasyRoster, User } from '../../lib/supabase'
import { getUserLeague } from '../../lib/league-helpers'
import { Users, ArrowRightLeft, Star, X } from 'lucide-react'

interface RosterWithPlayer extends FantasyRoster {
  player: Player
}

interface TeamRoster {
  user: User
  starters: RosterWithPlayer[]
  bench: RosterWithPlayer[]
  totalPoints: number
}

export default function RostersPage() {
  const { user } = useAuth()
  const [rosters, setRosters] = useState<TeamRoster[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadRosters()
  }, [user])

  async function undraftPlayer(rosterId: string) {
    const confirmUndraft = confirm('Are you sure you want to undraft this player?')
    if (!confirmUndraft) return

    try {
      const { error } = await supabase
        .from('fantasy_rosters')
        .delete()
        .eq('id', rosterId)

      if (error) throw error

      // Reload rosters
      loadRosters()
    } catch (error) {
      console.error('Error undrafting player:', error)
    }
  }

  async function loadRosters() {
    try {
      // Get user's league
      const leagueData = await getUserLeague(user!.id)

      if (!leagueData) return

      // Get all rosters with players and users
      const { data: rostersData } = await supabase
        .from('fantasy_rosters')
        .select(`
          *,
          player:players(*),
          user:users(*)
        `)
        .eq('league_id', leagueData.id)

      if (!rostersData) return

      // Get fantasy points for each player
      const { data: statsData } = await supabase
        .from('match_stats')
        .select('player_id, fantasy_points')

      const pointsMap = new Map<string, number>()
      statsData?.forEach(stat => {
        const current = pointsMap.get(stat.player_id) || 0
        pointsMap.set(stat.player_id, current + stat.fantasy_points)
      })

      // Group by user
      const teamMap = new Map<string, TeamRoster>()
      
      rostersData.forEach((roster: any) => {
        if (!teamMap.has(roster.user_id)) {
          teamMap.set(roster.user_id, {
            user: roster.user,
            starters: [],
            bench: [],
            totalPoints: 0,
          })
        }

        const team = teamMap.get(roster.user_id)!
        const rosterWithPoints = {
          ...roster,
          player: {
            ...roster.player,
            totalPoints: pointsMap.get(roster.player_id) || 0,
          }
        }

        if (roster.is_starter) {
          team.starters.push(rosterWithPoints)
          team.totalPoints += rosterWithPoints.player.totalPoints
        } else {
          team.bench.push(rosterWithPoints)
        }
      })

      const teamRosters = Array.from(teamMap.values())
      setRosters(teamRosters)
      
      // Auto-select current user's team
      setSelectedTeam(user!.id)
      setLoading(false)
    } catch (error) {
      console.error('Error loading rosters:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading rosters...</div>
  }

  const currentTeam = rosters.find(r => r.user.id === selectedTeam)

return (
  <div className="min-h-screen bg-dark-900 py-8">
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <Users className="w-8 h-8 text-primary-500" />
        Team Rosters
      </h1>

      {/* Team Selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {rosters.map(roster => (
          <button
            key={roster.user.id}
            onClick={() => setSelectedTeam(roster.user.id)}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
              selectedTeam === roster.user.id
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
            }`}
          >
            {roster.user.username}
            <span className="ml-2 text-xs opacity-75">
              {roster.totalPoints.toFixed(1)} pts
            </span>
          </button>
        ))}
      </div>

      {/* Roster Display */}
      {currentTeam && (
        <div className="space-y-6">
          {/* Starters */}
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Starting Lineup
            </h2>
            <div className="space-y-3">
              {currentTeam.starters.map(roster => (
                <RosterPlayerCard
                  key={roster.id}
                  roster={roster}
                  isStarter={true}
                  canManage={selectedTeam === user!.id}
                  onUndraft={undraftPlayer}
                />
              ))}
            </div>
          </div>

          {/* Bench */}
          {currentTeam.bench.length > 0 && (
            <div className="bg-dark-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Bench</h2>
              <div className="space-y-3">
                {currentTeam.bench.map(roster => (
                  <RosterPlayerCard
                    key={roster.id}
                    roster={roster}
                    isStarter={false}
                    canManage={selectedTeam === user!.id}
                    onUndraft={undraftPlayer}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Total Points */}
          <div className="bg-dark-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-white">Total Fantasy Points</span>
              <span className="text-3xl font-bold text-primary-500">
                {currentTeam.totalPoints.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)}

function RosterPlayerCard({ 
  roster, 
  isStarter,
  canManage = false,
  onUndraft
}: { 
  roster: RosterWithPlayer
  isStarter: boolean
  canManage?: boolean
  onUndraft?: (rosterId: string) => void
}) {
  const roleColors = {
    top: 'bg-blue-600',
    jungle: 'bg-green-600',
    mid: 'bg-yellow-600',
    adc: 'bg-red-600',
    support: 'bg-purple-600',
  }

  return (
    <div className={`bg-dark-700 rounded-lg p-4 flex items-center justify-between ${
      !isStarter ? 'opacity-60' : ''
    }`}>
      <div className="flex items-center gap-4">
        <span className={`${roleColors[roster.player.role]} px-3 py-1 rounded text-sm font-bold text-white uppercase`}>
          {roster.player.role}
        </span>
        <div>
          <h3 className="text-lg font-bold text-white">{roster.player.name}</h3>
          <p className="text-sm text-gray-400">{roster.player.team}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-400">
            {(roster.player as any).totalPoints?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xs text-gray-500">fantasy pts</div>
        </div>
        {canManage && onUndraft && (
          <button
            onClick={() => onUndraft(roster.id)}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Undraft
          </button>
        )}
      </div>
    </div>
  )
}