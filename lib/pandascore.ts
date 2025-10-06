const PANDASCORE_API = 'https://api.pandascore.co'
const API_KEY = process.env.PANDASCORE_API_KEY

export interface PandaScorePlayer {
  id: number
  name: string
  kills: number
  deaths: number
  assists: number
  total_minions_killed: number
  vision_score: number
}

export interface PandaScoreGame {
  id: number
  match_id: number
  finished_at: string
  players: PandaScorePlayer[]
}

export async function getRecentMatches(tournamentId: string, limit = 10) {
  const response = await fetch(
    `${PANDASCORE_API}/lol/matches?filter[status]=finished&filter[tournament_id]=${tournamentId}&sort=-end_at&per_page=${limit}`,
    {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    }
  )

  if (!response.ok) {
    throw new Error(`PandaScore API error: ${response.status}`)
  }

  return response.json()
}

export async function getMatchGames(matchId: number) {
  const response = await fetch(
    `${PANDASCORE_API}/lol/matches/${matchId}/games`,
    {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    }
  )

  if (!response.ok) {
    throw new Error(`PandaScore API error: ${response.status}`)
  }

  return response.json() as Promise<PandaScoreGame[]>
}

export async function getPlayerStats(gameId: number) {
  const response = await fetch(
    `${PANDASCORE_API}/lol/games/${gameId}`,
    {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    }
  )

  if (!response.ok) {
    throw new Error(`PandaScore API error: ${response.status}`)
  }

  const data = await response.json()
  return data.players || []
}