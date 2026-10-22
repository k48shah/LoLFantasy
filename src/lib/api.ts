import { getBackend } from './backend'
import type {
  DraftMode, DraftState, LeagueOverview, LeaguePreview, LeagueSummary, Match, Player, PlayerGame, Profile, RosterSpot, Scoring, Trade,
} from './types'

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => (await getBackend()).rpc<T>(fn, args)

export interface LeagueSettings {
  name: string
  maxMembers: number
  rosterSize: number
  pickMinutes: number
  countPlayIns: boolean
  draftMode: DraftMode
}

const settingsArgs = (s: LeagueSettings) => ({
  p_name: s.name,
  p_max_members: s.maxMembers,
  p_roster_size: s.rosterSize,
  p_pick_minutes: s.pickMinutes,
  p_count_play_ins: s.countPlayIns,
  p_draft_mode: s.draftMode,
})

export const api = {
  // public esports data
  players: () => rpc<Player[]>('players_directory'),
  playerGames: (id: string) => rpc<PlayerGame[]>('player_games', { p_player: id }),
  schedule: () => rpc<Match[]>('schedule'),
  scoring: () => rpc<Scoring>('scoring'),

  // profile
  profile: () => rpc<Profile>('my_profile'),
  updateUsername: (username: string) => rpc<void>('update_username', { p_username: username }),

  // leagues
  myLeagues: () => rpc<LeagueSummary[]>('my_leagues'),
  createLeague: (s: LeagueSettings) => rpc<string>('create_league', settingsArgs(s)),
  preview: (code: string) => rpc<LeaguePreview | null>('league_preview', { p_code: code }),
  join: (code: string) => rpc<string>('join_league', { p_code: code }),
  leave: (league: string) => rpc<void>('leave_league', { p_league: league }),
  removeMember: (league: string, user: string) => rpc<void>('remove_member', { p_league: league, p_user: user }),
  deleteLeague: (league: string) => rpc<void>('delete_league', { p_league: league }),
  updateLeague: (league: string, s: LeagueSettings) => rpc<void>('update_league', { p_league: league, ...settingsArgs(s) }),
  overview: (league: string) => rpc<LeagueOverview>('league_overview', { p_league: league }),
  rosters: (league: string) => rpc<RosterSpot[]>('league_rosters', { p_league: league }),

  // draft
  draftState: (league: string) => rpc<DraftState>('draft_state', { p_league: league }),
  startDraft: (league: string) => rpc<void>('start_draft', { p_league: league }),
  pick: (league: string, player: string) => rpc<void>('make_pick', { p_league: league, p_player: player }),
  setQueue: (league: string, players: string[]) => rpc<void>('set_queue', { p_league: league, p_players: players }),
  setAutodraft: (league: string, user: string, on: boolean) => rpc<void>('set_autodraft', { p_league: league, p_user: user, p_on: on }),

  // trades
  trades: (league: string) => rpc<Trade[]>('league_trades', { p_league: league }),
  proposeTrade: (league: string, give: string, get: string) => rpc<string>('propose_trade', { p_league: league, p_give: give, p_get: get }),
  respondTrade: (trade: string, accept: boolean) => rpc<string>('respond_trade', { p_trade: trade, p_accept: accept }),
  cancelTrade: (trade: string) => rpc<void>('cancel_trade', { p_trade: trade }),
}
