import { supabase } from './supabase'

export async function getUserLeague(userId: string) {
  // First check if user has a roster (is a member)
  const { data: rosterData } = await supabase
    .from('fantasy_rosters')
    .select(`
      league_id,
      leagues (*)
    `)
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (rosterData?.leagues) {
    return rosterData.leagues as any
  }

  // If no roster, check if user owns a league
  const { data: ownedLeague } = await supabase
    .from('leagues')
    .select('*')
    .eq('owner_id', userId)
    .limit(1)
    .single()

  return ownedLeague
}