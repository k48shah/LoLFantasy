import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Handshake, ListOrdered, Swords, Timer } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useDirectory } from '../lib/directory'

export function RulesPage() {
  const { scoring: s } = useDirectory()
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n).replace('-', '−'))
  const rows: [string, string][] = s
    ? [
        ['Kill', signed(s.kill)],
        ['Assist', signed(s.assist)],
        ['Death', signed(s.death)],
        ['Creep kill (CS)', signed(s.cs)],
        ['Team wins the game', signed(s.win)],
        [`${s.ka_bonus_threshold}+ kills + assists in a game`, signed(s.ka_bonus)],
      ]
    : []

  return (
    <>
      <PageHeader eyebrow="How it works" title="Rules" subtitle="Everything you need to know in one minute." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={<Swords className="h-5 w-5" />} title="Scoring">
          <p>Every player on your roster earns points <b>per game</b> from their real stats:</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} className="border-b border-gold-400/10">
                  <td className="py-2 text-slate-300">{k}</td>
                  <td className="py-2 text-right font-display font-bold tabular-nums text-gold-100">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-slate-400">Stats are pulled from Riot's feed a few minutes after each game ends. Your league can choose whether Play-In games count (set when you create it).</p>
        </Card>

        <Card icon={<ListOrdered className="h-5 w-5" />} title="The draft">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Snake order:</b> the owner starts the draft and the order is randomized. Pick 1→N, then N→1, and so on, so no spot has a built-in edge.</li>
            <li><b>Every roster</b> must end with at least one Top, Jungle, Mid, Bot and Support. The site won't let you make a pick that makes that impossible.</li>
            <li><b>No duplicates:</b> once someone drafts a player, he's gone for the whole league. Picks are decided by the server, so two people can never take the same player.</li>
            <li>Everyone on your roster scores — there's no lineup to set.</li>
          </ul>
        </Card>

        <Card icon={<Timer className="h-5 w-5" />} title="Draft on your own time">
          <ul className="list-disc space-y-2 pl-5">
            <li>Nobody has to be online together. When it's your turn you have the league's <b>pick clock</b> (e.g. 8 hours) to choose.</li>
            <li>Build a <b>queue</b> of players you like. If your clock runs out we draft the top legal player in your queue — or the best available if it's empty.</li>
            <li>Flip on <b>Auto-draft</b> and we'll do that instantly every time you're up. Turn it off whenever you want to take control.</li>
            <li>The owner can switch a missing manager to auto-draft so the league never stalls.</li>
            <li><b>Sealed drafts</b> skip turns entirely: everyone ranks players any time before the deadline, then the snake draft runs instantly from those rankings (earlier in the order = first dibs on contested players). Perfect when you can't be online together.</li>
          </ul>
        </Card>

        <Card icon={<Handshake className="h-5 w-5" />} title="Trades">
          <ul className="list-disc space-y-2 pl-5">
            <li>After the draft, propose a 1-for-1 swap with any manager. They can accept or decline.</li>
            <li>Rosters must still cover all five roles after the swap.</li>
            <li><b>Points follow the player's owner at the time of each game.</b> Trading for someone who just had a huge night doesn't give you those points.</li>
          </ul>
        </Card>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Ready? <Link to="/" className="text-hex-400 underline">Create or join a league</Link>.
      </p>
    </>
  )
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="panel animate-rise p-6 text-sm leading-relaxed text-slate-300">
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl font-bold text-gold-100">
        <span className="text-gold-400">{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}
