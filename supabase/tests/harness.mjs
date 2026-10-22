import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const sql = (f) => readFileSync(path.join(dir, '..', f), 'utf8')

export const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

export async function newDb({ teams = 12 } = {}) {
  const db = new PGlite()
  await db.exec(sql('dev-stub.sql'))
  await db.exec(sql('schema.sql'))

  // teams × 5 players. Even-numbered teams are "strong" (higher seed).
  for (let t = 1; t <= teams; t++) {
    await db.query(`insert into teams (id, slug, code, name, in_main_event) values ($1,$2,$3,$4,true)`,
      [`t${t}`, `team-${t}`, `T${t}`, `Team ${t}`])
    for (const [i, role] of ROLES.entries()) {
      await db.query(
        `insert into players (id, handle, role, team_id, active, seed_rating) values ($1,$2,$3,$4,true,$5)`,
        [`p${t}-${role}`, `Player${t}${role[0]}${i}`, role, `t${t}`, 10 + t])
    }
  }
  return db
}

export async function signUp(db, name) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name}@example.com`, JSON.stringify({ username: name })])
  return rows[0].id
}

/** Run a call as a given user (sets auth.uid()). */
export async function as(db, uid, text, params = []) {
  await db.query(`select set_config('app.uid', $1, false)`, [uid ?? ''])
  return db.query(text, params)
}

export async function rpc(db, uid, fn, args = {}) {
  const keys = Object.keys(args)
  const call = `select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`
  const { rows } = await as(db, uid, call, keys.map((k) => args[k]))
  return rows[0].r
}

export async function expectError(promise, pattern) {
  try {
    await promise
  } catch (e) {
    if (!pattern.test(e.message)) throw new Error(`Wrong error. Expected ${pattern}, got: ${e.message}`)
    return e
  }
  throw new Error(`Expected an error matching ${pattern} but the call succeeded`)
}
