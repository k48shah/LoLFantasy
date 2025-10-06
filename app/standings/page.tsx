'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'
import { BarChart3, Trophy, TrendingUp, Loader2, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StandingData {
  userId: string
  username: string
  totalPoints: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  playerCount: number
  kda: number
}

interface DailyPoints {
  date: string
  [username: string]: number | string
}

export default function StandingsPage() {
  const { user } = useAuth()
  const [standings, setStandings] = useState<StandingData[]>([])
  const [dailyData, setDailyData] = useState<DailyPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    if (!user) return
    loadStandings()
  }, [user])

  async function loadStandings() {
    try {
      // Get user's league
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id')
        .eq('owner_id', user!.id)
        .single()

      if (!leagueData) return

      // Get standings using the view
      const { data: standingsData } = await supabase
        .from('league_standings')
        .select('*')
        .eq('league_id', leagueData.id)
        .order('total_points', { ascending: false })

      if (standingsData) {
        const formatted = standingsData.map((s: any) => ({
          userId: s.user_id,
          username: s.username,
          totalPoints: parseFloat(s.total_points) || 0,
          totalKills: s.total_kills || 0,
          totalDeaths: s.total_deaths || 0,
          totalAssists: s.total_assists || 0,
          playerCount: s.total_players || 0,
          kda: s.total_deaths > 0 
            ? ((s.total_kills + s.total_assists) / s.total_deaths).toFixed(2)
            : s.total_kills + s.total_assists,
        }))
        setStandings(formatted)
      }

      // Load daily progression data
      await loadDailyProgression(leagueData.id)

      setLoading(false)
    } catch (error) {
      console.error('Error loading standings:', error)
      setLoading(false)
    }
  }

  async function manualUpdate() {
    setUpdating(true)
    setUpdateMessage('')

    try {
      const response = await fetch('/api/update-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setUpdateMessage(`✅ ${data.message}`)
        // Reload standings after update
        setTimeout(() => {
          loadStandings()
        }, 1000)
      } else {
        setUpdateMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setUpdateMessage('❌ Failed to update stats')
    } finally {
      setUpdating(false)
    }
  }

  async function loadDailyProgression(leagueId: string) {
    try {
      // Get all match stats with dates
      const { data: statsData } = await supabase
        .from('match_stats')
        .select(`
          match_date,
          fantasy_points,
          player_id,
          fantasy_rosters!inner(user_id, users(username))
        `)
        .eq('fantasy_rosters.league_id', leagueId)
        .order('match_date')

      if (!statsData) return

      // Group by date and user
      const dailyMap = new Map<string, Map<string, number>>()

      statsData.forEach((stat: any) => {
        const date = new Date(stat.match_date).toISOString().split('T')[0]
        const username = stat.fantasy_rosters.users.username
        
        if (!dailyMap.has(date)) {
          dailyMap.set(date, new Map())
        }
        
        const dayMap = dailyMap.get(date)!
        const current = dayMap.get(username) || 0
        dayMap.set(username, current + stat.fantasy_points)
      })

      // Convert to cumulative array format for recharts
      const dates = Array.from(dailyMap.keys()).sort()
      const userTotals = new Map<string, number>()
      
      const chartData: DailyPoints[] = dates.map(date => {
        const dayData: DailyPoints = { date }
        const dayMap = dailyMap.get(date)!
        
        dayMap.forEach((points, username) => {
          const current = userTotals.get(username) || 0
          const newTotal = current + points
          userTotals.set(username, newTotal)
          dayData[username] = newTotal
        })
        
        // Fill in zeros for users who didn't play that day
        standings.forEach(s => {
          if (!(s.username in dayData)) {
            dayData[s.username] = userTotals.get(s.username) || 0
          }
        })
        
        return dayData
      })

      setDailyData(chartData)
    } catch (error) {
      console.error('Error loading daily progression:', error)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading standings...</div>
  }

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  return (
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary-500" />
            League Standings
          </h1>
          
          <button
            onClick={manualUpdate}
            disabled={updating}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Update Stats
              </>
            )}
          </button>
        </div>

        {updateMessage && (
          <div className={`mb-4 p-3 rounded-lg ${
            updateMessage.startsWith('✅') 
              ? 'bg-green-600/20 border border-green-600 text-green-400'
              : 'bg-red-600/20 border border-red-600 text-red-400'
          }`}>
            {updateMessage}
          </div>
        )}
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary-500" />
          League Standings
        </h1>

        {/* Standings Table */}
        <div className="bg-dark-800 rounded-lg overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-300">Rank</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-300">Manager</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-300">Points</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-300">K/D/A</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-300">KDA</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-300">Players</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {standings.map((standing, index) => (
                <tr 
                  key={standing.userId} 
                  className={`hover:bg-dark-700 transition ${
                    standing.userId === user?.id ? 'bg-dark-700/50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                      <span className="text-white font-bold">{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">
                      {standing.username}
                      {standing.userId === user?.id && (
                        <span className="ml-2 text-xs text-primary-400">(You)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-2xl font-bold text-primary-400">
                      {standing.totalPoints.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {standing.totalKills} / {standing.totalDeaths} / {standing.totalAssists}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${
                      parseFloat(standing.kda.toString()) >= 3 ? 'text-green-400' :
                      parseFloat(standing.kda.toString()) >= 2 ? 'text-blue-400' :
                      'text-gray-400'
                    }`}>
                      {standing.kda}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">
                    {standing.playerCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Points Progression Chart */}
        {dailyData.length > 0 && (
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              Points Progression
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2638', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend 
                  wrapperStyle={{ color: '#9ca3af' }}
                />
                {standings.map((standing, index) => (
                  <Line
                    key={standing.username}
                    type="monotone"
                    dataKey={standing.username}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
      </div>
    </div>
  )
}