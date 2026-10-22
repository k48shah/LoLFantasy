// Pulls Worlds data from Riot's esports API into Supabase.
//
//   node scripts/sync.mjs            teams, matches, game stats AND rosters
//   node scripts/sync.mjs --stats    teams, matches, new game stats (the fast, frequent run)
//   node scripts/sync.mjs --rosters  also re-derive who is draftable (the slow, daily run)
//   node scripts/sync.mjs --dry      write data/snapshot.json instead of touching Supabase
//
// Safe to run as often as you like: finished games are only ever fetched once.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as riot from './lib/riot.mjs'
import { supabaseSink, jsonSink } from './lib/sink.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry')
const DO_STATS = args.has('--stats') || !args.has('--rosters')
const DO_ROSTERS = args.has('--rosters') || !args.has('--stats')

const overrides = JSON.parse(readFileSync(path.join(here, 'data', 'overrides.json'), 'utf8'))
const warnings = []
const warn = (msg) => {
  warnings.push(msg)
  console.warn('  ! ' + msg)
}

const ROLE = { top: 'top', jungle: 'jungle', mid: 'mid', bottom: 'adc', support: 'support' }
const REGION_SEED = { LCK: 24, LPL: 23, LEC: 21, LCS: 19, LTA: 19, 'LTA North': 19, LCP: 18, PCS: 17, CBLOL: 17, 'LTA South': 17, VCS: 16, LLA: 15, LJL: 15 }
const ROLE_SEED = { adc: 2, mid: 2, jungle: 1, top: 0, support: -1 }

// ---------------------------------------------------------------- tournament

async function pickTournament() {
  const all = await riot.getTournaments(riot.WORLDS_LEAGUE_ID)
  const wanted = process.env.TOURNAMENT_SLUG
  if (wanted) {
    const t = all.find((x) => x.slug === wanted)
    if (!t) throw new Error(`No tournament with slug ${wanted}. Known: ${all.map((x) => x.slug).join(', ')}`)
    return t
  }
  const horizon = Date.now() + 14 * 86400e3
  const t = all.filter((x) => Date.parse(x.startDate) <= horizon).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  if (!t) throw new Error('Could not find a current Worlds tournament.')
  return t
}

// ---------------------------------------------------------------- teams + matches

function collectMatches(standings) {
  const matches = []
  for (const stage of standings.stages) {
    for (const section of stage.sections) {
      for (const m of section.matches) matches.push({ ...m, stage: stage.slug, block: section.name })
    }
  }
  return matches
}

const isReal = (t) => t && t.slug && t.slug !== 'tbd' && t.code !== 'TBD'

async function loadSchedule(tournament) {
  // The schedule carries start times and best-of; standings carry everything else.
  const byMatch = new Map()
  const seen = new Set()
  const take = (s) => {
    for (const e of s.events) if (e.match?.id) byMatch.set(e.match.id, e)
  }
  try {
    let page = await riot.getSchedule(riot.WORLDS_LEAGUE_ID)
    take(page)
    let token = page.pages?.newer
    for (let i = 0; token && i < 4 && !seen.has(token); i++) {
      seen.add(token)
      page = await riot.getSchedule(riot.WORLDS_LEAGUE_ID, token)
      take(page)
      token = page.pages?.newer
    }
    token = (await riot.getSchedule(riot.WORLDS_LEAGUE_ID)).pages?.older
    for (let i = 0; token && i < 2 && !seen.has(token); i++) {
      seen.add(token)
      page = await riot.getSchedule(riot.WORLDS_LEAGUE_ID, token)
      take(page)
      token = page.pages?.older
    }
  } catch (e) {
    warn(`schedule unavailable (${e.message}); match start times will be missing`)
  }
  return byMatch
}

function teamRow(t, mainEvent) {
  const row = { id: t.id, slug: t.slug, code: t.code, name: t.name, image_url: t.image?.replace(/^http:/, 'https:'), in_main_event: mainEvent }
  return row
}

// ---------------------------------------------------------------- stats

function decideWinner(blue, red) {
  for (const k of ['inhibitors', 'towers', 'totalGold', 'totalKills']) {
    if (blue[k] !== red[k]) return blue[k] > red[k] ? 'blue' : 'red'
  }
  return 'blue'
}

const stripTeamTag = (names) => {
  const firsts = new Set(names.map((n) => n.trim().split(/\s+/)[0]))
  const allHaveSpace = names.every((n) => n.trim().includes(' '))
  return firsts.size === 1 && allHaveSpace ? names.map((n) => n.trim().split(/\s+/).slice(1).join(' ')) : names.map((n) => n.trim())
}

async function ingestStats(sink, matches, tournamentSlug) {
  console.log('> game stats')
  const knownGames = await sink.ids('games')
  const ingested = await sink.matchState()
  const teamIds = new Set((await sink.ids('teams')))
  let newGames = 0

  for (const m of matches) {
    if (m.state === 'unstarted' || ingested.get(m.id)) continue
    const detail = await riot.getMatch(m.id)
    const games = detail.games ?? []
    const gameRows = []
    const statRows = []
    const playerRows = []
    const winsByTeam = new Map()
    let complete = true

    for (const g of games) {
      if (g.state === 'unneeded') continue
      if (g.state !== 'completed') {
        complete = false
        continue
      }
      if (knownGames.has(g.id)) continue
      const start = await riot.getGameStart(g.id)
      const fin = start && (await riot.getGameFinal(g.id, start))
      if (!fin) {
        complete = false
        warn(`game ${g.id} (match ${m.id}) is completed but has no final frame yet; will retry`)
        continue
      }
      const { metadata, frame } = fin
      const winner = decideWinner(frame.blueTeam, frame.redTeam)
      const blueId = metadata.blueTeamMetadata.esportsTeamId
      const redId = metadata.redTeamMetadata.esportsTeamId
      const winnerId = winner === 'blue' ? blueId : redId
      winsByTeam.set(winnerId, (winsByTeam.get(winnerId) ?? 0) + 1)

      gameRows.push({
        id: g.id,
        match_id: m.id,
        stage: m.stage,
        game_number: g.number,
        started_at: fin.startedAt,
        duration_seconds: Math.round((Date.parse(fin.endedAt) - Date.parse(fin.startedAt)) / 1000),
        blue_team_id: teamIds.has(blueId) ? blueId : null,
        red_team_id: teamIds.has(redId) ? redId : null,
        winner_team_id: teamIds.has(winnerId) ? winnerId : null,
        patch: metadata.patchVersion ?? null,
      })

      for (const [side, meta, teamStats] of [['blue', metadata.blueTeamMetadata, frame.blueTeam], ['red', metadata.redTeamMetadata, frame.redTeam]]) {
        const handles = stripTeamTag(meta.participantMetadata.map((p) => p.summonerName))
        meta.participantMetadata.forEach((p, i) => {
          const s = teamStats.participants.find((x) => x.participantId === p.participantId)
          if (!s) return
          const teamId = teamIds.has(meta.esportsTeamId) ? meta.esportsTeamId : null
          playerRows.push({ id: p.esportsPlayerId, handle: handles[i], role: ROLE[p.role] ?? 'mid', team_id: teamId, active: false })
          statRows.push({
            game_id: g.id,
            player_id: p.esportsPlayerId,
            team_id: teamId,
            champion: p.championId,
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            cs: s.creepScore,
            gold: s.totalGold,
            won: side === winner,
          })
        })
      }
    }

    // Cross-check our per-game winners against Riot's official match score.
    if (gameRows.length === games.filter((g) => g.state === 'completed').length && gameRows.length > 0) {
      for (const t of detail.teams) {
        const mine = winsByTeam.get(t.id) ?? 0
        if (mine !== (t.result?.gameWins ?? 0)) {
          warn(`match ${m.id}: winners we inferred (${t.code}: ${mine}) disagree with official score (${t.result?.gameWins})`)
        }
      }
    }

    if (gameRows.length) {
      await sink.upsert('players', dedupe(playerRows, 'id'), { ignoreDuplicates: true })
      await sink.upsert('games', gameRows)
      await sink.upsert('game_stats', statRows)
      newGames += gameRows.length
      gameRows.forEach((g) => knownGames.add(g.id))
    }
    const finished = m.state === 'completed' && complete
    await sink.upsert('matches', [{ id: m.id, best_of: detail.strategy?.count ?? null, ingested: finished }])
    if (gameRows.length) console.log(`  match ${m.id}: +${gameRows.length} game(s)`)
  }
  console.log(`  ${newGames} new game(s) recorded`)
}

const dedupe = (rows, key) => [...new Map(rows.map((r) => [r[key], r])).values()]

// ---------------------------------------------------------------- rosters

const scheduleCache = new Map()
async function leagueMatchesFor(leagueId, teamCode) {
  // Newest-first completed matches involving a team, paging backwards as needed.
  const out = []
  let pages = scheduleCache.get(leagueId)
  if (!pages) {
    pages = { events: [], older: undefined, loaded: false }
    scheduleCache.set(leagueId, pages)
  }
  const matchesNow = () =>
    pages.events
      .filter((e) => e.state === 'completed' && e.match?.teams?.some((t) => t.code === teamCode))
      .sort((a, b) => b.startTime.localeCompare(a.startTime))
  for (let i = 0; i < 5; i++) {
    if (!pages.loaded) {
      const s = await riot.getSchedule(leagueId)
      pages.events.push(...s.events)
      pages.older = s.pages?.older
      pages.loaded = true
    } else if (matchesNow().length < 2 && pages.older) {
      const s = await riot.getSchedule(leagueId, pages.older)
      pages.events.push(...s.events)
      pages.older = s.pages?.older
    } else break
    if (matchesNow().length >= 2) break
  }
  out.push(...matchesNow().slice(0, 2))
  return out
}

/** Who has actually been starting for this team lately in their home league? */
async function deriveFromHomeLeague(team, leagueIds) {
  const leagueId = leagueIds.get(team.homeLeague?.name)
  if (!leagueId) return null
  const recent = await leagueMatchesFor(leagueId, team.code)
  if (!recent.length) return null
  const age = (Date.now() - Date.parse(recent[0].startTime)) / 86400e3
  if (age > 150) return null // too stale to trust

  const tally = new Map()
  for (const [idx, ev] of recent.entries()) {
    const detail = await riot.getMatch(ev.match.id)
    for (const g of (detail.games ?? []).filter((x) => x.state === 'completed')) {
      const w = await riot.getGameStart(g.id)
      if (!w) continue
      const side = [w.gameMetadata.blueTeamMetadata, w.gameMetadata.redTeamMetadata].find((s) => s.esportsTeamId === team.id)
      if (!side) continue
      const handles = stripTeamTag(side.participantMetadata.map((p) => p.summonerName))
      side.participantMetadata.forEach((p, i) => {
        const cur = tally.get(p.esportsPlayerId) ?? { id: p.esportsPlayerId, n: 0, recency: 0, role: ROLE[p.role] ?? 'mid', handle: handles[i] }
        cur.n += 1
        cur.recency = Math.max(cur.recency, recent.length - idx)
        tally.set(p.esportsPlayerId, cur)
      })
    }
  }
  const byRole = new Map()
  for (const p of tally.values()) {
    const best = byRole.get(p.role)
    if (!best || p.n > best.n || (p.n === best.n && p.recency > best.recency)) byRole.set(p.role, p)
  }
  return byRole.size === 5 ? [...byRole.values()] : null
}

async function syncRosters(sink, standingsTeams, mainEventIds) {
  console.log('> rosters')
  const leagueIds = new Map((await riot.getLeagues()).map((l) => [l.name, l.id]))
  const played = await sink.playedForTeam()
  const teamRows = []
  const playerRows = []
  const unverified = []

  for (const t of standingsTeams) {
    const info = await riot.getTeam(t.slug)
    if (!info) {
      warn(`no team data for ${t.slug}`)
      continue
    }
    const region = info.homeLeague?.name ?? null
    teamRows.push({ ...teamRow(t, mainEventIds.has(t.id)), region, image_url: (info.image ?? t.image)?.replace(/^http:/, 'https:') })
    if (!mainEventIds.has(t.id)) continue

    const candidates = new Map((info.players ?? []).map((p) => [p.id, p]))
    let chosen
    let how
    const playedHere = played.get(t.id)
    if (playedHere && playedHere.size >= 5) {
      chosen = [...playedHere].map((id) => ({ id }))
      how = 'played at Worlds'
    } else {
      const derived = await deriveFromHomeLeague({ ...info, id: t.id }, leagueIds)
      if (derived) {
        chosen = derived
        how = 'recent home-league starters'
      } else {
        chosen = [...candidates.values()].map((p) => ({ id: p.id }))
        how = 'UNVERIFIED (all listed players)'
        unverified.push(t.code)
      }
    }
    console.log(`  ${t.code.padEnd(5)} ${how}`)

    const activeIds = new Set(chosen.map((c) => c.id))
    const known = new Map()
    for (const c of candidates.values()) known.set(c.id, { id: c.id, handle: c.summonerName.trim(), full: [c.firstName, c.lastName].filter(Boolean).join(' '), role: ROLE[c.role] ?? 'mid', image: c.image })
    for (const c of chosen) if (c.handle && !known.has(c.id)) known.set(c.id, { id: c.id, handle: c.handle, role: c.role })

    for (const p of known.values()) {
      const key = `${t.code}:${p.handle}`
      const forced = overrides.include.includes(p.id) || overrides.include.includes(key)
      const banned = overrides.exclude.includes(p.id) || overrides.exclude.includes(key)
      const active = (activeIds.has(p.id) || forced) && !banned
      const seed = (REGION_SEED[region] ?? 17) + (ROLE_SEED[p.role] ?? 0) + (overrides.seed_adjust[p.id] ?? overrides.seed_adjust[key] ?? 0)
      playerRows.push({
        id: p.id,
        handle: p.handle,
        full_name: p.full || null,
        role: p.role,
        team_id: t.id,
        image_url: p.image?.replace(/^http:/, 'https:') ?? null,
        active,
        seed_rating: seed,
      })
    }
  }

  await sink.upsert('teams', teamRows)
  await sink.upsert('players', dedupe(playerRows, 'id'))
  const active = playerRows.filter((p) => p.active)
  const perRole = Object.fromEntries(['top', 'jungle', 'mid', 'adc', 'support'].map((r) => [r, active.filter((p) => p.role === r).length]))
  console.log(`  ${active.length} draftable players`, JSON.stringify(perRole))
  if (unverified.length) warn(`rosters not verified for: ${unverified.join(', ')} (check scripts/data/overrides.json)`)
}

// ---------------------------------------------------------------- main

async function main() {
  const sink = DRY ? jsonSink(path.join(here, '..', 'data', 'snapshot.json')) : supabaseSink()
  console.log(`sink: ${sink.name}  stats=${DO_STATS} rosters=${DO_ROSTERS}`)

  const tournament = await pickTournament()
  console.log(`> tournament ${tournament.slug} (${tournament.startDate} → ${tournament.endDate})`)
  const standings = await riot.getStandings(tournament.id)
  const matches = collectMatches(standings)

  const teamsById = new Map()
  const mainEventIds = new Set()
  for (const m of matches) {
    for (const t of m.teams) {
      if (!isReal(t)) continue
      teamsById.set(t.id, t)
      if (m.stage !== 'play_ins') mainEventIds.add(t.id)
    }
  }
  console.log(`  ${teamsById.size} teams, ${mainEventIds.size} in the main event, ${matches.length} matches`)

  const schedule = await loadSchedule(tournament)

  await sink.upsert('teams', [...teamsById.values()].map((t) => teamRow(t, mainEventIds.has(t.id))))
  await sink.upsert(
    'matches',
    matches.map((m) => {
      const [a, b] = m.teams
      const ev = schedule.get(m.id)
      const row = {
        id: m.id,
        stage: m.stage,
        block_name: ev?.blockName ?? m.block,
        state: m.state,
        team1_id: isReal(a) ? a.id : null,
        team2_id: isReal(b) ? b.id : null,
        team1_code: a?.code ?? null,
        team2_code: b?.code ?? null,
        team1_wins: a?.result?.gameWins ?? 0,
        team2_wins: b?.result?.gameWins ?? 0,
      }
      if (ev?.startTime) row.start_time = ev.startTime
      if (ev?.match?.strategy?.count) row.best_of = ev.match.strategy.count
      return row
    }),
  )

  if (DO_STATS) await ingestStats(sink, matches, tournament.slug)
  if (DO_ROSTERS) await syncRosters(sink, [...teamsById.values()], mainEventIds)

  await sink.finish()
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`)
    warnings.forEach((w) => console.log(' - ' + w))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
