// Demo mode (`npm run dev:demo`): runs the REAL schema.sql inside the browser on PGlite
// (WASM Postgres), seeded with a snapshot of real Worlds data. No Supabase needed.
import { PGlite } from '@electric-sql/pglite'
import stubSql from '../../supabase/dev-stub.sql?raw'
import schemaSql from '../../supabase/schema.sql?raw'
import snapshot from '../../data/snapshot.json'
import type { AuthEvent, AuthUser, Backend } from './backend'

type Row = Record<string, unknown>
const TABLE_ORDER = ['teams', 'players', 'matches', 'games', 'game_stats'] as const
const PUBLIC_FNS = new Set(['players_directory', 'player_games', 'schedule', 'scoring'])
const BOTS = ['Baron_Steve', 'Nashor_Nick', 'Rift_Rita']

export async function createDemoBackend(): Promise<Backend> {
  const db = new PGlite()
  await db.exec(stubSql)
  await db.exec(schemaSql)

  const snap = snapshot as unknown as Record<string, Row[]>
  for (const table of TABLE_ORDER) {
    for (const row of snap[table] ?? []) {
      const entries = Object.entries(row).filter(([, v]) => v !== null && v !== undefined)
      const cols = entries.map(([k]) => `"${k}"`).join(', ')
      const params = entries.map((_, i) => `$${i + 1}`).join(', ')
      await db.query(`insert into public.${table} (${cols}) values (${params})`, entries.map(([, v]) => v))
    }
  }

  // PGlite has a single connection, so serialise (set uid → run) pairs.
  let chain: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn)
    chain = next.catch(() => undefined)
    return next
  }

  let uid: string | null = null
  const listeners = new Set<(e: AuthEvent) => void>()
  const emit = (user: AuthUser | null) => listeners.forEach((l) => l({ user }))

  const asUser = <T>(who: string | null, fn: () => Promise<T>) =>
    exclusive(async () => {
      await db.query(`select set_config('app.uid', $1, false)`, [who ?? ''])
      return fn()
    })

  async function userByName(name: string): Promise<string | null> {
    const { rows } = await db.query<{ id: string }>(`select id from auth.users where lower(email) = lower($1)`, [`${name}@demo.local`])
    return rows[0]?.id ?? null
  }
  async function ensureUser(name: string): Promise<string> {
    const existing = await userByName(name)
    if (existing) return existing
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [`${name}@demo.local`, JSON.stringify({ username: name })],
    )
    return rows[0].id
  }
  const call = async <T>(who: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const keys = Object.keys(args)
    const sql = `select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`
    return asUser(who, async () => (await db.query<{ r: T }>(sql, keys.map((k) => args[k]))).rows[0].r)
  }

  /** First person through the door gets a ready-made league full of bots. */
  async function seedLeague(owner: string) {
    const existing = await db.query(`select 1 from public.leagues limit 1`)
    if (existing.rows.length) return
    const league = await call<string>(owner, 'create_league', {
      p_name: 'Friends of Worlds', p_max_members: 8, p_roster_size: 7, p_pick_minutes: 480, p_count_play_ins: true,
    })
    const { rows } = await db.query<{ invite_code: string }>(`select invite_code from public.leagues where id = $1`, [league])
    await db.query(`update public.leagues set invite_code = 'DEMO123' where id = $1`, [league])
    void rows
    for (const bot of BOTS) {
      const id = await ensureUser(bot)
      await call(id, 'join_league', { p_code: 'DEMO123' })
      await call(id, 'set_autodraft', { p_league: league, p_user: id, p_on: true })
    }
  }

  const toUser = (id: string, name: string): AuthUser => ({ id, email: `${name}@demo.local` })

  return {
    kind: 'demo',
    rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!uid && !PUBLIC_FNS.has(fn)) return Promise.reject(new Error('Please sign in first.'))
      return call<T>(uid, fn, args).catch((e) => {
        // PGlite errors carry the raw message already
        throw new Error(String(e.message ?? e))
      })
    },
    auth: {
      async getUser() {
        const saved = sessionStorage.getItem('demo-user')
        if (!saved) return null
        const id = await userByName(saved)
        if (!id) return null
        uid = id
        return toUser(id, saved)
      },
      onChange(cb) {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
      async signInWithGoogle(demoName) {
        const name = (demoName ?? '').replace(/[^A-Za-z0-9_-]/g, '') || 'player'
        uid = await ensureUser(name)
        sessionStorage.setItem('demo-user', name)
        await seedLeague(uid)
        emit(toUser(uid, name))
      },
      async signOut() {
        uid = null
        sessionStorage.removeItem('demo-user')
        emit(null)
      },
    },
    demo: {
      async expireClock(leagueId) {
        await exclusive(() => db.query(`update public.leagues set pick_deadline = now() - interval '1 second' where id = $1 and status = 'drafting'`, [leagueId]))
      },
      async usernames() {
        const { rows } = await db.query<{ username: string }>(`select username from public.profiles order by created_at`)
        return rows.map((r) => r.username)
      },
    },
  }
}
