-- Let players read their own events (still never anyone else's).
-- The client writes events with INSERT ... ON CONFLICT (client_id) DO NOTHING so
-- offline retries can't duplicate them, and Postgres checks the SELECT policy
-- for that statement. With host-only SELECT, every player insert was rejected.

drop policy events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (player_id = (select auth.uid()) or public.is_room_host(room_code));
