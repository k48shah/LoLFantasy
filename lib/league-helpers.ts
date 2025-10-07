import { supabase } from './supabase'

export async function getUserLeague(userId: string) {
  const { data, error } = await supabase
    .rpc('get_user_league', { user_id_param: userId })

  if (error) {
    console.error('Error getting user league:', error)
    return null
  }

  return data?.[0] || null
}