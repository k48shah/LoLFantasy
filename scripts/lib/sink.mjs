// Where synced data goes: Supabase (real runs) or a JSON snapshot on disk (--dry).
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const TABLES = ['teams', 'players', 'matches', 'games', 'game_stats']
const KEYS = { teams: 'id', players: 'id', matches: 'id', games: 'id', game_stats: 'game_id,player_id' }

export function supabaseSink() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or run with --dry).')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const must = (res, what) => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`)
    return res.data
  }
  return {
    name: 'supabase',
    db,
    async upsert(table, rows, { ignoreDuplicates = false } = {}) {
      for (let i = 0; i < rows.length; i += 400) {
        must(await db.from(table).upsert(rows.slice(i, i + 400), { onConflict: KEYS[table], ignoreDuplicates }), `upsert ${table}`)
      }
    },
    async ids(table, column = 'id') {
      const out = new Set()
      for (let from = 0; ; from += 1000) {
        const data = must(await db.from(table).select(column).range(from, from + 999), `read ${table}`)
        data.forEach((r) => out.add(r[column]))
        if (data.length < 1000) break
      }
      return out
    },
    async matchState() {
      const data = must(await db.from('matches').select('id,ingested'), 'read matches')
      return new Map(data.map((m) => [m.id, m.ingested]))
    },
    async playedForTeam() {
      // team_id -> Set(player_id) for everyone with a recorded Worlds game
      const out = new Map()
      for (let from = 0; ; from += 1000) {
        const data = must(await db.from('game_stats').select('team_id,player_id').range(from, from + 999), 'read stats')
        for (const r of data) {
          if (!out.has(r.team_id)) out.set(r.team_id, new Set())
          out.get(r.team_id).add(r.player_id)
        }
        if (data.length < 1000) break
      }
      return out
    },
    async finish() {},
  }
}

export function jsonSink(file) {
  const tables = Object.fromEntries(TABLES.map((t) => [t, new Map()]))
  const keyOf = (table, row) => KEYS[table].split(',').map((k) => row[k]).join('|')
  if (existsSync(file)) {
    const prev = JSON.parse(readFileSync(file, 'utf8'))
    for (const t of TABLES) for (const row of prev[t] ?? []) tables[t].set(keyOf(t, row), row)
  }
  return {
    name: `json:${file}`,
    async upsert(table, rows, { ignoreDuplicates = false } = {}) {
      for (const row of rows) {
        const k = keyOf(table, row)
        if (ignoreDuplicates && tables[table].has(k)) continue
        tables[table].set(k, { ...tables[table].get(k), ...row })
      }
    },
    async ids(table, column = 'id') {
      return new Set([...tables[table].values()].map((r) => r[column]))
    },
    async matchState() {
      return new Map([...tables.matches.values()].map((m) => [m.id, !!m.ingested]))
    },
    async playedForTeam() {
      const out = new Map()
      for (const r of tables.game_stats.values()) {
        if (!out.has(r.team_id)) out.set(r.team_id, new Set())
        out.get(r.team_id).add(r.player_id)
      }
      return out
    },
    async finish() {
      mkdirSync(path.dirname(file), { recursive: true })
      const snapshot = Object.fromEntries(TABLES.map((t) => [t, [...tables[t].values()]]))
      writeFileSync(file, JSON.stringify(snapshot, null, 1))
      console.log(`wrote ${file}: ` + TABLES.map((t) => `${tables[t].size} ${t}`).join(', '))
    },
  }
}
