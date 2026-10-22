-- =====================================================================
--  Worlds Fantasy  ·  database schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  (Run supabase/reset.sql first if you have old tables lying around.)
--
--  Design rules
--    * Public data (teams, players, games, stats) is readable by anyone.
--    * Everything league-related is reachable ONLY through the functions
--      below. Tables have RLS on with no policies, so the browser can never
--      write a pick, change a roster, or peek into a league it isn't in.
--    * The draft is server-authoritative: turn order, roster rules, the pick
--      clock and auto-pick all live here, under a row lock, so two people can
--      never grab the same player or pick out of turn.
-- =====================================================================

-- ---------- profiles --------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));

-- Creates a profile for every new auth user. Must never fail a sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  tries int := 0;
begin
  base := left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_-]', '', 'g'), 20);
  if char_length(base) < 2 then
    base := 'player' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) and tries < 20 loop
    tries := tries + 1;
    candidate := left(base, 16) || floor(random() * 9000 + 1000)::int;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
exception when others then
  insert into public.profiles (id, username)
  values (new.id, 'player' || substr(replace(new.id::text, '-', ''), 1, 8))
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- esports data (written by the GitHub Action, read by everyone) --

create table public.teams (
  id             text primary key,            -- Riot team id
  slug           text not null unique,
  code           text not null,
  name           text not null,
  image_url      text,
  region         text,
  in_main_event  boolean not null default false,   -- made it past Play-Ins
  updated_at     timestamptz not null default now()
);

create table public.players (
  id           text primary key,              -- Riot player id
  handle       text not null,
  full_name    text,
  role         text not null check (role in ('top', 'jungle', 'mid', 'adc', 'support')),
  team_id      text references public.teams (id) on delete set null,
  image_url    text,
  active       boolean not null default false, -- draftable (on a main-event team's Worlds roster)
  seed_rating  numeric not null default 20,    -- pre-tournament guess, used by auto-pick only
  updated_at   timestamptz not null default now()
);
create index players_team_idx on public.players (team_id);

create table public.matches (
  id           text primary key,
  stage        text not null,                 -- play_ins | swiss | knockouts
  block_name   text,
  start_time   timestamptz,
  state        text not null default 'unstarted',
  best_of      int,
  team1_id     text references public.teams (id) on delete set null,
  team2_id     text references public.teams (id) on delete set null,
  team1_code   text,
  team2_code   text,
  team1_wins   int not null default 0,
  team2_wins   int not null default 0,
  ingested     boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table public.games (
  id               text primary key,
  match_id         text references public.matches (id) on delete cascade,
  stage            text not null,
  game_number      int,
  started_at       timestamptz not null,
  duration_seconds int,
  blue_team_id     text references public.teams (id) on delete set null,
  red_team_id      text references public.teams (id) on delete set null,
  winner_team_id   text references public.teams (id) on delete set null,
  patch            text
);
create index games_started_idx on public.games (started_at);

create table public.game_stats (
  game_id    text not null references public.games (id) on delete cascade,
  player_id  text not null references public.players (id) on delete cascade,
  team_id    text references public.teams (id) on delete set null,
  champion   text,
  kills      int not null default 0,
  deaths     int not null default 0,
  assists    int not null default 0,
  cs         int not null default 0,
  gold       int not null default 0,
  won        boolean not null default false,
  primary key (game_id, player_id)
);
create index game_stats_player_idx on public.game_stats (player_id);

-- One row. The rules page and the points maths both read from here.
create table public.scoring_rules (
  id                 int primary key default 1 check (id = 1),
  kill               numeric not null default 3,
  assist             numeric not null default 2,
  death              numeric not null default -1,
  cs                 numeric not null default 0.02,
  win                numeric not null default 2,
  ka_bonus_threshold int     not null default 10,
  ka_bonus           numeric not null default 2
);
insert into public.scoring_rules default values;

create function public.calc_points(k int, d int, a int, creep int, won boolean) returns numeric
language sql stable set search_path = public as $$
  select round(
      k * r.kill + a * r.assist + d * r.death + creep * r.cs
    + case when won then r.win else 0 end
    + case when k + a >= r.ka_bonus_threshold then r.ka_bonus else 0 end, 2)
  from public.scoring_rules r
$$;

create view public.game_points as
  select gs.game_id, gs.player_id, gs.team_id, gs.champion, gs.kills, gs.deaths, gs.assists, gs.cs, gs.won,
         g.started_at, g.stage, g.match_id,
         public.calc_points(gs.kills, gs.deaths, gs.assists, gs.cs, gs.won) as points
  from public.game_stats gs
  join public.games g on g.id = gs.game_id;

-- ---------- leagues ---------------------------------------------------

create table public.leagues (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 40),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  invite_code      text not null unique,
  status           text not null default 'lobby' check (status in ('lobby', 'drafting', 'active')),
  max_members      int  not null default 8  check (max_members between 2 and 12),
  roster_size      int  not null default 7  check (roster_size between 5 and 10),
  pick_minutes     int  not null default 480 check (pick_minutes between 1 and 2880),
  count_play_ins   boolean not null default false,
  draft_mode       text not null default 'live' check (draft_mode in ('live', 'sealed')),
  current_pick     int  not null default 0,
  pick_deadline    timestamptz,
  notified_pick    int  not null default 0,
  draft_started_at   timestamptz,
  draft_completed_at timestamptz,
  created_at       timestamptz not null default now()
);

create table public.league_members (
  league_id       uuid not null references public.leagues (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  draft_position  int,
  auto_draft      boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (league_id, user_id),
  unique (league_id, draft_position)
);
create index league_members_user_idx on public.league_members (user_id);

create table public.draft_picks (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  pick_no    int  not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  player_id  text not null references public.players (id),
  auto       boolean not null default false,
  picked_at  timestamptz not null default now(),
  primary key (league_id, pick_no),
  unique (league_id, player_id)               -- a player can only be drafted once per league
);

create table public.draft_queue (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  player_id  text not null references public.players (id) on delete cascade,
  position   int  not null,
  primary key (league_id, user_id, player_id)
);

-- Who owned whom, and when. Points only count for games that START while a
-- player is on your roster, so trades can't be used to farm past scores.
create table public.roster_spots (
  id           bigint generated always as identity primary key,
  league_id    uuid not null references public.leagues (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  player_id    text not null references public.players (id),
  acquired_at  timestamptz not null,           -- -infinity for draft picks (full tournament)
  released_at  timestamptz,
  source       text not null check (source in ('draft', 'trade'))
);
create unique index roster_spots_one_owner on public.roster_spots (league_id, player_id) where released_at is null;
create index roster_spots_user_idx on public.roster_spots (league_id, user_id);

create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues (id) on delete cascade,
  proposer_id   uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  give_player   text not null references public.players (id),   -- proposer gives this
  get_player    text not null references public.players (id),   -- proposer receives this
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'void')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index trades_league_idx on public.trades (league_id, status);

-- ---------- row level security ---------------------------------------
-- Public esports data: readable by anyone, writable only by the service role.
alter table public.teams         enable row level security;
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.games         enable row level security;
alter table public.game_stats    enable row level security;
alter table public.scoring_rules enable row level security;
create policy "public read" on public.teams         for select using (true);
create policy "public read" on public.players       for select using (true);
create policy "public read" on public.matches       for select using (true);
create policy "public read" on public.games         for select using (true);
create policy "public read" on public.game_stats    for select using (true);
create policy "public read" on public.scoring_rules for select using (true);

-- League data: RLS on, no policies → closed. Access is via the functions below.
alter table public.profiles       enable row level security;
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.draft_picks    enable row level security;
alter table public.draft_queue    enable row level security;
alter table public.roster_spots   enable row level security;
alter table public.trades         enable row level security;

-- =====================================================================
--  Internal helpers (not callable from the browser)
-- =====================================================================

create function public._uid() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Please sign in first.'; end if;
  return u;
end $$;

create function public._require_member(p_league uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid := public._uid();
begin
  if not exists (select 1 from public.league_members where league_id = p_league and user_id = u) then
    raise exception 'You are not in that league.';
  end if;
  return u;
end $$;

-- Which user is on the clock for a given overall pick number (snake order).
create function public._user_for_pick(p_league uuid, p_pick int) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare n int; r int; i int; u uuid;
begin
  select count(*) into n from public.league_members where league_id = p_league;
  if n = 0 or p_pick < 1 then return null; end if;
  r := (p_pick - 1) / n;
  i := (p_pick - 1) % n;
  if r % 2 = 1 then i := n - 1 - i; end if;
  select user_id into u from public.league_members where league_id = p_league and draft_position = i + 1;
  return u;
end $$;

create function public._on_clock(l public.leagues) returns uuid
language sql stable security definer set search_path = public as $$
  select case when l.status = 'drafting' and l.draft_mode = 'live' then public._user_for_pick(l.id, l.current_pick) end
$$;

-- Why can't this user draft this player right now?  NULL means "they can".
create function public._pick_problem(p_league uuid, p_user uuid, p_player text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  l public.leagues;
  prole text;
  owned_roles text[];
  owned_n int;
  roles_after text[];
  missing int;
  remaining int;
  rr text;
  need int;
  avail int;
begin
  select * into l from public.leagues where id = p_league;
  select role into prole from public.players where id = p_player and active;
  if prole is null then return 'That player is not in the draft pool.'; end if;
  if exists (select 1 from public.draft_picks where league_id = p_league and player_id = p_player) then
    return 'That player has already been drafted.';
  end if;

  select coalesce(array_agg(p.role), '{}'), count(*) into owned_roles, owned_n
  from public.draft_picks dp join public.players p on p.id = dp.player_id
  where dp.league_id = p_league and dp.user_id = p_user;

  if owned_n >= l.roster_size then return 'Your roster is already full.'; end if;

  -- You must always be able to finish with one player at every role.
  roles_after := owned_roles || prole;
  select 5 - count(distinct r) into missing from unnest(roles_after) r;
  remaining := l.roster_size - owned_n - 1;
  if missing > remaining then
    return 'You still need a player at every role (' ||
      (select string_agg(x, ', ') from unnest(array['top','jungle','mid','adc','support']) x where x <> all (roles_after)) ||
      ') — you can''t take another ' || prole || ' right now.';
  end if;

  -- ...and nobody may hog a role so hard that others can't fill it.
  foreach rr in array array['top', 'jungle', 'mid', 'adc', 'support'] loop
    select count(*) into need
    from public.league_members m
    where m.league_id = p_league
      and not (m.user_id = p_user and rr = prole)
      and not exists (
        select 1 from public.draft_picks dp join public.players p on p.id = dp.player_id
        where dp.league_id = p_league and dp.user_id = m.user_id and p.role = rr);
    select count(*) into avail
    from public.players p
    where p.active and p.role = rr
      and not exists (select 1 from public.draft_picks dp where dp.league_id = p_league and dp.player_id = p.id)
      and p.id <> p_player;
    if avail < need then
      return 'Taking that player would leave another manager unable to fill their ' || rr || ' slot.';
    end if;
  end loop;

  return null;
end $$;

create function public._autopick_player(p_league uuid, p_user uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare pid text;
begin
  -- 1) your own queue, in order
  for pid in
    select q.player_id from public.draft_queue q
    where q.league_id = p_league and q.user_id = p_user
    order by q.position
  loop
    if public._pick_problem(p_league, p_user, pid) is null then return pid; end if;
  end loop;

  -- 2) best available: tournament points per game, blended with a pre-tournament seed
  for pid in
    select p.id
    from public.players p
    left join lateral (
      select count(*) as games, coalesce(sum(gp.points), 0) as pts
      from public.game_points gp where gp.player_id = p.id
    ) s on true
    where p.active
      and not exists (select 1 from public.draft_picks dp where dp.league_id = p_league and dp.player_id = p.id)
    order by (s.pts + p.seed_rating * 3) / (s.games + 3) desc, p.handle
  loop
    if public._pick_problem(p_league, p_user, pid) is null then return pid; end if;
  end loop;
  return null;
end $$;

-- Records a pick and moves the clock. Caller must hold the league row lock.
create function public._do_pick(l public.leagues, p_user uuid, p_player text, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare total int;
begin
  select count(*) * l.roster_size into total from public.league_members where league_id = l.id;

  insert into public.draft_picks (league_id, pick_no, user_id, player_id, auto)
  values (l.id, l.current_pick, p_user, p_player, p_auto);
  insert into public.roster_spots (league_id, user_id, player_id, acquired_at, source)
  values (l.id, p_user, p_player, '-infinity', 'draft');
  delete from public.draft_queue where league_id = l.id and player_id = p_player;

  if l.current_pick >= total then
    update public.leagues
       set status = 'active', pick_deadline = null, draft_completed_at = now()
     where id = l.id;
  else
    update public.leagues
       set current_pick = current_pick + 1,
           -- sealed drafts keep their one (already passed) deadline so the rest resolve instantly
           pick_deadline = case when l.draft_mode = 'sealed' then l.pick_deadline
                                else now() + make_interval(mins => l.pick_minutes) end
     where id = l.id;
  end if;
end $$;

-- Advances the draft: makes picks for anyone whose clock ran out or who is on
-- auto-draft. Safe to call any time, from anywhere, as often as you like.
create function public._tick(p_league uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  l public.leagues;
  uid uuid;
  auto boolean;
  pid text;
  made int := 0;
begin
  select * into l from public.leagues where id = p_league for update;
  if not found then return 0; end if;

  while l.status = 'drafting' and made < 500 loop
    uid := public._user_for_pick(l.id, l.current_pick);
    if l.draft_mode = 'sealed' then
      -- runs once the rankings deadline passes, or as soon as every manager has locked in
      exit when l.pick_deadline > now()
        and exists (select 1 from public.league_members m where m.league_id = l.id and not m.auto_draft);
    else
      select m.auto_draft into auto from public.league_members m where m.league_id = l.id and m.user_id = uid;
      exit when not (coalesce(auto, false) or l.pick_deadline <= now());
    end if;

    pid := public._autopick_player(l.id, uid);
    exit when pid is null;                        -- nothing legal (shouldn't happen)
    perform public._do_pick(l, uid, pid, true);
    made := made + 1;
    select * into l from public.leagues where id = p_league;
  end loop;
  return made;
end $$;

-- Does a roster still have all five roles after swapping one player out/in?
create function public._roster_ok_after_swap(p_league uuid, p_user uuid, p_out text, p_in text) returns boolean
language sql stable security definer set search_path = public as $$
  select count(distinct r) = 5 from (
    select p.role as r
    from public.roster_spots rs join public.players p on p.id = rs.player_id
    where rs.league_id = p_league and rs.user_id = p_user and rs.released_at is null and rs.player_id <> p_out
    union all
    select role from public.players where id = p_in
  ) x
$$;

-- Points each roster spot has earned for its owner.
create function public._spot_points(p_league uuid)
returns table (spot_id bigint, user_id uuid, player_id text, acquired_at timestamptz, released_at timestamptz, points numeric, games int)
language sql stable security definer set search_path = public as $$
  select rs.id, rs.user_id, rs.player_id, rs.acquired_at, rs.released_at,
         coalesce(sum(gp.points), 0), count(gp.game_id)::int
  from public.roster_spots rs
  join public.leagues l on l.id = rs.league_id
  left join public.game_points gp
    on gp.player_id = rs.player_id
   and gp.started_at >= rs.acquired_at
   and (rs.released_at is null or gp.started_at < rs.released_at)
   and (l.count_play_ins or gp.stage <> 'play_ins')
  where rs.league_id = p_league
  group by rs.id, l.id
$$;

create function public._new_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end $$;

-- =====================================================================
--  Public API (called from the browser)
-- =====================================================================

-- ---------- profile ---------------------------------------------------

create function public.my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'username', p.username)
  from public.profiles p where p.id = public._uid()
$$;

create function public.update_username(p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); n text := trim(p_username);
begin
  if n !~ '^[A-Za-z0-9_-]{2,20}$' then
    raise exception 'Username must be 2–20 letters, numbers, _ or -.';
  end if;
  begin
    update public.profiles set username = n where id = u;
  exception when unique_violation then
    raise exception 'That username is taken.';
  end;
end $$;

-- ---------- esports data ---------------------------------------------

create function public.players_directory() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x ->> 'seed')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'handle', p.handle, 'full_name', p.full_name, 'role', p.role,
      'image_url', p.image_url, 'active', p.active, 'seed', p.seed_rating,
      'team', case when t.id is null then null else jsonb_build_object(
        'id', t.id, 'code', t.code, 'name', t.name, 'image_url', t.image_url, 'region', t.region) end,
      'all',  jsonb_build_object('games', coalesce(s.games, 0),  'points', coalesce(s.pts, 0),
                                 'kills', coalesce(s.k, 0), 'deaths', coalesce(s.d, 0), 'assists', coalesce(s.a, 0), 'cs', coalesce(s.cs, 0)),
      'main', jsonb_build_object('games', coalesce(s.mgames, 0), 'points', coalesce(s.mpts, 0),
                                 'kills', coalesce(s.mk, 0), 'deaths', coalesce(s.md, 0), 'assists', coalesce(s.ma, 0), 'cs', coalesce(s.mcs, 0))
    ) as x
    from public.players p
    left join public.teams t on t.id = p.team_id
    left join lateral (
      select count(*) as games, sum(points) as pts, sum(kills) as k, sum(deaths) as d, sum(assists) as a, sum(cs) as cs,
             count(*) filter (where stage <> 'play_ins') as mgames,
             sum(points) filter (where stage <> 'play_ins') as mpts,
             sum(kills) filter (where stage <> 'play_ins') as mk,
             sum(deaths) filter (where stage <> 'play_ins') as md,
             sum(assists) filter (where stage <> 'play_ins') as ma,
             sum(cs) filter (where stage <> 'play_ins') as mcs
      from public.game_points gp where gp.player_id = p.id
    ) s on true
    where p.active or s.games > 0
  ) q
$$;

create function public.player_games(p_player text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'game_id', gp.game_id, 'started_at', gp.started_at, 'stage', gp.stage, 'champion', gp.champion,
    'kills', gp.kills, 'deaths', gp.deaths, 'assists', gp.assists, 'cs', gp.cs, 'won', gp.won, 'points', gp.points,
    'opponent', (select t.code from public.games g join public.teams t
                  on t.id = case when g.blue_team_id = gp.team_id then g.red_team_id else g.blue_team_id end
                 where g.id = gp.game_id)
  ) order by gp.started_at desc), '[]'::jsonb)
  from public.game_points gp where gp.player_id = p_player
$$;

create function public.schedule() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'stage', m.stage, 'block_name', m.block_name, 'start_time', m.start_time, 'state', m.state,
    'best_of', m.best_of, 'team1_wins', m.team1_wins, 'team2_wins', m.team2_wins,
    'team1', jsonb_build_object('id', t1.id, 'code', coalesce(t1.code, m.team1_code, 'TBD'), 'image_url', t1.image_url, 'name', t1.name),
    'team2', jsonb_build_object('id', t2.id, 'code', coalesce(t2.code, m.team2_code, 'TBD'), 'image_url', t2.image_url, 'name', t2.name)
  ) order by m.start_time nulls last, m.id), '[]'::jsonb)
  from public.matches m
  left join public.teams t1 on t1.id = m.team1_id
  left join public.teams t2 on t2.id = m.team2_id
$$;

create function public.scoring() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(r) - 'id' from public.scoring_rules r
$$;

-- ---------- leagues: lobby --------------------------------------------

create function public.create_league(
  p_name text, p_max_members int default 8, p_roster_size int default 7,
  p_pick_minutes int default 480, p_count_play_ins boolean default false,
  p_draft_mode text default 'live'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); lid uuid;
begin
  if char_length(trim(p_name)) < 2 then raise exception 'Give your league a name.'; end if;
  insert into public.leagues (name, owner_id, invite_code, max_members, roster_size, pick_minutes, count_play_ins, draft_mode)
  values (trim(p_name), u, public._new_invite_code(), p_max_members, p_roster_size, p_pick_minutes, p_count_play_ins, p_draft_mode)
  returning id into lid;
  insert into public.league_members (league_id, user_id) values (lid, u);
  return lid;
end $$;

create function public.league_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id, 'name', l.name, 'status', l.status, 'max_members', l.max_members,
    'members', (select count(*) from public.league_members m where m.league_id = l.id),
    'owner', (select username from public.profiles where id = l.owner_id),
    'already_member', exists (select 1 from public.league_members m where m.league_id = l.id and m.user_id = public._uid()))
  from public.leagues l
  where l.invite_code = upper(trim(p_code)) and public._uid() is not null
$$;

create function public.join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); l public.leagues; n int;
begin
  select * into l from public.leagues where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'No league found with that invite code.'; end if;
  if exists (select 1 from public.league_members where league_id = l.id and user_id = u) then return l.id; end if;
  if l.status <> 'lobby' then raise exception 'That league''s draft has already started.'; end if;
  select count(*) into n from public.league_members where league_id = l.id;
  if n >= l.max_members then raise exception 'That league is full.'; end if;
  insert into public.league_members (league_id, user_id) values (l.id, u);
  return l.id;
end $$;

create function public.leave_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.status <> 'lobby' then raise exception 'You can''t leave once the draft has started.'; end if;
  if l.owner_id = u then raise exception 'The owner can''t leave — delete the league instead.'; end if;
  delete from public.league_members where league_id = p_league and user_id = u;
end $$;

create function public.remove_member(p_league uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.owner_id <> u then raise exception 'Only the league owner can do that.'; end if;
  if l.status <> 'lobby' then raise exception 'Members can only be removed before the draft starts.'; end if;
  if p_user = u then raise exception 'You can''t remove yourself.'; end if;
  delete from public.league_members where league_id = p_league and user_id = p_user;
end $$;

create function public.delete_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league);
begin
  if not exists (select 1 from public.leagues where id = p_league and owner_id = u) then
    raise exception 'Only the league owner can do that.';
  end if;
  delete from public.leagues where id = p_league;
end $$;

create function public.update_league(
  p_league uuid, p_name text, p_max_members int, p_roster_size int, p_pick_minutes int, p_count_play_ins boolean,
  p_draft_mode text default 'live'
) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues; n int;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.owner_id <> u then raise exception 'Only the league owner can do that.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Give your league a name.'; end if;
  if l.status = 'lobby' then
    select count(*) into n from public.league_members where league_id = p_league;
    if p_max_members < n then raise exception 'There are already % members in the league.', n; end if;
    update public.leagues
       set name = trim(p_name), max_members = p_max_members, roster_size = p_roster_size,
           pick_minutes = p_pick_minutes, count_play_ins = p_count_play_ins, draft_mode = p_draft_mode
     where id = p_league;
  else
    -- after the draft starts only the name, pick clock and scoring scope may change
    update public.leagues
       set name = trim(p_name), pick_minutes = p_pick_minutes, count_play_ins = p_count_play_ins
     where id = p_league;
  end if;
end $$;

-- ---------- leagues: reading ------------------------------------------

create function public.my_leagues() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'name', l.name, 'status', l.status, 'invite_code', l.invite_code,
    'max_members', l.max_members, 'roster_size', l.roster_size, 'draft_mode', l.draft_mode,
    'members', (select count(*) from public.league_members x where x.league_id = l.id),
    'is_owner', l.owner_id = public._uid(),
    'my_turn', public._on_clock(l) = public._uid(),
    'on_clock', (select username from public.profiles where id = public._on_clock(l)),
    'pick_deadline', l.pick_deadline
  ) order by l.created_at desc), '[]'::jsonb)
  from public.leagues l
  join public.league_members m on m.league_id = l.id and m.user_id = public._uid()
$$;

create function public.league_overview(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public._require_member(p_league); l public.leagues; result jsonb;
begin
  select * into l from public.leagues where id = p_league;
  select jsonb_build_object(
    'league', jsonb_build_object(
      'id', l.id, 'name', l.name, 'status', l.status, 'invite_code', l.invite_code,
      'owner_id', l.owner_id, 'max_members', l.max_members, 'roster_size', l.roster_size,
      'pick_minutes', l.pick_minutes, 'count_play_ins', l.count_play_ins, 'draft_mode', l.draft_mode,
      'current_pick', l.current_pick, 'pick_deadline', l.pick_deadline,
      'on_clock', public._on_clock(l), 'created_at', l.created_at),
    'me', me,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'username', pr.username, 'draft_position', m.draft_position,
        'auto_draft', m.auto_draft, 'is_owner', m.user_id = l.owner_id,
        'points', coalesce(sp.pts, 0), 'players', coalesce(sp.n, 0)
      ) order by coalesce(sp.pts, 0) desc, m.draft_position nulls last, pr.username)
      from public.league_members m
      join public.profiles pr on pr.id = m.user_id
      left join (
        select user_id, sum(points) as pts, count(*) filter (where released_at is null) as n
        from public._spot_points(p_league) group by user_id
      ) sp on sp.user_id = m.user_id
      where m.league_id = p_league), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Draft room data. Also advances the draft if anyone's clock has run out.
create function public.draft_state(p_league uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public._require_member(p_league); l public.leagues; due boolean;
begin
  select * into l from public.leagues where id = p_league;
  if l.status = 'drafting' then
    due := l.pick_deadline <= now() or (l.draft_mode = 'live' and coalesce((
      select m.auto_draft from public.league_members m
      where m.league_id = l.id and m.user_id = public._on_clock(l)), false))
      or (l.draft_mode = 'sealed' and not exists (select 1 from public.league_members m where m.league_id = l.id and not m.auto_draft));
    if due then
      perform public._tick(p_league);
      select * into l from public.leagues where id = p_league;
    end if;
  end if;

  return jsonb_build_object(
    'now', now(),
    'me', me,
    'league', jsonb_build_object(
      'id', l.id, 'name', l.name, 'status', l.status, 'owner_id', l.owner_id,
      'roster_size', l.roster_size, 'pick_minutes', l.pick_minutes, 'draft_mode', l.draft_mode,
      'current_pick', l.current_pick, 'pick_deadline', l.pick_deadline, 'on_clock', public._on_clock(l),
      'total_picks', (select count(*) from public.league_members where league_id = l.id) * l.roster_size),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'username', pr.username, 'draft_position', m.draft_position, 'auto_draft', m.auto_draft
      ) order by m.draft_position nulls last, pr.username)
      from public.league_members m join public.profiles pr on pr.id = m.user_id
      where m.league_id = l.id), '[]'::jsonb),
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pick_no', dp.pick_no, 'user_id', dp.user_id, 'player_id', dp.player_id, 'auto', dp.auto, 'picked_at', dp.picked_at
      ) order by dp.pick_no)
      from public.draft_picks dp where dp.league_id = l.id), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(q.player_id order by q.position)
      from public.draft_queue q where q.league_id = l.id and q.user_id = me), '[]'::jsonb)
  );
end $$;

create function public.league_rosters(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public._require_member(p_league);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'spot_id', sp.spot_id, 'user_id', sp.user_id, 'player_id', sp.player_id,
      'acquired_at', case when sp.acquired_at = '-infinity' then null else sp.acquired_at end,
      'released_at', sp.released_at, 'points', sp.points, 'games', sp.games
    ) order by sp.user_id, sp.acquired_at, sp.spot_id)
    from public._spot_points(p_league) sp), '[]'::jsonb);
end $$;

-- ---------- draft actions ---------------------------------------------

create function public.start_draft(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues; n int; r text; pool int;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.owner_id <> u then raise exception 'Only the league owner can start the draft.'; end if;
  if l.status <> 'lobby' then raise exception 'The draft has already started.'; end if;
  select count(*) into n from public.league_members where league_id = p_league;
  if n < 2 then raise exception 'You need at least 2 managers to draft.'; end if;

  select count(*) into pool from public.players where active;
  if pool < n * l.roster_size then
    raise exception 'Only % players are in the pool but % are needed (% managers × % roster spots).',
      pool, n * l.roster_size, n, l.roster_size;
  end if;
  foreach r in array array['top', 'jungle', 'mid', 'adc', 'support'] loop
    if (select count(*) from public.players where active and role = r) < n then
      raise exception 'Not enough % players in the pool for % managers.', r, n;
    end if;
  end loop;

  with shuffled as (
    select user_id, row_number() over (order by random()) as rn
    from public.league_members where league_id = p_league)
  update public.league_members m set draft_position = s.rn
  from shuffled s where m.league_id = p_league and m.user_id = s.user_id;

  update public.leagues
     set status = 'drafting', current_pick = 1, draft_started_at = now(),
         pick_deadline = now() + make_interval(mins => l.pick_minutes)
   where id = p_league;
  perform public._tick(p_league);
end $$;

create function public.make_pick(p_league uuid, p_player text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues; problem text;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.status <> 'drafting' then raise exception 'This league is not drafting right now.'; end if;
  if l.draft_mode = 'sealed' then raise exception 'This is a sealed draft: rank your players and lock in — picks are made automatically at the deadline.'; end if;

  -- settle anything overdue first, so a stale browser tab can't jump the queue
  perform public._tick(p_league);
  select * into l from public.leagues where id = p_league;
  if l.status <> 'drafting' then raise exception 'The draft just finished.'; end if;

  if public._on_clock(l) is distinct from u then
    raise exception 'It''s not your turn to pick.';
  end if;
  problem := public._pick_problem(p_league, u, p_player);
  if problem is not null then raise exception '%', problem; end if;

  perform public._do_pick(l, u, p_player, false);
  perform public._tick(p_league);       -- let any auto-draft managers right behind you go
end $$;

create function public.set_queue(p_league uuid, p_players text[]) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league);
begin
  delete from public.draft_queue where league_id = p_league and user_id = u;
  insert into public.draft_queue (league_id, user_id, player_id, position)
  select p_league, u, x.pid, min(x.ord)
  from unnest(p_players) with ordinality as x(pid, ord)
  join public.players p on p.id = x.pid and p.active
  where not exists (select 1 from public.draft_picks dp where dp.league_id = p_league and dp.player_id = x.pid)
  group by x.pid
  order by min(x.ord)
  limit 80;
end $$;

create function public.set_autodraft(p_league uuid, p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues;
begin
  select * into l from public.leagues where id = p_league for update;
  if p_user <> u and l.owner_id <> u then raise exception 'Only the league owner can change another manager''s auto-draft.'; end if;
  update public.league_members set auto_draft = p_on where league_id = p_league and user_id = p_user;
  perform public._tick(p_league);
end $$;

-- ---------- trades ----------------------------------------------------

create function public.league_trades(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public._require_member(p_league);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'status', t.status, 'created_at', t.created_at, 'resolved_at', t.resolved_at,
      'proposer_id', t.proposer_id, 'recipient_id', t.recipient_id,
      'proposer', (select username from public.profiles where id = t.proposer_id),
      'recipient', (select username from public.profiles where id = t.recipient_id),
      'give_player', t.give_player, 'get_player', t.get_player
    ) order by t.created_at desc)
    from public.trades t where t.league_id = p_league), '[]'::jsonb);
end $$;

create function public.propose_trade(p_league uuid, p_give text, p_get text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := public._require_member(p_league); l public.leagues; other uuid; tid uuid;
begin
  select * into l from public.leagues where id = p_league for update;
  if l.status <> 'active' then raise exception 'Trades open once the draft is finished.'; end if;
  if not exists (select 1 from public.roster_spots where league_id = p_league and user_id = u and player_id = p_give and released_at is null) then
    raise exception 'You don''t own the player you''re offering.';
  end if;
  select user_id into other from public.roster_spots
   where league_id = p_league and player_id = p_get and released_at is null;
  if other is null then raise exception 'That player is not on anyone''s roster.'; end if;
  if other = u then raise exception 'You can''t trade with yourself.'; end if;
  if exists (select 1 from public.trades where league_id = p_league and status = 'pending'
              and proposer_id = u and give_player = p_give and get_player = p_get) then
    raise exception 'You already have that exact offer pending.';
  end if;
  if not public._roster_ok_after_swap(p_league, u, p_give, p_get)
     or not public._roster_ok_after_swap(p_league, other, p_get, p_give) then
    raise exception 'That trade would leave one of the rosters without a player at every role.';
  end if;
  insert into public.trades (league_id, proposer_id, recipient_id, give_player, get_player)
  values (p_league, u, other, p_give, p_get) returning id into tid;
  return tid;
end $$;

create function public.respond_trade(p_trade uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare
  u uuid := public._uid();
  t public.trades;
  l public.leagues;
begin
  select * into t from public.trades where id = p_trade;
  if not found then raise exception 'Trade not found.'; end if;
  perform public._require_member(t.league_id);
  select * into l from public.leagues where id = t.league_id for update;
  select * into t from public.trades where id = p_trade for update;

  if t.status <> 'pending' then raise exception 'That trade is no longer pending.'; end if;
  if t.recipient_id <> u then raise exception 'Only the manager receiving the offer can respond.'; end if;

  if not p_accept then
    update public.trades set status = 'rejected', resolved_at = now() where id = t.id;
    return 'rejected';
  end if;

  -- both sides must still own what the offer says
  if not exists (select 1 from public.roster_spots where league_id = t.league_id and user_id = t.proposer_id and player_id = t.give_player and released_at is null)
     or not exists (select 1 from public.roster_spots where league_id = t.league_id and user_id = t.recipient_id and player_id = t.get_player and released_at is null) then
    update public.trades set status = 'void', resolved_at = now() where id = t.id;
    return 'void';
  end if;
  if not public._roster_ok_after_swap(t.league_id, t.proposer_id, t.give_player, t.get_player)
     or not public._roster_ok_after_swap(t.league_id, t.recipient_id, t.get_player, t.give_player) then
    raise exception 'That trade would leave one of the rosters without a player at every role.';
  end if;

  update public.roster_spots set released_at = now()
   where league_id = t.league_id and released_at is null and player_id in (t.give_player, t.get_player);
  insert into public.roster_spots (league_id, user_id, player_id, acquired_at, source) values
    (t.league_id, t.proposer_id,  t.get_player,  now(), 'trade'),
    (t.league_id, t.recipient_id, t.give_player, now(), 'trade');
  update public.trades set status = 'accepted', resolved_at = now() where id = t.id;
  update public.trades set status = 'void', resolved_at = now()
   where league_id = t.league_id and status = 'pending' and id <> t.id
     and (give_player in (t.give_player, t.get_player) or get_player in (t.give_player, t.get_player));
  return 'accepted';
end $$;

create function public.cancel_trade(p_trade uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := public._uid(); n int;
begin
  update public.trades set status = 'cancelled', resolved_at = now()
   where id = p_trade and proposer_id = u and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nothing to cancel.'; end if;
end $$;

-- ---------- called by the GitHub Action (service role only) -----------

-- Advances every overdue draft and returns who is newly on the clock, once,
-- so the Action can ping Discord exactly one time per pick.
create function public.process_all_drafts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare lid uuid; out jsonb := '[]'::jsonb; l public.leagues; uid uuid;
begin
  for lid in select id from public.leagues where status = 'drafting' loop
    perform public._tick(lid);
  end loop;
  for l in select * from public.leagues where status = 'drafting' and draft_mode = 'live' and notified_pick < current_pick loop
    uid := public._on_clock(l);
    out := out || jsonb_build_object(
      'league_id', l.id, 'league', l.name, 'pick_no', l.current_pick,
      'username', (select username from public.profiles where id = uid),
      'deadline', l.pick_deadline);
    update public.leagues set notified_pick = l.current_pick where id = l.id;
  end loop;
  return out;
end $$;

-- ---------- permissions -----------------------------------------------

revoke all on all tables    in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.teams, public.players, public.matches, public.games, public.game_stats,
                public.scoring_rules, public.game_points to anon, authenticated;

-- anyone (even signed out) may browse the esports data
grant execute on function public.players_directory(), public.player_games(text),
                          public.schedule(), public.scoring() to anon, authenticated;

-- signed-in users run the league game through these
grant execute on function
  public.my_profile(), public.update_username(text),
  public.create_league(text, int, int, int, boolean, text), public.league_preview(text),
  public.join_league(text), public.leave_league(uuid), public.remove_member(uuid, uuid),
  public.delete_league(uuid), public.update_league(uuid, text, int, int, int, boolean, text),
  public.my_leagues(), public.league_overview(uuid), public.draft_state(uuid),
  public.league_rosters(uuid), public.start_draft(uuid), public.make_pick(uuid, text),
  public.set_queue(uuid, text[]), public.set_autodraft(uuid, uuid, boolean),
  public.league_trades(uuid), public.propose_trade(uuid, text, text),
  public.respond_trade(uuid, boolean), public.cancel_trade(uuid)
to authenticated;

grant execute on function public.process_all_drafts() to service_role;
