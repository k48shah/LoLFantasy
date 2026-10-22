import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import { useQuery } from './hooks'
import type { Player, Scoring, TeamLite } from './types'

interface DirectoryValue {
  loading: boolean
  error?: Error
  players: Player[]
  byId: Map<string, Player>
  teams: TeamLite[]
  scoring: Scoring | null
  reload(): void
}

const Ctx = createContext<DirectoryValue | null>(null)

/** Public esports data (players, stats, scoring rules) shared by every page. */
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const players = useQuery(() => api.players(), [], { poll: 90_000 })
  const scoring = useQuery(() => api.scoring(), [])

  const value = useMemo<DirectoryValue>(() => {
    const list = players.data ?? []
    const teams = new Map<string, TeamLite>()
    list.forEach((p) => p.team && teams.set(p.team.id, p.team))
    return {
      loading: players.loading,
      error: players.error,
      players: list,
      byId: new Map(list.map((p) => [p.id, p])),
      teams: [...teams.values()].sort((a, b) => a.code.localeCompare(b.code)),
      scoring: scoring.data ?? null,
      reload: () => void players.reload(),
    }
  }, [players.data, players.loading, players.error, players.reload, scoring.data])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDirectory(): DirectoryValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDirectory outside DirectoryProvider')
  return v
}
