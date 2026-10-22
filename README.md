# Fantasy with the Boiz

A private fantasy league for LoL Worlds. Friends join with an invite link and **draft on their own time**
(snake order + pick clock + queue + auto-pick), then earn points from real per-game stats.

- **Site:** Vite + React + Tailwind, hosted free on GitHub Pages
- **Backend:** Supabase (auth + Postgres). All draft/trade rules live in SQL functions, so they can't be cheated or raced
- **Data:** GitHub Actions pull teams, rosters and per-game K/D/A/CS from Riot's esports feed

## One-time setup

### 1. Supabase
1. SQL Editor → run `supabase/reset.sql` (clears old tables), then `supabase/schema.sql`.
2. **Google sign-in** (nobody types a password on the site):
   1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project → *APIs & Services → OAuth consent screen* (External, add your app name + email; publish it so friends outside your Google org can log in).
   2. *Credentials → Create credentials → OAuth client ID → Web application*. Under **Authorized redirect URIs** add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   3. Copy the Client ID and Client secret into Supabase → Authentication → Providers → **Google** → enable → Save.
   4. Supabase → Authentication → URL Configuration: set **Site URL** to your GitHub Pages URL (`https://k48shah.github.io/LoLFantasy/`) and add the same URL under **Redirect URLs**.
3. Settings → API: copy the project URL, `anon` key and `service_role` key.

### 2. GitHub repo (Settings → Secrets and variables → Actions)
| Secret | Value |
|---|---|
| `SUPABASE_URL` | project URL |
| `SUPABASE_ANON_KEY` | anon key (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secret**, only used by Actions) |
| `DISCORD_WEBHOOK_URL` | optional: pings a channel when someone goes on the clock |

Optional variable `SITE_URL` = your site URL (linked in Discord pings).
Then Settings → Pages → Source: **GitHub Actions**.

### 3. Load the data
Actions tab → run **Sync rosters** once (fills teams, players, matches, results). After that **Sync game stats**
runs every 10 minutes and **Draft clock** every 5 on their own.

### 4. Deploy
Push to `main`. The *Test and deploy site* workflow runs the tests, builds, and publishes.
Create a league, share the invite link, start the draft.

## Day to day
- Wrong player pool? Edit `scripts/data/overrides.json`, push, re-run **Sync rosters**.
- Scoring lives in the `scoring_rules` table (one row); change it in Supabase and all points update everywhere.
- Draft stuck on someone who vanished? Owner can switch them to auto-draft from the draft board.

## Local development
```bash
npm install
npm run dev:demo   # full app on an in-browser Postgres + real Worlds snapshot, no Supabase needed
npm test           # runs schema.sql in PGlite: snake order, roster rules, timeouts, trades, permissions
npm run sync:dry   # fetch from Riot into data/snapshot.json without touching Supabase
```
For the real thing, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` and run `npm run dev`.
