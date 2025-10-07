import { supabase } from './supabase'

export async function getUserLeague(userId: string) {
  // Use the SQL function
  const { data, error } = await supabase
    .rpc('get_user_league', { user_id_param: userId })

  if (error) {
    console.error('RPC Error getting user league:', error)
  }

  console.log('RPC Result:', data)

  // If RPC works, return the result
  if (data && data.length > 0) {
    return data[0]
  }

  // Fallback: Get all leagues and check manually
  console.log('RPC failed or empty, using fallback')
  
  const { data: allLeagues } = await supabase
    .from('leagues')
    .select('*')

  if (allLeagues) {
    // Check if user owns a league
    const ownedLeague = allLeagues.find(l => l.owner_id === userId)
    if (ownedLeague) {
      console.log('Found owned league:', ownedLeague.name)
      return ownedLeague
    }

    // Check if user is in any draft_order
    for (const league of allLeagues) {
      const draftOrder = league.draft_order as string[] || []
      if (draftOrder.includes(userId)) {
        console.log('Found league in draft order:', league.name)
        return league
      }
    }
  }

  console.log('No league found for user')
  return null
}