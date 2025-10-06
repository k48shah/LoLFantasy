import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRecentMatches, getMatchGames } from '../../../lib/pandascore'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting stats update from PandaScore...')

    const tournamentId = process.env.WORLDS_TOURNAMENT_ID
    if (!tournamentId) {
      return NextResponse.json({ error: 'No tournament ID configured' }, { status: 500 })
    }

    // Fetch recent finished matches
    const matches = await getRecentMatches(tournamentId, 10)
    let updatedCount = 0

    for (const match of matches) {
      // Check if match already processed
      const { data: existingStats } = await supabase
        .from('match_stats')
        .select('match_id')
        .eq('match_id', `panda_${match.id}`)
        .limit(1)

      if (existingStats && existingStats.length > 0) {
        console.log(`Match ${match.id} already processed, skipping`)
        continue
      }

      // Get detailed game stats
      const games = await getMatchGames(match.id)

      for (const game of games) {
        if (!game.players || game.players.length === 0) continue

        for (const playerStat of game.players) {
          // Find player in our database by name
          const { data: player } = await supabase
            .from('players')
            .select('id')
            .ilike('name', playerStat.name)
            .single()

          if (!player) {
            console.log(`Player ${playerStat.name} not found in database`)
            continue
          }

          // Calculate fantasy points
          const fantasyPoints = (
            playerStat.kills * 1.0 +
            playerStat.deaths * -0.7 +
            playerStat.assists * 0.5 +
            (playerStat.total_minions_killed / 50) * 0.5 +
            (playerStat.vision_score / 10) * 0.0
          )

          // Insert match stats
          const { error } = await supabase
            .from('match_stats')
            .insert({
              match_id: `panda_${match.id}_${game.id}`,
              player_id: player.id,
              kills: playerStat.kills,
              deaths: playerStat.deaths,
              assists: playerStat.assists,
              cs: playerStat.total_minions_killed,
              vision_score: playerStat.vision_score,
              fantasy_points: fantasyPoints,
              match_date: game.finished_at || new Date().toISOString(),
            })

          if (error) {
            console.error('Error inserting stats:', error)
          } else {
            updatedCount++
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updatedCount} player stats from ${matches.length} matches`,
      source: 'pandascore'
    })
  } catch (error) {
    console.error('Update stats error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}