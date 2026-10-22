import { useOutletContext } from 'react-router-dom'
import type { LeagueOverview } from '../../lib/types'

export interface LeagueCtx {
  id: string
  overview: LeagueOverview
  reload(): void
}

export const useLeague = () => useOutletContext<LeagueCtx>()
