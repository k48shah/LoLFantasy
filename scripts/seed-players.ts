import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Riot Esports API endpoints
const ESPORTS_API = 'https://esports-api.lolesports.com/persisted/gw';

interface RiotTeam {
  id: string;
  name: string;
  code: string;
  players: RiotPlayer[];
}

interface RiotPlayer {
  id: string;
  summonerName: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

async function fetchWorldsTeams() {
  try {
    // Fetch Worlds 2025 tournament data
    const response = await fetch(
      `${ESPORTS_API}/getEventDetails?hl=en-US&id=worlds_2025`,
      {
        headers: {
          'x-api-key': process.env.RIOT_API_KEY || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.event.tournament.teams || [];
  } catch (error) {
    console.error('Error fetching from Riot API:', error);
    return [];
  }
}

async function fetchTeamRoster(teamId: string) {
  try {
    const response = await fetch(
      `${ESPORTS_API}/getTeams?hl=en-US&id=${teamId}`,
      {
        headers: {
          'x-api-key': process.env.RIOT_API_KEY || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.data.teams[0]?.players || [];
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return [];
  }
}

function mapRoleToPosition(riotRole: string): string {
  const roleMap: { [key: string]: string } = {
    'top': 'top',
    'jungle': 'jungle',
    'mid': 'mid',
    'bottom': 'adc',
    'support': 'support',
    'adc': 'adc'
  };
  return roleMap[riotRole.toLowerCase()] || 'mid';
}

async function seedPlayersFromAPI() {
  console.log('Fetching Worlds 2025 teams from Riot API...');
  
  const teams = await fetchWorldsTeams();
  
  if (teams.length === 0) {
    console.log('No teams found from API, using manual data...');
    await seedManualPlayers();
    return;
  }

  const players = [];

  for (const team of teams) {
    const roster = await fetchTeamRoster(team.id);
    
    for (const player of roster) {
      players.push({
        riot_id: `${player.id}_${team.code.toLowerCase()}`,
        name: player.summonerName,
        team: team.code,
        role: mapRoleToPosition(player.role),
        region: team.region || 'Unknown'
      });
    }
  }

  console.log(`Found ${players.length} players from ${teams.length} teams`);

  const { error } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'riot_id' });
  
  if (error) {
    console.error('Error seeding players:', error);
  } else {
    console.log('✅ Successfully seeded players from Riot API!');
  }
}

async function seedManualPlayers() {
  // Fallback manual data
  const manualPlayers = [
    // T1
    { riot_id: 'doran_t1', name: 'Doran', team: 'T1', role: 'top', region: 'LCK' },
    { riot_id: 'oner_t1', name: 'Oner', team: 'T1', role: 'jungle', region: 'LCK' },
    { riot_id: 'faker_t1', name: 'Faker', team: 'T1', role: 'mid', region: 'LCK' },
    { riot_id: 'gumayusi_t1', name: 'Gumayusi', team: 'T1', role: 'adc', region: 'LCK' },
    { riot_id: 'keria_t1', name: 'Keria', team: 'T1', role: 'support', region: 'LCK' },
    
    // Gen.G
    { riot_id: 'kiin_geng', name: 'Kiin', team: 'Gen.G', role: 'top', region: 'LCK' },
    { riot_id: 'canyon_geng', name: 'Canyon', team: 'Gen.G', role: 'jungle', region: 'LCK' },
    { riot_id: 'chovy_geng', name: 'Chovy', team: 'Gen.G', role: 'mid', region: 'LCK' },
    { riot_id: 'ruler_geng', name: 'Ruler', team: 'Gen.G', role: 'adc', region: 'LCK' },
    { riot_id: 'duro_geng', name: 'Duro', team: 'Gen.G', role: 'support', region: 'LCK' },

    // BLG
    { riot_id: 'bin_blg', name: 'Bin', team: 'BLG', role: 'top', region: 'LPL' },
    { riot_id: 'beichuan_blg', name: 'Beichuan', team: 'BLG', role: 'jungle', region: 'LPL' },
    { riot_id: 'knight_blg', name: 'Knight', team: 'BLG', role: 'mid', region: 'LPL' },
    { riot_id: 'elk_blg', name: 'Elk', team: 'BLG', role: 'adc', region: 'LPL' },
    { riot_id: 'on_blg', name: 'ON', team: 'BLG', role: 'support', region: 'LPL' },

    // G2
    { riot_id: 'brokenblade_g2', name: 'BrokenBlade', team: 'G2', role: 'top', region: 'LEC' },
    { riot_id: 'yike_g2', name: 'Yike', team: 'G2', role: 'jungle', region: 'LEC' },
    { riot_id: 'caps_g2', name: 'Caps', team: 'G2', role: 'mid', region: 'LEC' },
    { riot_id: 'hans_g2', name: 'Hans Sama', team: 'G2', role: 'adc', region: 'LEC' },
    { riot_id: 'mikyx_g2', name: 'Mikyx', team: 'G2', role: 'support', region: 'LEC' },

    // HLE
    { riot_id: 'zeus_hle', name: 'Zeus', team: 'HLE', role: 'top', region: 'LCK' },
    { riot_id: 'peanut_hle', name: 'Peanut', team: 'HLE', role: 'jungle', region: 'LCK' },
    { riot_id: 'zeka_hle', name: 'Zeka', team: 'HLE', role: 'mid', region: 'LCK' },
    { riot_id: 'viper_hle', name: 'Viper', team: 'HLE', role: 'adc', region: 'LCK' },
    { riot_id: 'delight_hle', name: 'Delight', team: 'HLE', role: 'adc', region: 'LCK' },

    // KT
    { riot_id: 'perfect_kt', name: 'Perfect', team: 'KT', role: 'top', region: 'LCK' },
    { riot_id: 'cuzz_kt', name: 'Cuzz', team: 'KT', role: 'jungle', region: 'LCK' },
    { riot_id: 'bdd_kt', name: 'Bdd', team: 'KT', role: 'mid', region: 'LCK' },
    { riot_id: 'deokdam_kt', name: 'Deokdam', team: 'KT', role: 'adc', region: 'LCK' },
    { riot_id: 'peter_kt', name: 'Peter', team: 'KT', role: 'support', region: 'LCK' },

    // AL
    { riot_id: 'flandre_al', name: 'Flandre', team: 'AL', role: 'top', region: 'LPL' },
    { riot_id: 'tarzan_al', name: 'Tarzan', team: 'AL', role: 'jungle', region: 'LPL' },
    { riot_id: 'shanks_al', name: 'Shanks', team: 'AL', role: 'mid', region: 'LPL' },
    { riot_id: 'hope_al', name: 'Hope', team: 'AL', role: 'adc', region: 'LPL' },
    { riot_id: 'kael_al', name: 'Kael', team: 'AL', role: 'support', region: 'LPL' },

    // TES
    { riot_id: '369_tes', name: '369', team: 'TES', role: 'top', region: 'LPL' },
    { riot_id: 'kanavi_tes', name: 'Kanavi', team: 'TES', role: 'jungle', region: 'LPL' },
    { riot_id: 'creme_tes', name: 'Creme', team: 'TES', role: 'mid', region: 'LPL' },
    { riot_id: 'jackeylove_tes', name: 'JackeyLove', team: 'TES', role: 'adc', region: 'LPL' },
    { riot_id: 'fengyue_tes', name: 'FengYue', team: 'TES', role: 'support', region: 'LPL' },

    // FLY
    { riot_id: 'gakgos_fly', name: 'Gakgos', team: 'FLY', role: 'top', region: 'LCS' },
    { riot_id: 'inspired_fly', name: 'Inspired', team: 'FLY', role: 'jungle', region: 'LCS' },
    { riot_id: 'quad_fly', name: 'Quad', team: 'FLY', role: 'mid', region: 'LCS' },
    { riot_id: 'massu_fly', name: 'Massu', team: 'FLY', role: 'adc', region: 'LCS' },
    { riot_id: 'busio_fly', name: 'Busio', team: 'FLY', role: 'support', region: 'LCS' },

    // VKS
    { riot_id: 'boal_vks', name: 'Boal', team: 'VKS', role: 'top', region: 'LEC' },
    { riot_id: 'disamis_vks', name: 'Disamis', team: 'VKS', role: 'jungle', region: 'LEC' },
    { riot_id: 'mireu_vks', name: 'Mireu', team: 'VKS', role: 'mid', region: 'LEC' },
    { riot_id: 'morttheus_vks', name: 'Morttheus', team: 'VKS', role: 'adc', region: 'LEC' },
    { riot_id: 'trymbi_vks', name: 'Trymbi', team: 'VKS', role: 'support', region: 'LEC' },

    // 100T
    { riot_id: 'dhokla_100t', name: 'Dhokla', team: '100T', role: 'top', region: 'LCS' },
    { riot_id: 'river_100t', name: 'River', team: '100T', role: 'jungle', region: 'LCS' },
    { riot_id: 'quid_100t', name: 'Quid', team: '100T', role: 'mid', region: 'LCS' },
    { riot_id: 'fbi_100t', name: 'FBI', team: '100T', role: 'adc', region: 'LCS' },
    { riot_id: 'eyla_100t', name: 'Eyla', team: '100T', role: 'support', region: 'LCS' },

    // G2
    { riot_id: 'brokenblade_g2', name: 'BrokenBlade', team: 'G2', role: 'top', region: 'LEC' },
    { riot_id: 'yike_g2', name: 'Yike', team: 'G2', role: 'jungle', region: 'LEC' },
    { riot_id: 'caps_g2', name: 'Caps', team: 'G2', role: 'mid', region: 'LEC' },
    { riot_id: 'hans_g2', name: 'Hans Sama', team: 'G2', role: 'adc', region: 'LEC' },
    { riot_id: 'labrox_g2', name: 'Labrov', team: 'G2', role: 'support', region: 'LEC' },

    // MKOI
    { riot_id: 'myrwn_mkoi', name: 'Myrwn', team: 'MKOI', role: 'top', region: 'LEC' },
    { riot_id: 'elyoya_mkoi', name: 'Elyoya', team: 'MKOI', role: 'jungle', region: 'LEC' },
    { riot_id: 'jojopyun_mkoi', name: 'Jojopyun', team: 'MKOI', role: 'mid', region: 'LEC' },
    { riot_id: 'supa_mkoi', name: 'Supa', team: 'MKOI', role: 'adc', region: 'LEC' },
    { riot_id: 'alvaro_mkoi', name: 'Alvaro', team: 'MKOI', role: 'support', region: 'LEC' },

    // FNC
    { riot_id: 'oscarinin_fnc', name: 'Oscarinin', team: 'FNC', role: 'top', region: 'LEC' },
    { riot_id: 'razork_fnc', name: 'Razork', team: 'FNC', role: 'jungle', region: 'LEC' },
    { riot_id: 'poby_fnc', name: 'Poby', team: 'FNC', role: 'mid', region: 'LEC' },
    { riot_id: 'upset_fnc', name: 'Upset', team: 'FNC', role: 'adc', region: 'LEC' },
    { riot_id: 'mikyx_fnc', name: 'Mikyx', team: 'FNC', role: 'support', region: 'LEC' },

    // CFO
    { riot_id: 'driver_cfo', name: 'Driver', team: 'CFO', role: 'top', region: 'LCS' },
    { riot_id: 'junjia_cfo', name: 'JunJia', team: 'CFO', role: 'jungle', region: 'LCS' },
    { riot_id: 'hongq_cfo', name: 'HongQ', team: 'CFO', role: 'mid', region: 'LCS' },
    { riot_id: 'doggo_cfo', name: 'Doggo', team: 'CFO', role: 'adc', region: 'LCS' },
    { riot_id: 'kaiwing_cfo', name: 'Kaiwing', team: 'CFO', role: 'support', region: 'LCS' },

    // TSW
    { riot_id: 'hiro02_tsw', name: 'Hiro02', team: 'TSW', role: 'top', region: 'LPL' },
    { riot_id: 'hizto_tsw', name: 'Hizto', team: 'TSW', role: 'jungle', region: 'LPL' },
    { riot_id: 'dire_tsw', name: 'Dire', team: 'TSW', role: 'mid', region: 'LPL' },
    { riot_id: 'eddie_tsw', name: 'Eddie', team: 'TSW', role: 'adc', region: 'LPL' },
    { riot_id: 'taki_tsw', name: 'Taki', team: 'TSW', role: 'support', region: 'LPL' },

    // PSG
    { riot_id: 'azhi_psg', name: 'Azhi', team: 'PSG', role: 'top', region: 'LFL' },
    { riot_id: 'karsa_psg', name: 'Karsa', team: 'PSG', role: 'jungle', region: 'LPL' },
    { riot_id: 'maple_psg', name: 'Maple', team: 'PSG', role: 'mid', region: 'LPL' },
    { riot_id: 'betty_psg', name: 'Betty', team: 'PSG', role: 'adc', region: 'LPL' },
    { riot_id: 'woody_psg', name: 'Woody', team: 'PSG', role: 'support', region: 'LPL' },

    // IG
    { riot_id: 'theshy_ig', name: 'TheShy', team: 'IG', role: 'top', region: 'LPL' },
    { riot_id: 'wei_ig', name: 'Wei', team: 'IG', role: 'jungle', region: 'LPL' },
    { riot_id: 'rookie_ig', name: 'Rookie', team: 'IG', role: 'mid', region: 'LPL' },
    { riot_id: 'gala_ig', name: 'GALA', team: 'IG', role: 'adc', region: 'LPL' },
    { riot_id: 'meiko_ig', name: 'Meiko', team: 'IG', role: 'support', region: 'LPL' },
];

  let successCount = 0;
  for (const player of manualPlayers) {
    const { error } = await supabase
      .from('players')
      .upsert(player, { 
        onConflict: 'riot_id',
        ignoreDuplicates: false // This will update existing rows
      });
    
    if (!error) successCount++;
  }

  console.log(`✅ Successfully seeded ${successCount} players!`);
}

// Run the seeder
seedPlayersFromAPI();