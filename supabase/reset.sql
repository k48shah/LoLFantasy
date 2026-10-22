-- Wipes every Worlds Fantasy object so schema.sql can be run on a clean slate.
-- Safe to run on an empty database. It does NOT touch Supabase's own auth users.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop view  if exists public.game_points cascade;
drop table if exists public.trades, public.roster_spots, public.draft_queue, public.draft_picks,
                     public.league_members, public.leagues, public.game_stats, public.games,
                     public.matches, public.players, public.teams, public.scoring_rules,
                     public.profiles cascade;
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
             and p.proname in ('calc_points','_uid','_require_member','_user_for_pick','_on_clock','_pick_problem',
               '_autopick_player','_do_pick','_tick','_roster_ok_after_swap','_spot_points','_new_invite_code',
               'my_profile','update_username','players_directory','player_games','schedule','scoring',
               'create_league','league_preview','join_league','leave_league','remove_member','delete_league',
               'update_league','my_leagues','league_overview','draft_state','league_rosters','start_draft',
               'make_pick','set_queue','set_autodraft','league_trades','propose_trade','respond_trade',
               'cancel_trade','process_all_drafts')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;
