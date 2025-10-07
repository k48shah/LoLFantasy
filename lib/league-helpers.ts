import { supabase } from './supabase'

export async function getUserLeague(userId: string) {
  // Method 1: Check if user has a roster (has drafted players)
  const { data: rosterData } = await supabase
    .from('fantasy_rosters')
    .select(`
      league_id,
      leagues (*)
    `)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (rosterData?.leagues) {
    return rosterData.leagues as any
  }

  // Method 2: Check if user owns a league
  const { data: ownedLeague } = await supabase
    .from('leagues')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()

  if (ownedLeague) {
    return ownedLeague
  }

  // Method 3: Check if user is in draft_order (joined but not drafted yet)
  const { data: memberLeague } = await supabase
    .from('leagues')
    .select('*')
    .contains('draft_order', [userId])
    .limit(1)
    .maybeSingle()

  return memberLeague
}