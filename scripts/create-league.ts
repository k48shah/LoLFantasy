import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createLeague(ownerEmail: string) {
  // Get user ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', ownerEmail)
    .single()
  
  if (!user) {
    console.error('User not found')
    return
  }

  // Generate invite code
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()
  
  // Create league
  const { data: league, error } = await supabase
    .from('leagues')
    .insert({
      name: 'Worlds 2025 Fantasy',
      owner_id: user.id,
      invite_code: inviteCode,
      draft_order: [user.id], // Will be updated as people join
      max_teams: 8,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating league:', error)
  } else {
    console.log('✅ League created!')
    console.log('Invite Code:', inviteCode)
  }
}

createLeague('shahkathan2@gmail.com')