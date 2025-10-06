import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseAnonKey ? 'exists' : 'missing')
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)

// Database types
export interface User {
  id: string
  username: string
  email: string
  created_at: string
}

export interface League {
  id: string
  name: string
  owner_id: string
  invite_code: string
  draft_status: 'pending' | 'in_progress' | 'completed'
  draft_order: string[]
  current_pick: number
  max_teams: number
  created_at: string
}

export interface Player {
  id: string
  riot_id: string
  name: string
  team: string
  role: 'top' | 'jungle' | 'mid' | 'adc' | 'support'
  region?: string
  image_url?: string
}

export interface FantasyRoster {
  id: string
  league_id: string
  user_id: string
  player_id: string
  is_starter: boolean
  bench_order?: number
  drafted_at: string
}

export interface MatchStats {
  id: string
  match_id: string
  player_id: string
  kills: number
  deaths: number
  assists: number
  cs: number
  vision_score: number
  fantasy_points: number
  match_date: string
}

export interface Trade {
  id: string
  league_id: string
  from_user: string
  to_user: string
  offered_player_id: string
  requested_player_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
}