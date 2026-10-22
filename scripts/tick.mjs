// Run every few minutes by GitHub Actions.
//  1. Advances any draft whose pick clock has run out (auto-pick), even if nobody has the site open.
//  2. Pings a Discord channel (optional) the first time each manager goes on the clock.
//
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required
//   DISCORD_WEBHOOK_URL                        optional
//   SITE_URL                                   optional, linked from the Discord message

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await db.rpc('process_all_drafts')
if (error) {
  console.error('process_all_drafts failed:', error.message)
  process.exit(1)
}

const onClock = data ?? []
console.log(`${onClock.length} manager(s) newly on the clock`)

const hook = process.env.DISCORD_WEBHOOK_URL
if (hook) {
  for (const e of onClock) {
    const unix = Math.floor(Date.parse(e.deadline) / 1000)
    const site = process.env.SITE_URL ? `\n${process.env.SITE_URL}` : ''
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `⏰ **${e.username}** is on the clock in **${e.league}** (pick #${e.pick_no}) — auto-pick <t:${unix}:R>${site}`,
        allowed_mentions: { parse: [] },
      }),
    })
    if (!res.ok) console.warn(`Discord responded ${res.status}`)
    await new Promise((r) => setTimeout(r, 600))
  }
}
