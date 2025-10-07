'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getUserLeague } from '../../lib/league-helpers'
import { useAuth } from '../../components/AuthProvider'
import { Trade, Player, User } from '../../lib/supabase'
import { ArrowRightLeft, Check, X, Clock } from 'lucide-react'

interface TradeWithDetails extends Trade {
  offered_player: Player
  requested_player: Player
  from_user_data: User
  to_user_data: User
}

export default function TradesPage() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<TradeWithDetails[]>([])
  const [myPlayers, setMyPlayers] = useState<Player[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [selectedMyPlayer, setSelectedMyPlayer] = useState<string>('')
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<string>('')
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadTrades()
    loadPlayers()
    subscribeToTrades()
  }, [user])

  function subscribeToTrades() {
    const channel = supabase
      .channel('trades-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
        },
        () => {
          loadTrades()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function loadTrades() {
    try {
      const leagueData = await getUserLeague(user!.id)

      if (!leagueData) return

      const { data: tradesData } = await supabase
        .from('trades')
        .select(`
          *,
          offered_player:players!trades_offered_player_id_fkey(*),
          requested_player:players!trades_requested_player_id_fkey(*),
          from_user_data:users!trades_from_user_fkey(*),
          to_user_data:users!trades_to_user_fkey(*)
        `)
        .eq('league_id', leagueData.id)
        .or(`from_user.eq.${user!.id},to_user.eq.${user!.id}`)
        .order('created_at', { ascending: false })

      if (tradesData) {
        setTrades(tradesData as any)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading trades:', error)
      setLoading(false)
    }
  }

  async function loadPlayers() {
    try {
      const leagueData = await getUserLeague(user!.id)

      if (!leagueData) return

      // Get my players
      const { data: myRoster } = await supabase
        .from('fantasy_rosters')
        .select('player:players(*)')
        .eq('league_id', leagueData.id)
        .eq('user_id', user!.id)

      if (myRoster) {
        setMyPlayers(myRoster.map((r: any) => r.player))
      }

      // Get all other players in league
      const { data: otherRosters } = await supabase
        .from('fantasy_rosters')
        .select('player:players(*), user_id')
        .eq('league_id', leagueData.id)
        .neq('user_id', user!.id)

      if (otherRosters) {
        setAvailablePlayers(otherRosters.map((r: any) => ({
          ...r.player,
          owner_id: r.user_id
        })))
      }
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  async function proposeTrade() {
    if (!selectedMyPlayer || !selectedTargetPlayer) return

    try {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id')
        .eq('owner_id', user!.id)
        .single()

      if (!leagueData) return

      const targetPlayer = availablePlayers.find(p => p.id === selectedTargetPlayer)
      
      const { error } = await supabase
        .from('trades')
        .insert({
          league_id: leagueData.id,
          from_user: user!.id,
          to_user: (targetPlayer as any).owner_id,
          offered_player_id: selectedMyPlayer,
          requested_player_id: selectedTargetPlayer,
          status: 'pending',
        })

      if (error) throw error

      setShowTradeModal(false)
      setSelectedMyPlayer('')
      setSelectedTargetPlayer('')
      setSelectedTargetUser('')
    } catch (error) {
      console.error('Error proposing trade:', error)
    }
  }

  async function acceptTrade(tradeId: string) {
    try {
      // Start transaction: update trade status and swap players
      const { data: trade } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single()

      if (!trade) return

      // Update roster ownerships
      await supabase
        .from('fantasy_rosters')
        .update({ user_id: trade.to_user })
        .eq('player_id', trade.offered_player_id)
        .eq('user_id', trade.from_user)

      await supabase
        .from('fantasy_rosters')
        .update({ user_id: trade.from_user })
        .eq('player_id', trade.requested_player_id)
        .eq('user_id', trade.to_user)

      // Update trade status
      await supabase
        .from('trades')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', tradeId)

      loadPlayers()
    } catch (error) {
      console.error('Error accepting trade:', error)
    }
  }

  async function rejectTrade(tradeId: string) {
    await supabase
      .from('trades')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', tradeId)
  }

  async function cancelTrade(tradeId: string) {
    await supabase
      .from('trades')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', tradeId)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading trades...</div>
  }

  const pendingTrades = trades.filter(t => t.status === 'pending')
  const completedTrades = trades.filter(t => t.status !== 'pending')

  return (
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ArrowRightLeft className="w-8 h-8 text-primary-500" />
            Trade Center
          </h1>
          <button
            onClick={() => setShowTradeModal(true)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition"
          >
            Propose Trade
          </button>
        </div>

        {/* Pending Trades */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Pending Trades</h2>
          {pendingTrades.length === 0 ? (
            <div className="bg-dark-800 rounded-lg p-8 text-center text-gray-500">
              No pending trades
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  currentUserId={user!.id}
                  onAccept={() => acceptTrade(trade.id)}
                  onReject={() => rejectTrade(trade.id)}
                  onCancel={() => cancelTrade(trade.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trade History */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Trade History</h2>
          {completedTrades.length === 0 ? (
            <div className="bg-dark-800 rounded-lg p-8 text-center text-gray-500">
              No completed trades yet
            </div>
          ) : (
            <div className="space-y-4">
              {completedTrades.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  currentUserId={user!.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trade Proposal Modal */}
        {showTradeModal && (
          <TradeModal
            myPlayers={myPlayers}
            availablePlayers={availablePlayers}
            selectedMyPlayer={selectedMyPlayer}
            selectedTargetPlayer={selectedTargetPlayer}
            onSelectMyPlayer={setSelectedMyPlayer}
            onSelectTargetPlayer={setSelectedTargetPlayer}
            onPropose={proposeTrade}
            onClose={() => setShowTradeModal(false)}
          />
        )}
      </div>
    </div>
  )
}

function TradeCard({ 
  trade, 
  currentUserId,
  onAccept,
  onReject,
  onCancel
}: { 
  trade: TradeWithDetails
  currentUserId: string
  onAccept?: () => void
  onReject?: () => void
  onCancel?: () => void
}) {
  const isReceiver = trade.to_user === currentUserId
  const isPending = trade.status === 'pending'

  const statusColors = {
    pending: 'bg-yellow-600',
    accepted: 'bg-green-600',
    rejected: 'bg-red-600',
    cancelled: 'bg-gray-600',
  }

  return (
    <div className="bg-dark-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-400">
            {new Date(trade.created_at).toLocaleDateString()}
          </span>
        </div>
        <span className={`${statusColors[trade.status]} px-3 py-1 rounded-full text-xs font-bold text-white uppercase`}>
          {trade.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* From */}
        <div className="bg-dark-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-2">
            {isReceiver ? 'They Offer' : 'You Offer'}
          </div>
          <div className="text-white font-bold">{trade.offered_player.name}</div>
          <div className="text-sm text-gray-400">{trade.offered_player.team}</div>
          <div className="text-xs text-gray-500 mt-1">{trade.from_user_data.username}</div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRightLeft className="w-6 h-6 text-primary-500" />
        </div>

        {/* To */}
        <div className="bg-dark-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-2">
            {isReceiver ? 'They Want' : 'You Want'}
          </div>
          <div className="text-white font-bold">{trade.requested_player.name}</div>
          <div className="text-sm text-gray-400">{trade.requested_player.team}</div>
          <div className="text-xs text-gray-500 mt-1">{trade.to_user_data.username}</div>
        </div>
      </div>

      {/* Actions */}
      {isPending && (
        <div className="mt-4 flex gap-3">
          {isReceiver ? (
            <>
              <button
                onClick={onAccept}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={onReject}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
            >
              Cancel Trade
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TradeModal({
  myPlayers,
  availablePlayers,
  selectedMyPlayer,
  selectedTargetPlayer,
  onSelectMyPlayer,
  onSelectTargetPlayer,
  onPropose,
  onClose,
}: {
  myPlayers: Player[]
  availablePlayers: any[]
  selectedMyPlayer: string
  selectedTargetPlayer: string
  onSelectMyPlayer: (id: string) => void
  onSelectTargetPlayer: (id: string) => void
  onPropose: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold text-white">Propose Trade</h2>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* My Players */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Your Players</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {myPlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => onSelectMyPlayer(player.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedMyPlayer === player.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                  }`}
                >
                  <div className="font-bold">{player.name}</div>
                  <div className="text-sm opacity-75">{player.team} • {player.role}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Available Players */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Available Players</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availablePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => onSelectTargetPlayer(player.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedTargetPlayer === player.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                  }`}
                >
                  <div className="font-bold">{player.name}</div>
                  <div className="text-sm opacity-75">{player.team} • {player.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onPropose}
            disabled={!selectedMyPlayer || !selectedTargetPlayer}
            className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Propose Trade
          </button>
        </div>
      </div>
    </div>
  )
}