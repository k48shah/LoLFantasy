const RIOT_API_BASE = 'https://esports-api.lolesports.com/persisted/gw'

interface RiotMatch {
  id: string
  startTime: string
  teams: Array<{
    name: string
    players: Array<{
      summonerName: string
      championId: string
    }>
  }>
}

interface RiotMatchDetails {
  gameId: string
  participants: Array<{
    summonerName: string
    kills: number
    deaths: number
    assists: number
    totalMinionsKilled: number
    neutralMinionsKilled: number
    visionScore: number
  }>
}

export async function fetchWorldsMatches(date?: string): Promise<RiotMatch[]> {
  try {
    // Riot Esports API endpoint for live/recent matches
    const url = `${RIOT_API_BASE}/getSchedule?hl=en-US&leagueId=98767991302996019`
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.RIOT_API_KEY || '',
      },
    })

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.schedule?.events || []
  } catch (error) {
    console.error('Error fetching Riot matches:', error)
    return []
  }
}

export async function fetchMatchDetails(matchId: string): Promise<RiotMatchDetails | null> {
  try {
    const url = `${RIOT_API_BASE}/getEventDetails?hl=en-US&id=${matchId}`
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.RIOT_API_KEY || '',
      },
    })

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.event?.match || null
  } catch (error) {
    console.error('Error fetching match details:', error)
    return null
  }
}

// Fallback: gol.gg scraping (if Riot API fails)
export async function scrapeGolGG(matchUrl: string) {
  // Note: This requires a scraping library like cheerio or puppeteer
  // For now, this is a placeholder
  console.log('gol.gg scraping not implemented yet')
  return null
}