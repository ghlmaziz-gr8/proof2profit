-- Profiles, in-app notifications, preferences, and "delete my data".
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text, business_name text, default_location text, industry text,
  prefs jsonb not null default '{"welcome":true,"limit":true,"weekly":true,"alerts":true,"email":true}',
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all
  using (user_id = auth.uid() and public.is_allowed()) with check (user_id = auth.uid() and public.is_allowed());

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null, title text not null, body text, link text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "own notifications mark read" on public.notifications;
create policy "own notifications mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Called once per session: creates the profile row and a welcome notification the first time.
create or replace function public.ensure_profile() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; fresh boolean := false;
begin
  if uid is null or not public.is_allowed() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into p from public.profiles where user_id = uid;
  if not found then
    insert into public.profiles (user_id, display_name) values (uid, split_part(coalesce(auth.jwt() ->> 'email',''), '@', 1)) returning * into p;
    fresh := true;
    insert into public.notifications (user_id, kind, title, body)
    values (uid, 'welcome', 'Welcome to Proof to Profit', 'Analyze a business, save it to My Businesses, and re-run it later to see what changed. You can adjust your profile and notifications any time from your name at the top left.');
  end if;
  return json_build_object('new', fresh);
end $$;
revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- Saved-business change alert (called by the portal when a re-run differs from the previous run).
create or replace function public.notify_alert(p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); on_ boolean;
begin
  if uid is null or not public.is_allowed() then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce((prefs ->> 'alerts')::boolean, true) into on_ from public.profiles where user_id = uid;
  if coalesce(on_, true) then
    insert into public.notifications (user_id, kind, title, body) values (uid, 'alert', left(p_title, 140), left(p_body, 500));
  end if;
end $$;
revoke all on function public.notify_alert(text, text) from public;
grant execute on function public.notify_alert(text, text) to authenticated;

-- Daily limit notice (once per day) added to bump_usage.
create or replace function public.bump_usage(kind text, daily_limit int)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c int; on_ boolean;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_allowed() then raise exception 'not invited' using errcode = '42501'; end if;
  insert into public.usage as u (user_id, day, kind, count)
  values (uid, (now() at time zone 'utc')::date, kind, 1)
  on conflict on constraint usage_pkey do update set count = u.count + 1 where u.count < daily_limit
  returning u.count into c;
  if c is null then
    select coalesce((prefs ->> 'limit')::boolean, true) into on_ from public.profiles where user_id = uid;
    if coalesce(on_, true) and not exists (
      select 1 from public.notifications n where n.user_id = uid and n.kind = 'limit' and n.created_at::date = (now() at time zone 'utc')::date
    ) then
      insert into public.notifications (user_id, kind, title, body)
      values (uid, 'limit', 'Daily limit reached', $m$You have used today's analyses. The limit resets at midnight UTC (8 PM Eastern).$m$);
    end if;
    return json_build_object('allowed', false);
  end if;
  return json_build_object('allowed', true, 'used', c);
end $$;

-- Let users erase their own saved data (their login and invite stay).
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.kv where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.profiles where user_id = uid;
end $$;
revoke all on function public.delete_my_data() from public;
grant execute on function public.delete_my_data() to authenticated;
