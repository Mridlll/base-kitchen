-- Base Kitchen: live session schema.
-- Tables, row level security, realtime publication and helper RPCs.
-- Players and hosts both sign in anonymously; hosting additionally needs the
-- facilitator passcode, set once from the SQL editor with set_host_passcode().

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.rooms (
  code         text primary key check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),  -- no 0/O/1/I
  host_id      uuid not null default auth.uid(),
  status       text not null default 'lobby' check (status in ('lobby','live','closed')),
  max_screen   int  not null default 9,          -- host pacing: players can't go past this screen index
  reveal       jsonb not null default '{}',      -- host-controlled reveals, e.g. {"forecast":true}
  created_at   timestamptz default now()
);

create table public.players (
  id           uuid primary key default auth.uid(),
  room_code    text not null references public.rooms(code) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  screen       int  not null default 0,
  waiting      boolean not null default false,   -- held at the pacing gate for screen + 1
  total        numeric not null default 0,
  joined_at    timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.scores (
  player_id    uuid references public.players(id) on delete cascade,
  room_code    text not null references public.rooms(code) on delete cascade,
  section      text not null check (section in ('act1','act2','forecast','act3','pubbias','act4','darkpat','act5')),
  points       numeric not null,
  primary key (player_id, section)
);

create table public.events (
  id           bigserial primary key,
  client_id    uuid unique,                      -- set by the client so offline retries never duplicate
  room_code    text not null references public.rooms(code) on delete cascade,
  player_id    uuid not null default auth.uid(),
  section      text not null,
  kind         text not null,
  payload      jsonb not null,
  created_at   timestamptz default now()
);
create index on public.events (room_code, section, kind);
create index on public.players (room_code);
create index on public.scores (room_code);

-- ---------------------------------------------------------------- helpers

-- True when the caller hosts this room. Security definer so policies on other
-- tables can use it without tripping over rooms' own policies.
create or replace function public.is_room_host(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms r where r.code = p_code and r.host_id = auth.uid());
$$;

-- True when the caller is a player in this room.
create or replace function public.in_room(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players p where p.id = auth.uid() and p.room_code = p_code);
$$;

-- True when the room exists and is still open.
create or replace function public.room_open(p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms r where r.code = p_code and r.status <> 'closed');
$$;

-- ---------------------------------------------------------------- RLS

alter table public.rooms   enable row level security;
alter table public.players enable row level security;
alter table public.scores  enable row level security;
alter table public.events  enable row level security;

-- rooms: anyone signed in can look a room up by code; only its host can change it.
-- There is no insert policy: rooms are created through create_room(), which checks the passcode.
create policy rooms_select on public.rooms for select to authenticated using (true);
create policy rooms_update on public.rooms for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy rooms_delete on public.rooms for delete to authenticated
  using (host_id = (select auth.uid()));

-- players: write only your own row, and only into an open room. Read your own row,
-- or every row in a room you host. Other players see names and totals through room_board().
create policy players_insert on public.players for insert to authenticated
  with check (id = (select auth.uid()) and public.room_open(room_code));
create policy players_update on public.players for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and public.room_open(room_code));
create policy players_select on public.players for select to authenticated
  using (id = (select auth.uid()) or public.is_room_host(room_code));

-- scores: write only your own rows, in the room you're in. The room's host reads them all.
create policy scores_insert on public.scores for insert to authenticated
  with check (player_id = (select auth.uid()) and public.in_room(room_code));
create policy scores_update on public.scores for update to authenticated
  using (player_id = (select auth.uid())) with check (player_id = (select auth.uid()) and public.in_room(room_code));
create policy scores_select on public.scores for select to authenticated
  using (player_id = (select auth.uid()) or public.is_room_host(room_code));

-- events: insert only as yourself, into the room you're in. Only the host reads them.
create policy events_insert on public.events for insert to authenticated
  with check (player_id = (select auth.uid()) and public.in_room(room_code));
create policy events_select on public.events for select to authenticated
  using (public.is_room_host(room_code));

-- ---------------------------------------------------------------- RPCs

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.host_secret (
  id    int primary key default 1 check (id = 1),
  hash  text not null
);

-- Run once from the SQL editor: select set_host_passcode('...');
-- Not callable from the browser.
create or replace function public.set_host_passcode(p_passcode text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(p_passcode) < 8 then
    raise exception 'Use a passcode of at least 8 characters';
  end if;
  insert into private.host_secret (id, hash) values (1, extensions.crypt(p_passcode, extensions.gen_salt('bf')))
  on conflict (id) do update set hash = excluded.hash;
end $$;
revoke execute on function public.set_host_passcode(text) from public, anon, authenticated;

-- Facilitators create a room with the shared passcode. Returns the new 4-character code.
create or replace function public.create_room(p_passcode text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select hash into v_hash from private.host_secret where id = 1;
  if v_hash is null then raise exception 'No host passcode has been set yet'; end if;
  if extensions.crypt(coalesce(p_passcode, ''), v_hash) <> v_hash then
    perform pg_sleep(1);  -- slow down guessing
    raise exception 'Wrong passcode' using errcode = '28P01';
  end if;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, host_id, status) values (v_code, auth.uid(), 'lobby');
  return v_code;
end $$;
revoke execute on function public.create_room(text) from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- Checks a passcode without creating anything, so the host screen can unlock
-- the "reopen a room" list.
create or replace function public.check_host_passcode(p_passcode text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  select hash into v_hash from private.host_secret where id = 1;
  if v_hash is null or extensions.crypt(coalesce(p_passcode, ''), v_hash) <> v_hash then
    perform pg_sleep(1);
    return false;
  end if;
  return true;
end $$;
revoke execute on function public.check_host_passcode(text) from public, anon;
grant execute on function public.check_host_passcode(text) to authenticated;

-- The room's leaderboard as other players may see it: names, totals and screens only.
create or replace function public.room_board(p_code text)
returns table (display_name text, total numeric, screen int)
language sql stable security definer set search_path = '' as $$
  select p.display_name, p.total, p.screen
  from public.players p
  where p.room_code = p_code
    and (public.in_room(p_code) or public.is_room_host(p_code))
  order by p.total desc, p.joined_at
  limit 50;
$$;
revoke execute on function public.room_board(text) from public, anon;
grant execute on function public.room_board(text) to authenticated;

revoke execute on function public.is_room_host(text) from public, anon;
revoke execute on function public.in_room(text) from public, anon;
revoke execute on function public.room_open(text) from public, anon;
grant execute on function public.is_room_host(text) to authenticated;
grant execute on function public.in_room(text) to authenticated;
grant execute on function public.room_open(text) to authenticated;

-- ---------------------------------------------------------------- tidy views for analysis
-- security_invoker, so they only ever show what the caller's RLS allows (hosts: their rooms).

create view public.forecast_tidy with (security_invoker = true) as
select e.room_code, e.player_id, e.created_at,
       e.payload->>'item'             as item,
       (e.payload->>'guess')::numeric as guess,
       (e.payload->>'truth')::numeric as truth
from public.events e
where e.kind = 'forecast';

create view public.pilot_tidy with (security_invoker = true) as
select e.room_code, e.player_id, e.created_at,
       e.payload->>'outcome'             as outcome,
       e.payload->>'design'              as design,
       e.payload->>'prereg'              as prereg,
       e.payload->>'follow'              as follow,
       (e.payload->>'measured')::numeric as measured,
       (e.payload->>'se')::numeric       as se,
       (e.payload->>'scale')::numeric    as scale
from public.events e
where e.kind = 'pilot';

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.rooms, public.players, public.scores, public.events;
