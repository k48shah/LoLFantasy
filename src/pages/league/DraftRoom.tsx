import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Board } from '../../components/draft/Board'
import { localProblem, picksUntil, rating } from '../../components/draft/logic'
import { Pool } from '../../components/draft/Pool'
import { MyRoster, PickFeed, QueuePanel } from '../../components/draft/SidePanels'
import { StatusBar } from '../../components/draft/StatusBar'
import { PlayerModal } from '../../components/PlayerModal'
import { ErrorBox, PageLoader, Segmented, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { useDirectory } from '../../lib/directory'
import { useQuery } from '../../lib/hooks'
import { useToast } from '../../lib/toast'
import type { Player } from '../../lib/types'
import { useLeague } from './context'

type Tab = 'pool' | 'board' | 'team'

export function DraftRoom() {
  const { id, reload: reloadOverview } = useLeague()
  const dir = useDirectory()
  const toast = useToast()
  const ds = useQuery(() => api.draftState(id), [id], { poll: 5000 })
  const state = ds.data

  const [tab, setTab] = useState<Tab>('pool')
  const [inspect, setInspect] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [queue, setQueue] = useState<string[] | null>(null)
  const writes = useRef<Promise<unknown>>(Promise.resolve())

  // The queue is edited locally for snappy reordering and saved in order; polling never overwrites it.
  useEffect(() => setQueue(null), [id])
  useEffect(() => {
    if (state && queue === null) setQueue(state.queue)
  }, [state, queue])
  const pickCount = state?.picks.length ?? 0
  useEffect(() => {
    if (!state || !queue) return
    const taken = new Set(state.picks.map((p) => p.player_id))
    if (queue.some((q) => taken.has(q))) setQueue(queue.filter((q) => !taken.has(q)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickCount])

  const saveQueue = (next: string[]) => {
    setQueue(next)
    writes.current = writes.current
      .then(() => api.setQueue(id, next))
      .catch((e: Error) => {
        toast.error(`Couldn't save your queue: ${e.message}`)
      })
  }

  const names = useMemo(() => new Map((state?.members ?? []).map((m) => [m.user_id, m.username])), [state?.members])
  const takenBy = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of state?.picks ?? []) m.set(p.player_id, names.get(p.user_id) ?? '?')
    return m
  }, [state?.picks, names])

  if (ds.error && !state) return <ErrorBox error={ds.error} retry={ds.reload} />
  if (!state || queue === null) return <PageLoader label="Entering the draft room…" />
  if (dir.loading && dir.players.length === 0) return <Skeleton className="h-96" />

  const { league, me } = state
  const order = state.members.map((m) => m.user_id)
  const mineIds = state.picks.filter((p) => p.user_id === me).map((p) => p.player_id)
  const mine = mineIds.map((pid) => dir.byId.get(pid)).filter((p): p is Player => !!p)
  const isMyTurn = league.status === 'drafting' && league.on_clock === me
  const untilMe = league.status === 'drafting' ? picksUntil(order, league.current_pick, league.total_picks, me) : null
  const myMember = state.members.find((m) => m.user_id === me)
  const skew = Date.parse(state.now) - Date.now()

  const pool = dir.players.filter((p) => p.active || takenBy.has(p.id))
  const queueSet = new Set(queue)

  const nextAuto = (() => {
    const legal = (p?: Player) => !!p && !takenBy.has(p.id) && !localProblem(p, mine, league.roster_size)
    for (const qid of queue) {
      const p = dir.byId.get(qid)
      if (legal(p)) return p
    }
    return [...pool].filter(legal).sort((a, b) => rating(b) - rating(a))[0]
  })()

  async function refresh() {
    await ds.reload()
    reloadOverview()
  }

  async function onPick(p: Player) {
    setPending(p.id)
    const res = await toast.attempt(() => api.pick(id, p.id), `Drafted ${p.handle}!`)
    setPending(null)
    if (!res.ok) await ds.reload() // the board may have moved on without us
    else await refresh()
  }

  async function setAuto(userId: string, on: boolean) {
    const res = await toast.attempt(() => api.setAutodraft(id, userId, on), on ? 'Auto-draft on.' : 'Auto-draft off.')
    if (res.ok) await refresh()
  }

  const toggleQueue = (p: Player) => saveQueue(queueSet.has(p.id) ? queue.filter((x) => x !== p.id) : [...queue, p.id])
  const move = (i: number, dir_: -1 | 1) => {
    const next = [...queue]
    const j = i + dir_
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    saveQueue(next)
  }

  const live = league.status === 'drafting'
  const show = (t: Tab) => (tab === t ? '' : 'hidden lg:block')

  return (
    <div className="space-y-4">
      <StatusBar
        state={state}
        skew={skew}
        onClockName={names.get(league.on_clock ?? '')}
        isMyTurn={isMyTurn}
        untilMe={untilMe}
        nextAutoName={nextAuto?.handle}
        autoOn={!!myMember?.auto_draft}
        onToggleAuto={(on) => void setAuto(me, on)}
      />

      <div className="lg:hidden">
        <Segmented
          value={tab}
          onChange={setTab}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'pool', label: 'Players' },
            { value: 'board', label: 'Board' },
            { value: 'team', label: 'My team' },
          ]}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
        <div className="min-w-0 space-y-4">
          <div className={show('board')}>
            <Board state={state} byId={dir.byId} onToggleAuto={(uid, on) => void setAuto(uid, on)} onInspect={setInspect} />
          </div>
          <div className={show('pool')}>
            <Pool
              players={pool}
              teams={dir.teams.filter((t) => pool.some((p) => p.team?.id === t.id))}
              takenBy={takenBy}
              queued={queueSet}
              canPick={isMyTurn && league.draft_mode === 'live'}
              problem={(p) => localProblem(p, mine, league.roster_size)}
              pendingId={pending}
              onPick={(p) => void onPick(p)}
              onQueue={toggleQueue}
              onInspect={setInspect}
            />
          </div>
        </div>

        <aside className={clsx('min-w-0 space-y-4 lg:sticky lg:top-20', tab === 'team' ? '' : 'hidden lg:block')}>
          {league.status !== 'active' && (
            <QueuePanel sealed={league.draft_mode === 'sealed'} queue={queue} byId={dir.byId} takenBy={takenBy} onMove={move} onRemove={(i) => saveQueue(queue.filter((_, k) => k !== i))} onClear={() => saveQueue([])} />
          )}
          <MyRoster mine={mine} rosterSize={league.roster_size} />
          {live && <PickFeed picks={state.picks} byId={dir.byId} names={names} />}
        </aside>
      </div>

      <PlayerModal playerId={inspect} onClose={() => setInspect(null)} />
    </div>
  )
}
