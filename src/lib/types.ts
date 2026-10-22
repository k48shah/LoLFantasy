export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support'
export const ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']

export interface TeamLite {
  id: string
  code: string
  name: string
  image_url: string | null
  region?: string | null
}

export interface StatLine {
  games: number
  points: number
  kills: number
  deaths: number
  assists: number
  cs: number
}

export interface Player {
  id: string
  handle: string
  full_name: string | null
  role: Role
  image_url: string | null
  active: boolean
  seed: number
  team: TeamLite | null
  all: StatLine
  main: StatLine
}

export interface PlayerGame {
  game_id: string
  started_at: string
  stage: string
  champion: string | null
  kills: number
  deaths: number
  assists: number
  cs: number
  won: boolean
  points: number
  opponent: string | null
}

export interface MatchTeam {
  id: string | null
  code: string
  name: string | null
  image_url: string | null
}

export interface Match {
  id: string
  stage: string
  block_name: string | null
  start_time: string | null
  state: 'unstarted' | 'inProgress' | 'completed'
  best_of: number | null
  team1_wins: number
  team2_wins: number
  team1: MatchTeam
  team2: MatchTeam
}

export interface Scoring {
  kill: number
  assist: number
  death: number
  cs: number
  win: number
  ka_bonus_threshold: number
  ka_bonus: number
}

export type LeagueStatus = 'lobby' | 'drafting' | 'active'
export type DraftMode = 'live' | 'sealed'

export interface LeagueSummary {
  id: string
  name: string
  status: LeagueStatus
  invite_code: string
  max_members: number
  roster_size: number
  draft_mode: DraftMode
  members: number
  is_owner: boolean
  my_turn: boolean | null
  on_clock: string | null
  pick_deadline: string | null
}

export interface LeagueMember {
  user_id: string
  username: string
  draft_position: number | null
  auto_draft: boolean
  is_owner: boolean
  points: number
  players: number
}

export interface LeagueOverview {
  me: string
  league: {
    id: string
    name: string
    status: LeagueStatus
    invite_code: string
    owner_id: string
    max_members: number
    roster_size: number
    pick_minutes: number
    count_play_ins: boolean
    draft_mode: DraftMode
    current_pick: number
    pick_deadline: string | null
    on_clock: string | null
    created_at: string
  }
  members: LeagueMember[]
}

export interface DraftMember {
  user_id: string
  username: string
  draft_position: number | null
  auto_draft: boolean
}

export interface DraftPick {
  pick_no: number
  user_id: string
  player_id: string
  auto: boolean
  picked_at: string
}

export interface DraftState {
  now: string
  me: string
  league: {
    id: string
    name: string
    status: LeagueStatus
    owner_id: string
    roster_size: number
    pick_minutes: number
    draft_mode: DraftMode
    current_pick: number
    pick_deadline: string | null
    on_clock: string | null
    total_picks: number
  }
  members: DraftMember[]
  picks: DraftPick[]
  queue: string[]
}

export interface RosterSpot {
  spot_id: number
  user_id: string
  player_id: string
  acquired_at: string | null
  released_at: string | null
  points: number
  games: number
}

export interface Trade {
  id: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'void'
  created_at: string
  resolved_at: string | null
  proposer_id: string
  recipient_id: string
  proposer: string
  recipient: string
  give_player: string
  get_player: string
}

export interface LeaguePreview {
  id: string
  name: string
  status: LeagueStatus
  max_members: number
  members: number
  owner: string
  already_member: boolean
}

export interface Profile {
  id: string
  username: string
}
