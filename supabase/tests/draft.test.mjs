import test from 'node:test'
import assert from 'node:assert/strict'
import { newDb, signUp, rpc, as, expectError, ROLES } from './harness.mjs'

async function setup({ names = ['ann', 'bo', 'cy', 'di'], rosterSize = 5, pickMinutes = 60, teams = 12 } = {}) {
  const db = await newDb({ teams })
  const users = {}
  for (const n of names) users[n] = await signUp(db, n)
  const owner = users[names[0]]
  const league = await rpc(db, owner, 'create_league', {
    p_name: 'Test League', p_max_members: Math.max(8, names.length), p_roster_size: rosterSize, p_pick_minutes: pickMinutes, p_count_play_ins: false,
  })
  const { rows } = await as(db, owner, `select invite_code as r from leagues where id = $1`, [league])
  const code = rows[0].r
  for (const n of names.slice(1)) await rpc(db, users[n], 'join_league', { p_code: code })
  return { db, users, owner, league, code }
}

const state = (db, uid, league) => rpc(db, uid, 'draft_state', { p_league: league })
const idOf = (role, team) => `p${team}-${role}`

/** Make a pick as whoever is currently on the clock. */
async function pickAsOnClock(db, viewer, league, playerId) {
  const s = await state(db, viewer, league)
  const uid = s.league.on_clock
  await rpc(db, uid, 'make_pick', { p_league: league, p_player: playerId })
  return uid
}

/** Let the clock run out until the draft is over. */
async function ghostDraft(db, viewer, league, maxTicks = 100) {
  for (let i = 0; i < maxTicks; i++) {
    const { rows } = await db.query(`select status from leagues where id = $1`, [league])
    if (rows[0].status !== 'drafting') return
    await db.query(`update leagues set pick_deadline = now() - interval '1 second' where id = $1`, [league])
    await state(db, viewer, league)
  }
  throw new Error('draft never finished')
}

test('sign-up creates a unique, sanitised profile', async () => {
  const db = await newDb()
  await signUp(db, 'kathan')
  await signUp(db, 'Kathan') // same name, different case
  await signUp(db, '!!')     // nothing usable left
  const names = (await db.query(`select username from profiles`)).rows.map((r) => r.username)
  assert.equal(names.length, 3)
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, 3, 'usernames are unique ignoring case')
  assert.ok(names.includes('kathan'))
  assert.ok(names.some((n) => /^player/.test(n)))
})

test('lobby: invite codes, joining, caps, ownership', async () => {
  const { db, users, owner, league, code } = await setup({ names: ['ann', 'bo'] })
  assert.match(code, /^[A-Z2-9]{7}$/)
  assert.equal(await rpc(db, users.bo, 'join_league', { p_code: code.toLowerCase() }), league, 're-joining is a no-op')
  await expectError(rpc(db, owner, 'join_league', { p_code: 'NOPE123' }), /No league found/)

  const cap = { p_league: league, p_name: 'Two Max', p_max_members: 2, p_roster_size: 5, p_pick_minutes: 60, p_count_play_ins: false }
  await rpc(db, owner, 'update_league', cap)
  const eve = await signUp(db, 'eve')
  await expectError(rpc(db, eve, 'join_league', { p_code: code }), /full/)
  await expectError(rpc(db, owner, 'update_league', { ...cap, p_max_members: 1 }), /violates|already/)

  await expectError(rpc(db, users.bo, 'start_draft', { p_league: league }), /owner/)
  await expectError(rpc(db, users.bo, 'delete_league', { p_league: league }), /owner/)
  await expectError(rpc(db, eve, 'league_overview', { p_league: league }), /not in that league/)
  await expectError(rpc(db, eve, 'draft_state', { p_league: league }), /not in that league/)
  assert.deepEqual(await rpc(db, eve, 'my_leagues'), [])

  const preview = await rpc(db, eve, 'league_preview', { p_code: code })
  assert.equal(preview.name, 'Two Max')
  assert.equal(preview.members, 2)
})

test('cannot start with one manager, or when the pool is too small', async () => {
  const solo = await setup({ names: ['ann'] })
  await expectError(rpc(solo.db, solo.owner, 'start_draft', { p_league: solo.league }), /at least 2/)

  const small = await setup({ names: ['ann', 'bo', 'cy', 'di'], rosterSize: 10, teams: 7 }) // 35 players, 40 needed
  await expectError(rpc(small.db, small.owner, 'start_draft', { p_league: small.league }), /35 players/)
})

test('snake order, turn enforcement, and no double-drafting', async () => {
  const { db, owner, league } = await setup()
  await rpc(db, owner, 'start_draft', { p_league: league })
  let s = await state(db, owner, league)
  assert.equal(s.league.status, 'drafting')
  assert.equal(s.league.current_pick, 1)
  const order = s.members.map((m) => m.user_id)
  assert.deepEqual(s.members.map((m) => m.draft_position), [1, 2, 3, 4])
  assert.equal(s.league.on_clock, order[0])

  await expectError(rpc(db, order[1], 'make_pick', { p_league: league, p_player: idOf('mid', 1) }), /not your turn/)

  const forward = []
  for (const [i, role] of ['mid', 'top', 'jungle', 'adc'].entries()) forward.push(await pickAsOnClock(db, owner, league, idOf(role, 1 + i)))
  const backward = []
  for (let i = 0; i < 4; i++) backward.push(await pickAsOnClock(db, owner, league, idOf('support', 5 + i)))
  assert.deepEqual(forward, order)
  assert.deepEqual(backward, [...order].reverse())

  s = await state(db, owner, league)
  const onClock = s.league.on_clock
  await expectError(rpc(db, onClock, 'make_pick', { p_league: league, p_player: idOf('mid', 1) }), /already been drafted/)
  await expectError(rpc(db, onClock, 'make_pick', { p_league: league, p_player: 'nobody' }), /not in the draft pool/)
})

test('roster rules: you must always be able to finish with every role', async () => {
  const { db, owner, league } = await setup({ rosterSize: 5, names: ['ann', 'bo'] })
  await rpc(db, owner, 'start_draft', { p_league: league })
  const first = (await state(db, owner, league)).league.on_clock
  await pickAsOnClock(db, owner, league, idOf('top', 1))
  await pickAsOnClock(db, owner, league, idOf('top', 2)) // other manager
  await pickAsOnClock(db, owner, league, idOf('mid', 3)) // snake: other manager again
  // `first` has a top already and a 5-man roster: a 2nd top would make a full lineup impossible
  await expectError(rpc(db, first, 'make_pick', { p_league: league, p_player: idOf('top', 4) }), /still need a player at every role/)
  await rpc(db, first, 'make_pick', { p_league: league, p_player: idOf('jungle', 4) })
})

test('nobody can hog a role that other managers still need', async () => {
  // 3 managers, 6 teams → exactly 6 supports. Each manager needs at least one.
  const { db, users, owner, league } = await setup({ names: ['ann', 'bo', 'cy'], rosterSize: 10, teams: 6 })
  await rpc(db, owner, 'start_draft', { p_league: league })
  const [a] = (await state(db, owner, league)).members.map((m) => m.user_id)
  // Give ann 4 supports directly (as if drafted in earlier rounds)
  for (let t = 1; t <= 4; t++) {
    await db.query(`insert into draft_picks (league_id, pick_no, user_id, player_id) values ($1, $2, $3, $4)`, [league, 100 + t, a, idOf('support', t)])
  }
  const fifth = await db.query(`select _pick_problem($1, $2, $3) as p`, [league, a, idOf('support', 5)])
  assert.match(fifth.rows[0].p, /unable to fill their support slot/)
  // taking a different role is still fine
  const ok = await db.query(`select _pick_problem($1, $2, $3) as p`, [league, a, idOf('mid', 5)])
  assert.equal(ok.rows[0].p, null)
})

test('timeouts auto-pick: queue first, then best available', async () => {
  const { db, owner, league } = await setup({ pickMinutes: 30 })
  await rpc(db, owner, 'start_draft', { p_league: league })
  const first = (await state(db, owner, league)).league.on_clock

  await rpc(db, first, 'set_queue', { p_league: league, p_players: [idOf('support', 2), 'ghost', idOf('mid', 9), idOf('support', 2)] })
  assert.deepEqual((await state(db, first, league)).queue, [idOf('support', 2), idOf('mid', 9)], 'unknown ids and duplicates dropped')

  assert.equal((await state(db, owner, league)).league.current_pick, 1, 'nothing happens while the clock runs')

  await db.query(`update leagues set pick_deadline = now() - interval '1 minute' where id = $1`, [league])
  const after = await state(db, owner, league)
  assert.equal(after.picks.length, 1)
  assert.equal(after.picks[0].player_id, idOf('support', 2))
  assert.equal(after.picks[0].auto, true)
  assert.equal(after.picks[0].user_id, first)
  assert.equal(after.league.current_pick, 2)
  assert.ok(new Date(after.league.pick_deadline) > new Date(after.now), 'next manager gets a fresh clock')

  await db.query(`update leagues set pick_deadline = now() - interval '1 minute' where id = $1`, [league])
  const again = await state(db, owner, league)
  assert.equal(again.picks.length, 2)
  assert.match(again.picks[1].player_id, /^p12-/, 'best available = highest seed')
  assert.deepEqual((await state(db, first, league)).queue, [idOf('mid', 9)])
})

test('an abandoned draft finishes itself with legal rosters', async () => {
  const { db, owner, league } = await setup({ rosterSize: 7 })
  await rpc(db, owner, 'start_draft', { p_league: league })
  await ghostDraft(db, owner, league)
  const s = await state(db, owner, league)
  assert.equal(s.league.status, 'active')
  assert.equal(s.picks.length, 28)
  assert.equal(new Set(s.picks.map((p) => p.player_id)).size, 28)
  for (const m of s.members) {
    const mine = s.picks.filter((p) => p.user_id === m.user_id)
    assert.equal(mine.length, 7)
    const { rows } = await db.query(`select distinct role from players where id = any($1)`, [mine.map((p) => p.player_id)])
    assert.deepEqual(rows.map((r) => r.role).sort(), [...ROLES].sort(), `${m.username} is missing a role`)
  }
  await expectError(rpc(db, owner, 'make_pick', { p_league: league, p_player: idOf('mid', 1) }), /not drafting/)
})

test('every roster-size / member-count combination drafts to completion', async () => {
  for (const [names, rosterSize, teams] of [
    [['a', 'b'], 5, 4], [['a', 'b', 'c'], 6, 6], [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 7, 12], [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 10, 20],
  ]) {
    const { db, owner, league } = await setup({ names, rosterSize, teams })
    await rpc(db, owner, 'start_draft', { p_league: league })
    await ghostDraft(db, owner, league, names.length * rosterSize + 5)
    const { rows } = await db.query(`select count(*)::int as n, count(distinct player_id)::int as u from draft_picks where league_id = $1`, [league])
    assert.deepEqual(rows[0], { n: names.length * rosterSize, u: names.length * rosterSize })
  }
})

test('auto-draft managers pick instantly and never block humans behind them', async () => {
  const { db, owner, league } = await setup({ rosterSize: 5 })
  await rpc(db, owner, 'start_draft', { p_league: league })
  const [m1, m2, m3, m4] = (await state(db, owner, league)).members.map((m) => m.user_id)
  await rpc(db, m2, 'set_autodraft', { p_league: league, p_user: m2, p_on: true })
  await rpc(db, m3, 'set_autodraft', { p_league: league, p_user: m3, p_on: true })
  await expectError(rpc(db, m2, 'set_autodraft', { p_league: league, p_user: m1, p_on: true }), /owner/)

  await rpc(db, m1, 'make_pick', { p_league: league, p_player: idOf('mid', 1) })
  let s = await state(db, owner, league)
  assert.equal(s.picks.length, 3, 'm1 picked, then m2 and m3 auto-picked')
  assert.equal(s.league.on_clock, m4)

  await rpc(db, m4, 'make_pick', { p_league: league, p_player: idOf('mid', 2) })   // pick 4
  s = await state(db, owner, league)
  assert.equal(s.league.on_clock, m4, 'snake: m4 goes again')
  await rpc(db, m4, 'make_pick', { p_league: league, p_player: idOf('top', 2) })   // pick 5, then m3, m2 auto
  s = await state(db, owner, league)
  assert.equal(s.picks.length, 7)
  assert.equal(s.league.on_clock, m1)

  // the owner can switch a missing manager to auto-draft
  await rpc(db, owner, 'set_autodraft', { p_league: league, p_user: m1, p_on: true })
  s = await state(db, owner, league)
  assert.ok(s.picks.length > 7, 'owner flipped m1 to auto and the draft moved on')
})

test('trades swap players atomically and points follow ownership windows', async () => {
  const { db, owner, league } = await setup({ rosterSize: 5, names: ['ann', 'bo'] })
  await rpc(db, owner, 'start_draft', { p_league: league })
  await ghostDraft(db, owner, league)
  const s = await state(db, owner, league)
  const [a, b] = s.members.map((m) => m.user_id)
  const aMid = s.picks.find((p) => p.user_id === a && p.player_id.endsWith('-mid')).player_id
  const bMid = s.picks.find((p) => p.user_id === b && p.player_id.endsWith('-mid')).player_id

  await db.query(`insert into games (id, stage, started_at) values
    ('g0','play_ins', now() - interval '1 day'), ('g1','swiss', now() - interval '3 hours'), ('g2','swiss', now() + interval '3 hours')`)
  for (const g of ['g0', 'g1', 'g2']) {
    await db.query(`insert into game_stats (game_id, player_id, kills, deaths, assists, cs, won) values ($1,$2,10,0,10,300,true), ($1,$3,0,10,0,100,false)`, [g, aMid, bMid])
  }
  const pts = async () => Object.fromEntries((await rpc(db, a, 'league_overview', { p_league: league })).members.map((m) => [m.user_id, Number(m.points)]))

  const A_GAME = 10 * 3 + 10 * 2 + 300 * 0.02 + 2 /* win */ + 2 /* 10+ K/A */   // 60
  const B_GAME = -10 + 100 * 0.02                                                // -8
  let p = await pts()
  assert.equal(p[a], 2 * A_GAME, 'play-in game excluded by default')
  assert.equal(p[b], 2 * B_GAME)

  await rpc(db, owner, 'update_league', { p_league: league, p_name: 'Test League', p_max_members: 8, p_roster_size: 5, p_pick_minutes: 60, p_count_play_ins: true })
  p = await pts()
  assert.equal(p[a], 3 * A_GAME, 'play-ins counted when the league opts in')
  await rpc(db, owner, 'update_league', { p_league: league, p_name: 'Test League', p_max_members: 8, p_roster_size: 5, p_pick_minutes: 60, p_count_play_ins: false })

  await expectError(rpc(db, a, 'propose_trade', { p_league: league, p_give: bMid, p_get: aMid }), /don't own/)
  const tid = await rpc(db, a, 'propose_trade', { p_league: league, p_give: aMid, p_get: bMid })
  await expectError(rpc(db, a, 'respond_trade', { p_trade: tid, p_accept: true }), /Only the manager receiving/)
  assert.equal(await rpc(db, b, 'respond_trade', { p_trade: tid, p_accept: true }), 'accepted')
  await expectError(rpc(db, b, 'respond_trade', { p_trade: tid, p_accept: true }), /no longer pending/)

  const rosters = await rpc(db, a, 'league_rosters', { p_league: league })
  const current = (pid) => rosters.find((r) => r.player_id === pid && r.released_at == null).user_id
  assert.equal(current(aMid), b)
  assert.equal(current(bMid), a)

  // g1 started before the trade → stays with the original owners. g2 starts after → new owners.
  p = await pts()
  assert.equal(p[a], A_GAME + B_GAME)
  assert.equal(p[b], B_GAME + A_GAME)
})

test('trades that would break a roster are refused; stale offers void', async () => {
  const { db, owner, league } = await setup({ rosterSize: 5, names: ['ann', 'bo', 'cy'] })
  await expectError(rpc(db, owner, 'propose_trade', { p_league: league, p_give: 'x', p_get: 'y' }), /once the draft is finished/)
  await rpc(db, owner, 'start_draft', { p_league: league })
  await ghostDraft(db, owner, league)
  const s = await state(db, owner, league)
  const [a, b, c] = s.members.map((m) => m.user_id)
  const pick = (u, role) => s.picks.find((p) => p.user_id === u && p.player_id.endsWith('-' + role)).player_id

  await expectError(rpc(db, a, 'propose_trade', { p_league: league, p_give: pick(a, 'top'), p_get: pick(b, 'mid') }), /every role/)
  const t1 = await rpc(db, a, 'propose_trade', { p_league: league, p_give: pick(a, 'top'), p_get: pick(b, 'top') })
  const t2 = await rpc(db, a, 'propose_trade', { p_league: league, p_give: pick(a, 'top'), p_get: pick(c, 'top') })
  await expectError(rpc(db, a, 'propose_trade', { p_league: league, p_give: pick(a, 'top'), p_get: pick(c, 'top') }), /already have that exact offer/)
  assert.equal(await rpc(db, b, 'respond_trade', { p_trade: t1, p_accept: true }), 'accepted')

  const trades = await rpc(db, a, 'league_trades', { p_league: league })
  assert.equal(trades.find((t) => t.id === t2).status, 'void', 'offer built on a traded-away player is voided')
  await expectError(rpc(db, c, 'respond_trade', { p_trade: t2, p_accept: true }), /no longer pending/)

  const t3 = await rpc(db, b, 'propose_trade', { p_league: league, p_give: pick(b, 'mid'), p_get: pick(c, 'mid') })
  assert.equal(await rpc(db, c, 'respond_trade', { p_trade: t3, p_accept: false }), 'rejected')
  const t4 = await rpc(db, b, 'propose_trade', { p_league: league, p_give: pick(b, 'mid'), p_get: pick(c, 'mid') })
  await rpc(db, b, 'cancel_trade', { p_trade: t4 })
  await expectError(rpc(db, b, 'cancel_trade', { p_trade: t4 }), /Nothing to cancel/)

  const eve = await signUp(db, 'eve')
  await expectError(rpc(db, eve, 'propose_trade', { p_league: league, p_give: 'x', p_get: 'y' }), /not in that league/)
})

test('process_all_drafts advances overdue drafts and announces each pick once', async () => {
  const { db, owner, league } = await setup({ pickMinutes: 5 })
  await rpc(db, owner, 'start_draft', { p_league: league })
  const first = (await db.query(`select process_all_drafts() as r`)).rows[0].r
  assert.equal(first.length, 1)
  assert.equal(first[0].pick_no, 1)
  assert.deepEqual((await db.query(`select process_all_drafts() as r`)).rows[0].r, [], 'same pick is not announced twice')
  await db.query(`update leagues set pick_deadline = now() - interval '1 second' where id = $1`, [league])
  const next = (await db.query(`select process_all_drafts() as r`)).rows[0].r
  assert.equal(next[0].pick_no, 2)
})

test('league data is locked down for browser roles', async () => {
  const { db, owner } = await setup({ names: ['ann', 'bo'] })
  await db.exec('set role authenticated')
  try {
    await as(db, owner, `select 1`)
    await expectError(db.query(`select * from leagues`), /permission denied/)
    await expectError(db.query(`select * from draft_picks`), /permission denied/)
    await expectError(db.query(`select process_all_drafts()`), /permission denied/)
    await expectError(db.query(`insert into players (id, handle, role) values ('x','x','mid')`), /permission denied/)
    await expectError(db.query(`select _tick(gen_random_uuid())`), /permission denied/)
    assert.equal((await db.query(`select my_leagues() as r`)).rows[0].r.length, 1)
    assert.ok((await db.query(`select players_directory() as r`)).rows[0].r.length >= 60)
  } finally {
    await db.exec('reset role')
  }
  await db.exec('set role anon')
  try {
    await expectError(db.query(`select my_leagues()`), /permission denied/)
    await db.query(`select players_directory()`)
    await db.query(`select * from players limit 1`)
  } finally {
    await db.exec('reset role')
  }
})

test('sealed draft: rank any time, nothing runs early, everything resolves at the deadline', async () => {
  const { db, users, owner, league } = await setup({ rosterSize: 5, names: ['ann', 'bo', 'cy'] })
  await rpc(db, owner, 'update_league', { p_league: league, p_name: 'Sealed', p_max_members: 8, p_roster_size: 5, p_pick_minutes: 1440, p_count_play_ins: false, p_draft_mode: 'sealed' })
  await rpc(db, owner, 'start_draft', { p_league: league })
  let s = await state(db, owner, league)
  assert.equal(s.league.draft_mode, 'sealed')
  assert.equal(s.league.on_clock, null, 'nobody is on the clock')
  await expectError(rpc(db, owner, 'make_pick', { p_league: league, p_player: idOf('mid', 1) }), /sealed draft/)

  // one manager locks in: still nothing happens
  const [a, b, c] = s.members.map((m) => m.user_id)
  await rpc(db, a, 'set_queue', { p_league: league, p_players: [idOf('mid', 1), idOf('top', 1)] })
  await rpc(db, b, 'set_queue', { p_league: league, p_players: [idOf('mid', 1), idOf('top', 2)] }) // both want the same #1
  await rpc(db, a, 'set_autodraft', { p_league: league, p_user: a, p_on: true })
  assert.equal((await state(db, owner, league)).picks.length, 0)

  // deadline passes: the whole draft resolves in order; first in snake order wins contested player
  await db.query(`update leagues set pick_deadline = now() - interval '1 second' where id = $1`, [league])
  s = await state(db, owner, league)
  assert.equal(s.league.status, 'active')
  assert.equal(s.picks.length, 15)
  assert.equal(new Set(s.picks.map((p) => p.player_id)).size, 15)
  const first = s.picks[0]
  assert.equal(first.player_id, idOf('mid', 1))
  assert.ok([a, b].includes(first.user_id))
  void c
})

test('sealed draft starts immediately once every manager has locked in', async () => {
  const { db, owner, league, users } = await setup({ rosterSize: 5, names: ['ann', 'bo'] })
  await rpc(db, owner, 'update_league', { p_league: league, p_name: 'Sealed', p_max_members: 8, p_roster_size: 5, p_pick_minutes: 1440, p_count_play_ins: false, p_draft_mode: 'sealed' })
  await rpc(db, owner, 'start_draft', { p_league: league })
  for (const u of Object.values(users)) await rpc(db, u, 'set_autodraft', { p_league: league, p_user: u, p_on: true })
  assert.equal((await state(db, owner, league)).league.status, 'active')
})

test('Google-style sign-ups get a sensible username from their profile', async () => {
  const db = await newDb()
  await db.query(`insert into auth.users (email, raw_user_meta_data) values ('ada@gmail.com', '{"name":"Ada Lovelace","full_name":"Ada Lovelace"}')`)
  await db.query(`insert into auth.users (email, raw_user_meta_data) values ('ada.l@gmail.com', '{"name":"Ada Lovelace"}')`)
  await db.query(`insert into auth.users (email, raw_user_meta_data) values ('solo@gmail.com', '{}')`)
  const names = (await db.query(`select username from profiles order by created_at`)).rows.map((r) => r.username)
  assert.equal(names[0], 'AdaLovelace')
  assert.match(names[1], /^AdaLovelace\d{4}$/, 'collision gets a suffix')
  assert.equal(names[2], 'solo')
})
