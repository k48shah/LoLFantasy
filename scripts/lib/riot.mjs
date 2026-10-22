// Thin client for Riot's (unofficial but public) LoL Esports endpoints.
// The x-api-key below is the public key the lolesports.com website itself ships with.

const GW = 'https://esports-api.lolesports.com/persisted/gw'
const FEED = 'https://feed.lolesports.com/livestats/v1'
const KEY = process.env.RIOT_ESPORTS_KEY || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let last = 0

async function get(url, { headers = {}, allow404 = false } = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = last + 120 - Date.now() // be polite: ~8 requests / second max
    if (wait > 0) await sleep(wait)
    last = Date.now()
    let res
    try {
      res = await fetch(url, { headers })
    } catch (e) {
      if (attempt === 5) throw e
      await sleep(500 * attempt)
      continue
    }
    if (res.ok) return res.status === 204 ? null : res.json()
    if (allow404 && res.status === 404) return null
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * attempt * attempt)
      continue
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`)
  }
}

const gw = (path) => get(`${GW}/${path}${path.includes('?') ? '&' : '?'}hl=en-US`, { headers: { 'x-api-key': KEY } })

export const WORLDS_LEAGUE_ID = '98767975604431411'

export const getLeagues = async () => (await gw('getLeagues')).data.leagues
export const getTournaments = async (leagueId) => (await gw(`getTournamentsForLeague?leagueId=${leagueId}`)).data.leagues[0].tournaments
export const getStandings = async (tournamentId) => (await gw(`getStandings?tournamentId=${tournamentId}`)).data.standings[0]
export const getTeam = async (slug) => (await gw(`getTeams?id=${encodeURIComponent(slug)}`)).data.teams[0]
export const getMatch = async (matchId) => (await gw(`getEventDetails?id=${matchId}`)).data.event.match

export async function getSchedule(leagueId, pageToken) {
  const q = `getSchedule?leagueId=${leagueId}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
  return (await gw(q)).data.schedule
}

const snap10 = (ms) => {
  const d = new Date(ms)
  d.setMilliseconds(0)
  d.setSeconds(Math.floor(d.getSeconds() / 10) * 10)
  return d.toISOString()
}

/** Participants + earliest frame (cheap; works for any game that has started). */
export async function getGameStart(gameId) {
  return get(`${FEED}/window/${gameId}`, { allow404: true })
}

/**
 * Final scoreboard for a finished game.
 * The feed serves 10-second windows; asking for a time long after the game ended
 * returns the last frames, so we jump 3 hours past the first frame.
 * Returns null while the game is still being played / not yet finalised.
 */
export async function getGameFinal(gameId, startWindow) {
  const first = startWindow ?? (await getGameStart(gameId))
  if (!first?.frames?.length) return null
  const firstTs = Date.parse(first.frames[0].rfc460Timestamp)
  const end = await get(`${FEED}/window/${gameId}?startingTime=${snap10(firstTs + 3 * 3600e3)}`, { allow404: true })
  const frame = end?.frames?.at(-1)
  if (!frame || frame.gameState !== 'finished') return null
  return {
    metadata: first.gameMetadata,
    startedAt: new Date(firstTs).toISOString(),
    endedAt: frame.rfc460Timestamp,
    frame,
  }
}
